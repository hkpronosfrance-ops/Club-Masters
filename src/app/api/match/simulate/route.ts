import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAiPool } from "@/lib/aiPool";
import { simulateMatch, type EngineClub, type EnginePlayer } from "@/lib/matchEngine";

function toEngineClub(club: any, players: any[]): EngineClub {
  return { id: club.id, name: club.name, formation: club.formation, tactic_style: club.tactic_style, mentality: club.mentality, players: players as EnginePlayer[] };
}

function available(player: any) {
  return !player.injured_until || new Date(player.injured_until).getTime() <= Date.now();
}

function bestEleven(players: any[]) {
  return [...players].filter(available).sort((a, b) => (b.overall - b.fatigue * 0.18) - (a.overall - a.fatigue * 0.18)).slice(0, 11);
}

function injuryRisk(fatigue: number) {
  if (fatigue >= 90) return 0.2;
  if (fatigue >= 80) return 0.11;
  if (fatigue >= 70) return 0.06;
  return 0.015;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const starterIds = Array.isArray(body.starterIds) ? [...new Set(body.starterIds.filter((id: unknown) => typeof id === "string"))] : [];
  if (starterIds.length !== 11) return NextResponse.json({ error: "Sélectionne exactement 11 titulaires avant de lancer le match." }, { status: 400 });

  const admin = createAdminClient();
  await ensureAiPool();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club" }, { status: 400 });

  const { data: myClub } = await admin.from("clubs").select("*").eq("id", profile.club_id).single();
  const { data: myPlayers } = await admin.from("players").select("*").eq("club_id", profile.club_id);
  const ownedPlayers = myPlayers ?? [];
  const starters = starterIds.map((id: string) => ownedPlayers.find((player) => player.id === id)).filter(Boolean);
  if (starters.length !== 11) return NextResponse.json({ error: "La composition contient un joueur qui n'appartient plus à ton club." }, { status: 400 });
  if (starters.some((player: any) => !available(player))) return NextResponse.json({ error: "Un joueur blessé figure dans la composition." }, { status: 400 });
  if (!starters.some((player: any) => player.position === "GK")) return NextResponse.json({ error: "Ta composition doit contenir au moins un gardien." }, { status: 400 });

  const { data: aiCandidates } = await admin.from("clubs").select("*").eq("is_ai", true).gte("reputation", (myClub!.reputation ?? 50) - 15).lte("reputation", (myClub!.reputation ?? 50) + 15).limit(20);
  const opponent = (aiCandidates && aiCandidates[Math.floor(Math.random() * aiCandidates.length)]) || (await admin.from("clubs").select("*").eq("is_ai", true).limit(1).single()).data;
  const { data: opponentPlayers } = await admin.from("players").select("*").eq("club_id", opponent!.id);
  const opponentStarters = bestEleven(opponentPlayers ?? []);

  const homeIsMe = Math.random() < 0.5;
  const home = homeIsMe ? toEngineClub(myClub, starters) : toEngineClub(opponent, opponentStarters);
  const away = homeIsMe ? toEngineClub(opponent, opponentStarters) : toEngineClub(myClub, starters);
  const weathers = ["sunny", "rain", "cold"] as const;
  const result = simulateMatch(home, away, { weather: weathers[Math.floor(Math.random() * weathers.length)] });

  await admin.from("matches").insert({ home_club_id: home.id, away_club_id: away.id, home_score: result.homeScore, away_score: result.awayScore, events: result.events, home_strength: result.homeStrength, away_strength: result.awayStrength });
  const myScore = homeIsMe ? result.homeScore : result.awayScore;
  const oppScore = homeIsMe ? result.awayScore : result.homeScore;
  const outcome = myScore > oppScore ? "win" : myScore === oppScore ? "draw" : "loss";
  const ticketRevenue = 50_000 + Math.floor(Math.random() * 150_000) * (homeIsMe ? 1 : 0.2);
  await admin.from("clubs").update({ wins: myClub!.wins + (outcome === "win" ? 1 : 0), draws: myClub!.draws + (outcome === "draw" ? 1 : 0), losses: myClub!.losses + (outcome === "loss" ? 1 : 0), balance: myClub!.balance + Math.round(ticketRevenue) }).eq("id", myClub!.id);

  const injuries: { id: string; name: string; type: string; days: number }[] = [];
  const formDelta = outcome === "win" ? 6 : outcome === "draw" ? 1 : -5;
  const starterSet = new Set(starterIds);
  for (const player of ownedPlayers) {
    const played = starterSet.has(player.id);
    const nextFatigue = Math.min(100, Math.max(0, player.fatigue + (played ? 15 + Math.floor(Math.random() * 10) : -4)));
    const update: Record<string, unknown> = { fatigue: nextFatigue, form: Math.max(0, Math.min(100, player.form + (played ? formDelta + Math.floor(Math.random() * 6 - 3) : 0))) };
    if (played && Math.random() < injuryRisk(nextFatigue)) {
      const days = nextFatigue >= 90 ? 10 + Math.floor(Math.random() * 12) : 3 + Math.floor(Math.random() * 7);
      const types = ["Lésion musculaire", "Entorse", "Contusion"];
      const type = types[Math.floor(Math.random() * types.length)];
      update.injured_until = new Date(Date.now() + days * 86_400_000).toISOString();
      update.injury_type = type;
      injuries.push({ id: player.id, name: `${player.first_name} ${player.last_name}`, type, days });
    }
    await admin.from("players").update(update).eq("id", player.id);
  }

  return NextResponse.json({ result, homeIsMe, home: { id: home.id, name: home.name }, away: { id: away.id, name: away.name }, outcome, ticketRevenue: Math.round(ticketRevenue), injuries });
}
