import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAiPool } from "@/lib/aiPool";
import { seasonObjective } from "@/lib/boardProgress";

function buildSchedule(clubIds: string[]) {
  const ids = [...clubIds];
  if (ids.length % 2) ids.push("BYE");
  const rounds: { round: number; home_club_id: string; away_club_id: string }[] = [];
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const half = ids.length / 2;
  for (let round = 1; round < ids.length; round++) {
    const order = [fixed, ...rotating];
    for (let i = 0; i < half; i++) {
      const a = order[i];
      const b = order[order.length - 1 - i];
      if (a === "BYE" || b === "BYE") continue;
      const homeFirst = (round + i) % 2 === 0;
      rounds.push({ round, home_club_id: homeFirst ? a : b, away_club_id: homeFirst ? b : a });
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  const firstLegRounds = ids.length - 1;
  return [...rounds, ...rounds.map((fixture) => ({ round: fixture.round + firstLegRounds, home_club_id: fixture.away_club_id, away_club_id: fixture.home_club_id }))];
}

async function getUserClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function ensureSeason(clubId: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("seasons").select("*").eq("status", "active").eq("user_club_id", clubId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing;

  await ensureAiPool();
  const { data: myClub } = await admin.from("clubs").select("id,reputation").eq("id", clubId).single();
  const { data: aiClubs } = await admin.from("clubs").select("id,reputation").eq("is_ai", true).order("reputation", { ascending: false }).limit(9);
  const clubs = [myClub!, ...(aiClubs ?? []).filter((club) => club.id !== clubId)].slice(0, 10);
  if (clubs.length < 4) throw new Error("Pas assez de clubs pour créer le championnat.");

  const objective = seasonObjective(myClub?.reputation ?? 50, clubs.length);
  const previousCount = (await admin.from("seasons").select("id", { count: "exact", head: true }).eq("user_club_id", clubId)).count ?? 0;
  const totalRounds = (clubs.length - 1) * 2;
  const { data: season, error } = await admin.from("seasons").insert({
    name: `Saison ${previousCount + 1}`,
    total_rounds: totalRounds,
    user_club_id: clubId,
    objective_code: objective.code,
    objective_label: objective.label,
    target_position: objective.target,
    board_confidence: 60,
  }).select("*").single();
  if (error) throw error;

  await admin.from("season_clubs").insert(clubs.map((club) => ({ season_id: season.id, club_id: club.id })));
  await admin.from("league_fixtures").insert(buildSchedule(clubs.map((club) => club.id)).map((fixture) => ({ ...fixture, season_id: season.id })));
  return season;
}

async function leaguePayload(clubId: string) {
  const admin = createAdminClient();
  const season = await ensureSeason(clubId);
  const [{ data: standings }, { data: fixtures }] = await Promise.all([
    admin.from("season_clubs").select("*,club:clubs(id,name,short_name,primary_color)").eq("season_id", season.id),
    admin.from("league_fixtures").select("*,home:clubs!league_fixtures_home_club_id_fkey(id,name,short_name),away:clubs!league_fixtures_away_club_id_fkey(id,name,short_name)").eq("season_id", season.id).order("round").order("created_at"),
  ]);
  const table = [...(standings ?? [])].sort((a: any, b: any) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) || b.goals_for - a.goals_for);
  return { season, standings: table, fixtures: fixtures ?? [], clubId };
}

export async function GET() {
  const clubId = await getUserClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  try {
    return NextResponse.json(await leaguePayload(clubId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Impossible de charger le championnat." }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Prépare ton onze dans l'onglet Match pour jouer la journée." }, { status: 400 });
}
