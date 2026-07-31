import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { simulateMatch, type EngineClub, type EnginePlayer } from "@/lib/matchEngine";
import { seasonObjective, updateBoardProgress } from "@/lib/boardProgress";

function toEngineClub(club: any, players: any[], startingIds: string[]): EngineClub {
  return { id: club.id, name: club.name, formation: club.formation, tactic_style: club.tactic_style, mentality: club.mentality, players: players as EnginePlayer[], startingIds };
}
function available(player: any) { return !player.injured_until || new Date(player.injured_until).getTime() <= Date.now(); }
function bestEleven(players: any[]) { return [...players].filter(available).sort((a, b) => (b.overall - b.fatigue * 0.18) - (a.overall - a.fatigue * 0.18)).slice(0, 11); }
function injuryRisk(fatigue: number) { if (fatigue >= 90) return 0.2; if (fatigue >= 80) return 0.11; if (fatigue >= 70) return 0.06; return 0.015; }
function simulateAiScore(homeRep: number, awayRep: number) {
  const homePower = Math.max(0.3, 1.15 + (homeRep - awayRep) / 45);
  const awayPower = Math.max(0.25, 0.95 + (awayRep - homeRep) / 50);
  const goals = (power: number) => Math.min(6, Math.floor(Math.random() * 2.4 * power + Math.random() * 1.4));
  return [goals(homePower), goals(awayPower)] as const;
}
async function updateStanding(admin: any, seasonId: string, clubId: string, gf: number, ga: number) {
  const { data: row } = await admin.from("season_clubs").select("*").eq("season_id", seasonId).eq("club_id", clubId).single();
  if (!row) return;
  const win = gf > ga; const draw = gf === ga;
  await admin.from("season_clubs").update({ played: row.played + 1, wins: row.wins + (win ? 1 : 0), draws: row.draws + (draw ? 1 : 0), losses: row.losses + (!win && !draw ? 1 : 0), goals_for: row.goals_for + gf, goals_against: row.goals_against + ga, points: row.points + (win ? 3 : draw ? 1 : 0) }).eq("season_id", seasonId).eq("club_id", clubId);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const starterIds = Array.isArray(body.starterIds) ? [...new Set(body.starterIds.filter((id: unknown) => typeof id === "string"))] : [];
  if (starterIds.length !== 11) return NextResponse.json({ error: "Sélectionne exactement 11 titulaires avant de lancer le match." }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club" }, { status: 400 });
  const { data: seasonData } = await admin.from("seasons").select("*").eq("status", "active").eq("user_club_id", profile.club_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!seasonData) return NextResponse.json({ error: "Aucune saison active. Ouvre d'abord la page Ligue." }, { status: 400 });
  let season = seasonData;

  const { data: fixture } = await admin.from("league_fixtures").select("*").eq("season_id", season.id).eq("round", season.current_round).eq("played", false).or(`home_club_id.eq.${profile.club_id},away_club_id.eq.${profile.club_id}`).maybeSingle();
  if (!fixture) return NextResponse.json({ error: "Ton match de cette journée a déjà été joué ou aucun match n'est prévu." }, { status: 400 });

  const opponentId = fixture.home_club_id === profile.club_id ? fixture.away_club_id : fixture.home_club_id;
  const homeIsMe = fixture.home_club_id === profile.club_id;
  const [{ data: myClub }, { data: opponent }, { data: myPlayers }, { data: opponentPlayers }] = await Promise.all([
    admin.from("clubs").select("*").eq("id", profile.club_id).single(), admin.from("clubs").select("*").eq("id", opponentId).single(), admin.from("players").select("*").eq("club_id", profile.club_id), admin.from("players").select("*").eq("club_id", opponentId),
  ]);
  if (!season.objective_code) {
    const { count } = await admin.from("season_clubs").select("club_id", { count: "exact", head: true }).eq("season_id", season.id);
    const objective = seasonObjective(myClub?.reputation ?? 50, count ?? 10);
    const { data: initialized } = await admin.from("seasons").update({ user_club_id: myClub.id, objective_code: objective.code, objective_label: objective.label, target_position: objective.target }).eq("id", season.id).select("*").single();
    season = initialized ?? season;
  }

  const ownedPlayers = (myPlayers ?? []).filter(available);
  const opponentAvailable = (opponentPlayers ?? []).filter(available);
  const starters = starterIds.map((id: string) => ownedPlayers.find((player) => player.id === id)).filter(Boolean);
  if (starters.length !== 11) return NextResponse.json({ error: "La composition contient un joueur indisponible ou qui n'appartient plus à ton club." }, { status: 400 });
  if (!starters.some((player: any) => player.position === "GK")) return NextResponse.json({ error: "Ta composition doit contenir au moins un gardien." }, { status: 400 });
  const opponentStarters = bestEleven(opponentAvailable);
  if (opponentStarters.length < 11) return NextResponse.json({ error: "L'adversaire ne dispose pas de suffisamment de joueurs disponibles." }, { status: 400 });

  const opponentStarterIds = opponentStarters.map((player: any) => player.id);
  const myEngine = toEngineClub(myClub, ownedPlayers, starterIds as string[]);
  const opponentEngine = toEngineClub(opponent, opponentAvailable, opponentStarterIds);
  const home = homeIsMe ? myEngine : opponentEngine;
  const away = homeIsMe ? opponentEngine : myEngine;
  const weathers = ["sunny", "rain", "cold"] as const;
  const result = simulateMatch(home, away, { weather: weathers[Math.floor(Math.random() * weathers.length)] });
  await admin.from("matches").insert({ home_club_id: home.id, away_club_id: away.id, home_score: result.homeScore, away_score: result.awayScore, events: result.events, home_strength: result.homeStrength, away_strength: result.awayStrength });
  await admin.from("league_fixtures").update({ home_score: result.homeScore, away_score: result.awayScore, played: true, played_at: new Date().toISOString() }).eq("id", fixture.id);
  await updateStanding(admin, season.id, home.id, result.homeScore, result.awayScore); await updateStanding(admin, season.id, away.id, result.awayScore, result.homeScore);

  const myScore = homeIsMe ? result.homeScore : result.awayScore; const oppScore = homeIsMe ? result.awayScore : result.homeScore;
  const outcome: "win" | "draw" | "loss" = myScore > oppScore ? "win" : myScore === oppScore ? "draw" : "loss";
  const matchBonus = outcome === "win" ? 180_000 : outcome === "draw" ? 80_000 : 30_000;
  const ticketRevenue = homeIsMe ? 80_000 + Math.floor(Math.random() * 150_000) : 0;
  const balanceAfterMatch = myClub.balance + matchBonus + ticketRevenue;
  await admin.from("clubs").update({ wins: myClub.wins + (outcome === "win" ? 1 : 0), draws: myClub.draws + (outcome === "draw" ? 1 : 0), losses: myClub.losses + (outcome === "loss" ? 1 : 0), balance: balanceAfterMatch }).eq("id", myClub.id);

  const substitutionEvents = result.events.filter((event) => event.type === "substitution" && event.team === (homeIsMe ? "home" : "away"));
  const usedNames = new Set(substitutionEvents.flatMap((event) => [event.playerName, event.secondaryPlayerName].filter(Boolean)));
  const injuries: { id: string; name: string; type: string; days: number }[] = [];
  const formDelta = outcome === "win" ? 6 : outcome === "draw" ? 1 : -5; const starterSet = new Set(starterIds);
  for (const player of ownedPlayers) {
    const fullName = `${player.first_name} ${player.last_name}`;
    const played = starterSet.has(player.id) || usedNames.has(fullName);
    const nextFatigue = Math.min(100, Math.max(0, player.fatigue + (played ? 15 + Math.floor(Math.random() * 10) : -4)));
    const update: Record<string, unknown> = { fatigue: nextFatigue, form: Math.max(0, Math.min(100, player.form + (played ? formDelta + Math.floor(Math.random() * 6 - 3) : 0))) };
    if (played && Math.random() < injuryRisk(nextFatigue)) { const days = nextFatigue >= 90 ? 10 + Math.floor(Math.random() * 12) : 3 + Math.floor(Math.random() * 7); const types = ["Lésion musculaire", "Entorse", "Contusion"]; const type = types[Math.floor(Math.random() * types.length)]; update.injured_until = new Date(Date.now() + days * 86_400_000).toISOString(); update.injury_type = type; injuries.push({ id: player.id, name: fullName, type, days }); }
    await admin.from("players").update(update).eq("id", player.id);
  }

  const { data: aiFixtures } = await admin.from("league_fixtures").select("*").eq("season_id", season.id).eq("round", season.current_round).eq("played", false);
  if (aiFixtures?.length) {
    const clubIds = [...new Set(aiFixtures.flatMap((item) => [item.home_club_id, item.away_club_id]))]; const { data: clubs } = await admin.from("clubs").select("id,reputation").in("id", clubIds); const reps = new Map((clubs ?? []).map((club) => [club.id, club.reputation ?? 50]));
    for (const item of aiFixtures) { const [homeScore, awayScore] = simulateAiScore(reps.get(item.home_club_id) ?? 50, reps.get(item.away_club_id) ?? 50); await admin.from("league_fixtures").update({ home_score: homeScore, away_score: awayScore, played: true, played_at: new Date().toISOString() }).eq("id", item.id); await updateStanding(admin, season.id, item.home_club_id, homeScore, awayScore); await updateStanding(admin, season.id, item.away_club_id, awayScore, homeScore); }
  }

  const nextRound = season.current_round + 1; const seasonFinished = nextRound > season.total_rounds;
  await admin.from("seasons").update(seasonFinished ? { current_round: nextRound, status: "finished", finished_at: new Date().toISOString() } : { current_round: nextRound }).eq("id", season.id);
  const board = await updateBoardProgress(admin, season, { ...myClub, balance: balanceAfterMatch }, outcome, seasonFinished);

  return NextResponse.json({ result, homeIsMe, home: { id: home.id, name: home.name }, away: { id: away.id, name: away.name }, opponent: { id: opponent.id, name: opponent.name }, outcome, ticketRevenue, matchBonus, injuries, round: season.current_round, seasonFinished, board });
}
