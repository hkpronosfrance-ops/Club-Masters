import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAiPool } from "@/lib/aiPool";

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
  return [
    ...rounds,
    ...rounds.map((fixture) => ({
      round: fixture.round + firstLegRounds,
      home_club_id: fixture.away_club_id,
      away_club_id: fixture.home_club_id,
    })),
  ];
}

function simulateScore(homeRep: number, awayRep: number) {
  const homePower = Math.max(0.3, 1.15 + (homeRep - awayRep) / 45);
  const awayPower = Math.max(0.25, 0.95 + (awayRep - homeRep) / 50);
  const goals = (power: number) => Math.min(6, Math.floor(Math.random() * 2.4 * power + Math.random() * 1.4));
  return [goals(homePower), goals(awayPower)] as const;
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
  const { data: existing } = await admin.from("seasons").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing;

  await ensureAiPool();
  const { data: myClub } = await admin.from("clubs").select("id,reputation").eq("id", clubId).single();
  const { data: aiClubs } = await admin.from("clubs").select("id,reputation").eq("is_ai", true).order("reputation", { ascending: false }).limit(9);
  const clubs = [myClub!, ...(aiClubs ?? []).filter((club) => club.id !== clubId)].slice(0, 10);
  if (clubs.length < 4) throw new Error("Pas assez de clubs pour créer le championnat.");

  const totalRounds = (clubs.length - 1) * 2;
  const { data: season, error } = await admin.from("seasons").insert({ name: `Saison ${new Date().getFullYear()}`, total_rounds: totalRounds }).select("*").single();
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
  const clubId = await getUserClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();

  try {
    const season = await ensureSeason(clubId);
    const round = season.current_round;
    if (round > season.total_rounds) return NextResponse.json({ error: "La saison est terminée." }, { status: 400 });

    const { data: fixtures } = await admin.from("league_fixtures").select("*").eq("season_id", season.id).eq("round", round).eq("played", false);
    if (!fixtures?.length) return NextResponse.json({ error: "Cette journée a déjà été jouée." }, { status: 400 });

    const clubIds = [...new Set(fixtures.flatMap((fixture) => [fixture.home_club_id, fixture.away_club_id]))];
    const { data: clubs } = await admin.from("clubs").select("id,reputation").in("id", clubIds);
    const reputation = new Map((clubs ?? []).map((club) => [club.id, club.reputation ?? 50]));

    for (const fixture of fixtures) {
      const [homeScore, awayScore] = simulateScore(reputation.get(fixture.home_club_id) ?? 50, reputation.get(fixture.away_club_id) ?? 50);
      await admin.from("league_fixtures").update({ home_score: homeScore, away_score: awayScore, played: true, played_at: new Date().toISOString() }).eq("id", fixture.id);

      const homeWin = homeScore > awayScore;
      const draw = homeScore === awayScore;
      const updates = [
        { id: fixture.home_club_id, gf: homeScore, ga: awayScore, win: homeWin, draw },
        { id: fixture.away_club_id, gf: awayScore, ga: homeScore, win: !homeWin && !draw, draw },
      ];
      for (const item of updates) {
        const { data: row } = await admin.from("season_clubs").select("*").eq("season_id", season.id).eq("club_id", item.id).single();
        await admin.from("season_clubs").update({
          played: row.played + 1,
          wins: row.wins + (item.win ? 1 : 0),
          draws: row.draws + (item.draw ? 1 : 0),
          losses: row.losses + (!item.win && !item.draw ? 1 : 0),
          goals_for: row.goals_for + item.gf,
          goals_against: row.goals_against + item.ga,
          points: row.points + (item.win ? 3 : item.draw ? 1 : 0),
        }).eq("season_id", season.id).eq("club_id", item.id);
      }
    }

    const nextRound = round + 1;
    await admin.from("seasons").update(nextRound > season.total_rounds ? { current_round: nextRound, status: "finished", finished_at: new Date().toISOString() } : { current_round: nextRound }).eq("id", season.id);
    return NextResponse.json(await leaguePayload(clubId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Impossible de jouer la journée." }, { status: 500 });
  }
}
