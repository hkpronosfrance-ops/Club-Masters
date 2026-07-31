import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PROGRAMS = ["pace", "shooting", "passing", "defending", "physical"] as const;
const INTENSITIES = {
  light: { fatigue: 4, baseChance: 0.28, cooldownHours: 8, injury: 0.002 },
  normal: { fatigue: 8, baseChance: 0.42, cooldownHours: 12, injury: 0.006 },
  intense: { fatigue: 14, baseChance: 0.58, cooldownHours: 18, injury: 0.018 },
} as const;

async function userClub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

export async function GET() {
  const clubId = await userClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const [{ data: club }, { data: players }, { data: history }] = await Promise.all([
    admin.from("clubs").select("id,name,last_training_at").eq("id", clubId).single(),
    admin.from("players").select("id,first_name,last_name,age,position,overall,potential,pace,shooting,passing,defending,physical,fatigue,form,injured_until").eq("club_id", clubId).order("overall", { ascending: false }),
    admin.from("training_sessions").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(8),
  ]);
  return NextResponse.json({ club, players: players ?? [], history: history ?? [] });
}

export async function POST(request: Request) {
  const clubId = await userClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const program = PROGRAMS.includes(body.program) ? body.program : null;
  const intensity = body.intensity in INTENSITIES ? body.intensity as keyof typeof INTENSITIES : null;
  const targetedIds = Array.isArray(body.targetedPlayerIds) ? [...new Set(body.targetedPlayerIds.filter((id: unknown) => typeof id === "string"))].slice(0, 5) : [];
  if (!program || !intensity) return NextResponse.json({ error: "Programme ou intensité invalide." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: club }, { data: players }] = await Promise.all([
    admin.from("clubs").select("id,last_training_at").eq("id", clubId).single(),
    admin.from("players").select("*").eq("club_id", clubId),
  ]);
  const config = INTENSITIES[intensity];
  if (club?.last_training_at) {
    const nextAt = new Date(club.last_training_at).getTime() + config.cooldownHours * 3_600_000;
    if (nextAt > Date.now()) return NextResponse.json({ error: "Le groupe doit récupérer avant une nouvelle séance.", nextTrainingAt: new Date(nextAt).toISOString() }, { status: 429 });
  }

  const now = new Date();
  const targeted = new Set(targetedIds);
  const results: any[] = [];
  for (const player of players ?? []) {
    const injured = player.injured_until && new Date(player.injured_until).getTime() > Date.now();
    if (injured) continue;
    const ageFactor = player.age <= 21 ? 1.35 : player.age <= 25 ? 1.12 : player.age <= 29 ? 0.88 : 0.55;
    const potentialRoom = Math.max(0, player.potential - player.overall);
    const potentialFactor = Math.min(1.35, 0.35 + potentialRoom / 12);
    const targetedFactor = targeted.has(player.id) ? 1.45 : 1;
    const formFactor = 0.75 + (player.form ?? 50) / 200;
    const chance = Math.min(0.92, config.baseChance * ageFactor * potentialFactor * targetedFactor * formFactor);
    const progressed = potentialRoom > 0 && Math.random() < chance;
    const statGain = progressed ? 1 : 0;
    const nextStat = Math.min(99, (player[program] ?? 0) + statGain);
    const overallGain = progressed && Math.random() < 0.34 + potentialRoom / 80 ? 1 : 0;
    const nextOverall = Math.min(player.potential, player.overall + overallGain);
    const nextFatigue = Math.min(100, player.fatigue + config.fatigue + (targeted.has(player.id) ? 2 : 0));
    const update: Record<string, unknown> = { [program]: nextStat, overall: nextOverall, fatigue: nextFatigue };
    let injury = null;
    const injuryChance = config.injury * (1 + Math.max(0, nextFatigue - 65) / 25);
    if (Math.random() < injuryChance) {
      const days = 2 + Math.floor(Math.random() * (intensity === "intense" ? 8 : 4));
      injury = { type: "Surcharge musculaire", days };
      update.injury_type = injury.type;
      update.injured_until = new Date(Date.now() + days * 86_400_000).toISOString();
    }
    await admin.from("players").update(update).eq("id", player.id);
    if (progressed || injury || targeted.has(player.id)) results.push({ playerId: player.id, name: `${player.first_name} ${player.last_name}`, statGain, overallGain, fatigueGain: config.fatigue + (targeted.has(player.id) ? 2 : 0), injury, targeted: targeted.has(player.id) });
  }

  await admin.from("clubs").update({ last_training_at: now.toISOString() }).eq("id", clubId);
  await admin.from("training_sessions").insert({ club_id: clubId, program, intensity, targeted_player_ids: targetedIds, results });
  return NextResponse.json({ results, nextTrainingAt: new Date(now.getTime() + config.cooldownHours * 3_600_000).toISOString() });
}
