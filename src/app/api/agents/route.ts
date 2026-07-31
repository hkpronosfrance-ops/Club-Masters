import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return data?.club_id ?? null;
}

const names = [
  ["Marco", "Bellini", "Italie"], ["Sofiane", "Benkacem", "France"],
  ["Javier", "Morales", "Espagne"], ["Daniel", "Kraus", "Allemagne"],
  ["Tiago", "Ferreira", "Portugal"], ["Victor", "Mensah", "Ghana"],
];
const personalities = ["business", "loyal", "protective", "ambitious", "opportunist"];

async function ensureAgents(admin: ReturnType<typeof createAdminClient>, clubId: string) {
  const { count } = await admin.from("player_agents").select("id", { count: "exact", head: true });
  if (!count) {
    await admin.from("player_agents").insert(names.map((n, i) => ({
      first_name: n[0], last_name: n[1], nationality: n[2],
      personality: personalities[i % personalities.length],
      reputation: 45 + i * 8, difficulty: 35 + i * 9, commission_rate: 5 + i * 1.8,
    })));
  }
  const { data: agents } = await admin.from("player_agents").select("id");
  const { data: players } = await admin.from("players").select("id,agent_id").eq("club_id", clubId);
  const pool = agents ?? [];
  for (let i = 0; i < (players ?? []).length; i++) {
    const p = players![i];
    if (!p.agent_id && pool.length) await admin.from("players").update({ agent_id: pool[i % pool.length].id }).eq("id", p.id);
  }
}

export async function GET() {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  await ensureAgents(admin, clubId);
  const [{ data: players }, { data: relationships }, { data: messages }, { data: negotiations }] = await Promise.all([
    admin.from("players").select("id,first_name,last_name,position,overall,wage,morale,agent:player_agents(*)").eq("club_id", clubId).order("overall", { ascending: false }),
    admin.from("club_agent_relationships").select("*,agent:player_agents(*)").eq("club_id", clubId),
    admin.from("agent_messages").select("*,agent:player_agents(*),player:players(first_name,last_name)").eq("club_id", clubId).order("created_at", { ascending: false }).limit(20),
    admin.from("agent_contract_negotiations").select("*,agent:player_agents(*),player:players(first_name,last_name,overall)").eq("club_id", clubId).order("created_at", { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ players: players ?? [], relationships: relationships ?? [], messages: messages ?? [], negotiations: negotiations ?? [] });
}

export async function POST(req: Request) {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const playerId = body?.playerId;
  const type = body?.type === "renewal" ? "renewal" : "transfer";
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id,agent_id,wage,overall,value").eq("id", playerId).single();
  if (!player?.agent_id) return NextResponse.json({ error: "Ce joueur n'a pas encore d'agent." }, { status: 400 });
  const { data: agent } = await admin.from("player_agents").select("*").eq("id", player.agent_id).single();
  if (!agent) return NextResponse.json({ error: "Agent introuvable." }, { status: 404 });

  const salary = Math.round(Number(body?.salary ?? player.wage ?? 1000));
  const signingBonus = Math.max(0, Math.round(Number(body?.signingBonus ?? 0)));
  const years = Math.max(1, Math.min(5, Number(body?.contractYears ?? 3)));
  const role = ["star", "important", "rotation", "prospect"].includes(body?.promisedRole) ? body.promisedRole : "rotation";
  const demand = Math.round(Number(player.wage ?? 1000) * (1.08 + Number(agent.difficulty) / 180));
  const score = salary / Math.max(1, demand) + signingBonus / Math.max(1, Number(player.value ?? 1000000)) + (100 - Number(agent.difficulty)) / 250;
  const status = score >= 1.18 ? "accepted" : score >= 0.88 ? "countered" : "rejected";
  const response = status === "accepted" ? "L'agent accepte les conditions proposées." : status === "countered" ? `L'agent réclame environ ${Math.round(demand).toLocaleString("fr-FR")} € par semaine et une meilleure prime.` : "L'agent estime l'offre insuffisante et ferme temporairement la discussion.";

  const { data, error } = await admin.from("agent_contract_negotiations").insert({
    club_id: clubId, agent_id: player.agent_id, player_id: player.id, negotiation_type: type,
    salary, signing_bonus: signingBonus, contract_years: years, promised_role: role, status, agent_response: response,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const delta = status === "accepted" ? 5 : status === "countered" ? 0 : -7;
  const { data: relation } = await admin.from("club_agent_relationships").select("*").eq("club_id", clubId).eq("agent_id", player.agent_id).maybeSingle();
  if (relation) await admin.from("club_agent_relationships").update({ relationship: Math.max(0, Math.min(100, relation.relationship + delta)), successful_deals: relation.successful_deals + (status === "accepted" ? 1 : 0), failed_deals: relation.failed_deals + (status === "rejected" ? 1 : 0), updated_at: new Date().toISOString() }).eq("id", relation.id);
  else await admin.from("club_agent_relationships").insert({ club_id: clubId, agent_id: player.agent_id, relationship: 50 + delta, successful_deals: status === "accepted" ? 1 : 0, failed_deals: status === "rejected" ? 1 : 0 });

  if (status === "rejected") await admin.from("players").update({ morale: Math.max(0, Number(player.overall ?? 50) - 8) }).eq("id", player.id);
  return NextResponse.json({ negotiation: data, response });
}

export async function PATCH(req: Request) {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const admin = createAdminClient();
  if (body?.messageId) {
    await admin.from("agent_messages").update({ status: body.action === "dismiss" ? "dismissed" : "read" }).eq("id", body.messageId).eq("club_id", clubId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
