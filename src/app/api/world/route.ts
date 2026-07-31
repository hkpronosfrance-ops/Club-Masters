import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function money(value: number) {
  return Math.round(Math.max(0, value));
}

async function getUserClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function payload(clubId: string) {
  const admin = createAdminClient();
  const [{ data: news }, { data: finances }, { data: cycles }, { data: club }] = await Promise.all([
    admin.from("world_news").select("*,clubs(name),players(first_name,last_name)").order("created_at", { ascending: false }).limit(40),
    admin.from("club_finance_entries").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(30),
    admin.from("world_cycles").select("*").order("cycle_number", { ascending: false }).limit(1),
    admin.from("clubs").select("id,name,balance,reputation").eq("id", clubId).single(),
  ]);
  return { news: news ?? [], finances: finances ?? [], latestCycle: cycles?.[0] ?? null, club };
}

export async function GET() {
  const clubId = await getUserClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await payload(clubId));
}

export async function POST() {
  const clubId = await getUserClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });

  const admin = createAdminClient();
  try {
    const { data: latest } = await admin.from("world_cycles").select("cycle_number").order("cycle_number", { ascending: false }).limit(1).maybeSingle();
    const cycleNumber = Number(latest?.cycle_number ?? 0) + 1;
    const label = `Mois ${cycleNumber}`;

    const { data: clubs } = await admin.from("clubs").select("id,name,balance,reputation");
    if (!clubs?.length) throw new Error("Aucun club disponible.");

    const financeRows: any[] = [];
    const newsRows: any[] = [];

    for (const club of clubs) {
      const reputation = Number(club.reputation ?? 50);
      const { data: squad } = await admin.from("players").select("id,first_name,last_name,overall,potential,age,wage,form,morale,is_listed").eq("club_id", club.id);
      const wages = (squad ?? []).reduce((sum, player) => sum + Number(player.wage ?? 0), 0);
      const tv = money(120_000 + reputation * 9_000);
      const sponsor = money(80_000 + reputation * 6_500);
      const tickets = money(45_000 + reputation * 5_500 + Math.random() * 90_000);
      const merchandising = money(25_000 + reputation * 3_500 + Math.random() * 60_000);
      const maintenance = money(90_000 + reputation * 2_200);
      const wageExpense = money(wages / 12);
      const net = tv + sponsor + tickets + merchandising - maintenance - wageExpense;

      financeRows.push(
        { club_id: club.id, cycle_number: cycleNumber, entry_type: "tv", amount: tv, description: "Droits TV mensuels" },
        { club_id: club.id, cycle_number: cycleNumber, entry_type: "sponsor", amount: sponsor, description: "Versement des sponsors" },
        { club_id: club.id, cycle_number: cycleNumber, entry_type: "tickets", amount: tickets, description: "Billetterie et hospitalités" },
        { club_id: club.id, cycle_number: cycleNumber, entry_type: "merchandising", amount: merchandising, description: "Boutique et produits dérivés" },
        { club_id: club.id, cycle_number: cycleNumber, entry_type: "maintenance", amount: -maintenance, description: "Entretien des infrastructures" },
        { club_id: club.id, cycle_number: cycleNumber, entry_type: "wages", amount: -wageExpense, description: "Masse salariale mensuelle" },
      );

      await admin.from("clubs").update({ balance: Number(club.balance ?? 0) + net }).eq("id", club.id);

      if (net > 0) {
        newsRows.push({ club_id: club.id, category: "finance", importance: net > 1_000_000 ? 3 : 1, title: `${club.name} clôture le mois dans le vert`, body: `Le club enregistre un résultat mensuel positif de ${Math.round(net / 1000)} k€.` });
      } else {
        newsRows.push({ club_id: club.id, category: "finance", importance: 3, title: `Pression financière à ${club.name}`, body: `Le club termine le mois avec un déficit de ${Math.round(Math.abs(net) / 1000)} k€.` });
      }

      const rising = [...(squad ?? [])].sort((a, b) => (Number(b.form ?? 0) + Number(b.potential ?? 0)) - (Number(a.form ?? 0) + Number(a.potential ?? 0)))[0];
      if (rising && Number(rising.form ?? 0) >= 65) {
        newsRows.push({ club_id: club.id, player_id: rising.id, category: "form", importance: 2, title: `${rising.first_name} ${rising.last_name} impressionne`, body: `Le joueur de ${club.name} traverse une excellente période et attire l’attention des observateurs.` });
      }

      const listed = (squad ?? []).filter((player) => player.is_listed);
      if (listed.length) {
        const player = listed[Math.floor(Math.random() * listed.length)];
        newsRows.push({ club_id: club.id, player_id: player.id, category: "transfer", importance: 2, title: `Un départ se prépare à ${club.name}`, body: `${player.first_name} ${player.last_name} est disponible sur le marché des transferts.` });
      }
    }

    await admin.from("club_finance_entries").insert(financeRows);
    if (newsRows.length) await admin.from("world_news").insert(newsRows.slice(0, 30));
    await admin.from("world_cycles").insert({ cycle_number: cycleNumber, label });

    return NextResponse.json(await payload(clubId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Impossible de faire avancer le monde." }, { status: 500 });
  }
}
