import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureAiPool } from "@/lib/aiPool";
import { simulateMatch, type EngineClub, type EnginePlayer } from "@/lib/matchEngine";

function toEngineClub(club: any, players: any[]): EngineClub {
  return {
    id: club.id,
    name: club.name,
    formation: club.formation,
    tactic_style: club.tactic_style,
    mentality: club.mentality,
    players: players as EnginePlayer[],
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  await ensureAiPool();

  const { data: profile } = await admin
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile?.club_id) {
    return NextResponse.json({ error: "Aucun club" }, { status: 400 });
  }

  const { data: myClub } = await admin.from("clubs").select("*").eq("id", profile.club_id).single();
  const { data: myPlayers } = await admin.from("players").select("*").eq("club_id", profile.club_id);

  // Choix d'un adversaire IA de niveau proche (réputation +/- 15)
  const { data: aiCandidates } = await admin
    .from("clubs")
    .select("*")
    .eq("is_ai", true)
    .gte("reputation", (myClub!.reputation ?? 50) - 15)
    .lte("reputation", (myClub!.reputation ?? 50) + 15)
    .limit(20);

  const opponent =
    (aiCandidates && aiCandidates[Math.floor(Math.random() * aiCandidates.length)]) ||
    (await admin.from("clubs").select("*").eq("is_ai", true).limit(1).single()).data;

  const { data: opponentPlayers } = await admin
    .from("players")
    .select("*")
    .eq("club_id", opponent!.id);

  const homeIsMe = Math.random() < 0.5;
  const home = homeIsMe ? toEngineClub(myClub, myPlayers ?? []) : toEngineClub(opponent, opponentPlayers ?? []);
  const away = homeIsMe ? toEngineClub(opponent, opponentPlayers ?? []) : toEngineClub(myClub, myPlayers ?? []);

  const weathers = ["sunny", "rain", "cold"] as const;
  const weather = weathers[Math.floor(Math.random() * weathers.length)];

  const result = simulateMatch(home, away, { weather });

  // Sauvegarde du match
  await admin.from("matches").insert({
    home_club_id: home.id,
    away_club_id: away.id,
    home_score: result.homeScore,
    away_score: result.awayScore,
    events: result.events,
    home_strength: result.homeStrength,
    away_strength: result.awayStrength,
  });

  // Mise à jour du palmarès + finances (billetterie simplifiée) + fatigue/forme
  const myScore = homeIsMe ? result.homeScore : result.awayScore;
  const oppScore = homeIsMe ? result.awayScore : result.homeScore;
  const outcome = myScore > oppScore ? "win" : myScore === oppScore ? "draw" : "loss";

  const ticketRevenue = 50_000 + Math.floor(Math.random() * 150_000) * (homeIsMe ? 1 : 0.2);

  await admin
    .from("clubs")
    .update({
      wins: myClub!.wins + (outcome === "win" ? 1 : 0),
      draws: myClub!.draws + (outcome === "draw" ? 1 : 0),
      losses: myClub!.losses + (outcome === "loss" ? 1 : 0),
      balance: myClub!.balance + Math.round(ticketRevenue),
    })
    .eq("id", myClub!.id);

  // Fatigue +, forme ajustée selon le résultat, pour tous les titulaires (simplifié : tout l'effectif)
  const formDelta = outcome === "win" ? 6 : outcome === "draw" ? 1 : -5;
  for (const p of myPlayers ?? []) {
    await admin
      .from("players")
      .update({
        fatigue: Math.min(100, p.fatigue + 15 + Math.floor(Math.random() * 10)),
        form: Math.max(0, Math.min(100, p.form + formDelta + Math.floor(Math.random() * 6 - 3))),
      })
      .eq("id", p.id);
  }

  return NextResponse.json({
    result,
    homeIsMe,
    home: { id: home.id, name: home.name },
    away: { id: away.id, name: away.name },
    outcome,
    ticketRevenue: Math.round(ticketRevenue),
  });
}
