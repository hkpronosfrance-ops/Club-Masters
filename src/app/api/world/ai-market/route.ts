import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const POSITION_GROUPS: Record<string, string[]> = {
  GK: ["GK"],
  DEF: ["DC", "DL", "DR"],
  MID: ["MDC", "MC", "MOC"],
  ATT: ["AG", "AD", "BU"],
};

function groupFor(position: string) {
  return Object.entries(POSITION_GROUPS).find(([, positions]) => positions.includes(position))?.[0] ?? "MID";
}

function weakestGroup(players: any[]) {
  const scores = Object.keys(POSITION_GROUPS).map((group) => {
    const members = players.filter((player) => groupFor(player.position) === group);
    const average = members.length ? members.reduce((sum, player) => sum + Number(player.overall ?? 0), 0) / members.length : 0;
    const minimum = group === "GK" ? 2 : group === "ATT" ? 4 : 5;
    return { group, score: average + Math.min(members.length, minimum) * 2, count: members.length, minimum };
  });
  return scores.sort((a, b) => a.score - b.score)[0];
}

async function getUserClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function responsePayload() {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("ai_transfer_events")
    .select("*,buyer:clubs!ai_transfer_events_buyer_club_id_fkey(name),seller:clubs!ai_transfer_events_seller_club_id_fkey(name),player:players(first_name,last_name,position,overall)")
    .order("created_at", { ascending: false })
    .limit(50);
  return { events: events ?? [] };
}

export async function GET() {
  const clubId = await getUserClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await responsePayload());
}

export async function POST() {
  const userClubId = await getUserClubId();
  if (!userClubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });

  const admin = createAdminClient();
  try {
    const { data: latestCycle } = await admin.from("world_cycles").select("cycle_number").order("cycle_number", { ascending: false }).limit(1).maybeSingle();
    const cycleNumber = Number(latestCycle?.cycle_number ?? 0);
    if (!cycleNumber) return NextResponse.json({ error: "Fais d’abord avancer le monde d’au moins un mois." }, { status: 400 });

    const { data: existing } = await admin.from("ai_transfer_events").select("id").eq("cycle_number", cycleNumber).limit(1);
    if (existing?.length) return NextResponse.json({ error: "Le mercato IA a déjà été simulé pour ce mois." }, { status: 400 });

    const { data: clubs } = await admin.from("clubs").select("id,name,balance,reputation,owner_id");
    const aiClubs = (clubs ?? []).filter((club) => !club.owner_id && club.id !== userClubId);
    if (aiClubs.length < 2) throw new Error("Il faut au moins deux clubs IA.");

    const squads = new Map<string, any[]>();
    for (const club of aiClubs) {
      const { data: players } = await admin.from("players").select("id,club_id,first_name,last_name,position,overall,potential,age,value,wage,contract_until,is_listed").eq("club_id", club.id);
      squads.set(club.id, players ?? []);
    }

    const events: any[] = [];
    const news: any[] = [];

    for (const club of aiClubs) {
      const squad = squads.get(club.id) ?? [];
      const weak = weakestGroup(squad);
      const balance = Number(club.balance ?? 0);
      const maxBudget = Math.max(0, balance * 0.22);

      const renewalCandidates = squad.filter((player) => {
        const expiry = player.contract_until ? new Date(player.contract_until).getTime() : 0;
        const monthsLeft = expiry ? (expiry - Date.now()) / (1000 * 60 * 60 * 24 * 30) : 0;
        return monthsLeft < 12 && Number(player.overall ?? 0) >= 60 && Number(player.age ?? 99) <= 31;
      }).sort((a, b) => Number(b.overall) - Number(a.overall)).slice(0, 2);

      for (const player of renewalCandidates) {
        const years = Number(player.age) >= 29 ? 2 : 4;
        const contractUntil = `${new Date().getFullYear() + years}-06-30`;
        const wage = Math.round(Number(player.wage ?? 1000) * (1.08 + Math.random() * 0.12));
        await admin.from("players").update({ contract_until: contractUntil, wage }).eq("id", player.id);
        events.push({ cycle_number: cycleNumber, event_type: "renewal", buyer_club_id: club.id, player_id: player.id, details: { years, wage } });
        news.push({ club_id: club.id, player_id: player.id, category: "transfer", importance: 1, title: `${player.first_name} ${player.last_name} prolonge`, body: `${club.name} sécurise l’avenir de son joueur avec un nouveau contrat de ${years} ans.` });
      }

      const surplus = squad
        .filter((player) => Number(player.age ?? 0) >= 30 || Number(player.overall ?? 99) < Math.max(52, Number(club.reputation ?? 50) - 8))
        .sort((a, b) => Number(a.overall) - Number(b.overall))[0];
      if (surplus && !surplus.is_listed && squad.length > 18) {
        await admin.from("players").update({ is_listed: true }).eq("id", surplus.id);
        surplus.is_listed = true;
        events.push({ cycle_number: cycleNumber, event_type: "listing", seller_club_id: club.id, player_id: surplus.id, details: { reason: "surplus" } });
      }

      const candidates = aiClubs.flatMap((seller) => (squads.get(seller.id) ?? [])
        .filter((player) => seller.id !== club.id)
        .filter((player) => groupFor(player.position) === weak.group)
        .filter((player) => player.is_listed || Number(player.age ?? 99) <= 24)
        .filter((player) => Number(player.value ?? 0) > 0 && Number(player.value ?? 0) <= maxBudget)
        .map((player) => ({ ...player, seller }))
      ).sort((a, b) => {
        const scoreA = Number(a.overall) + Math.max(0, Number(a.potential) - Number(a.overall)) * 0.5;
        const scoreB = Number(b.overall) + Math.max(0, Number(b.potential) - Number(b.overall)) * 0.5;
        return scoreB - scoreA;
      });

      const target = candidates[0];
      if (!target || Math.random() > 0.72) continue;

      const fee = Math.round(Number(target.value) * (0.92 + Math.random() * 0.2));
      const sellerBalance = Number(target.seller.balance ?? 0);
      if (fee > Number(club.balance ?? 0)) continue;

      await admin.from("clubs").update({ balance: Number(club.balance ?? 0) - fee }).eq("id", club.id);
      await admin.from("clubs").update({ balance: sellerBalance + fee }).eq("id", target.seller.id);
      await admin.from("players").update({ club_id: club.id, is_listed: false, wage: Math.round(Number(target.wage ?? 1000) * 1.12), contract_until: `${new Date().getFullYear() + 4}-06-30` }).eq("id", target.id);

      club.balance = Number(club.balance ?? 0) - fee;
      target.seller.balance = sellerBalance + fee;
      squads.set(target.seller.id, (squads.get(target.seller.id) ?? []).filter((player) => player.id !== target.id));
      squads.set(club.id, [...(squads.get(club.id) ?? []), { ...target, club_id: club.id, is_listed: false }]);

      events.push({ cycle_number: cycleNumber, event_type: "purchase", buyer_club_id: club.id, seller_club_id: target.seller.id, player_id: target.id, transfer_fee: fee, details: { need: weak.group } });
      news.push({ club_id: club.id, player_id: target.id, category: "transfer", importance: fee >= 10_000_000 ? 4 : 3, title: `${club.name} recrute ${target.first_name} ${target.last_name}`, body: `Le club renforce son secteur ${weak.group} pour ${Math.round(fee / 1_000_000 * 10) / 10} M€ en provenance de ${target.seller.name}.` });
    }

    if (events.length) await admin.from("ai_transfer_events").insert(events);
    if (news.length) await admin.from("world_news").insert(news.slice(0, 30));

    return NextResponse.json({ ...(await responsePayload()), summary: { actions: events.length, transfers: events.filter((event) => event.event_type === "purchase").length, renewals: events.filter((event) => event.event_type === "renewal").length, listings: events.filter((event) => event.event_type === "listing").length } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Impossible de simuler le mercato IA." }, { status: 500 });
  }
}
