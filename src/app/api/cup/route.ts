import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRIZES: Record<number, number> = { 1: 250_000, 2: 600_000, 3: 1_500_000 };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function strength(club: any) {
  return Math.max(35, Math.min(95, Number(club?.reputation ?? 50)));
}

function scorePair(home: any, away: any) {
  const homePower = strength(home) + 4;
  const awayPower = strength(away);
  const homeGoals = Math.max(0, Math.round((Math.random() * 2.8) + (homePower - awayPower) / 18));
  const awayGoals = Math.max(0, Math.round((Math.random() * 2.5) + (awayPower - homePower) / 18));
  return [Math.min(homeGoals, 6), Math.min(awayGoals, 6)];
}

async function userClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function ensureCompetition() {
  const admin = createAdminClient();
  const { data: active } = await admin.from("cup_competitions").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (active) return active;

  const { data: season } = await admin.from("seasons").select("id,name").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: clubs } = await admin.from("clubs").select("id,name,reputation").order("reputation", { ascending: false }).limit(8);
  if (!clubs || clubs.length < 8) throw new Error("Il faut au moins 8 clubs pour créer la coupe.");

  const { data: competition, error } = await admin.from("cup_competitions").insert({ season_id: season?.id ?? null, name: "Coupe Nationale", current_round: 1 }).select("*").single();
  if (error) throw error;

  const draw = shuffle(clubs);
  const fixtures = Array.from({ length: 4 }, (_, index) => ({
    competition_id: competition.id,
    round: 1,
    match_order: index + 1,
    home_club_id: draw[index * 2].id,
    away_club_id: draw[index * 2 + 1].id,
  }));
  await admin.from("cup_matches").insert(fixtures);
  return competition;
}

async function cupPayload() {
  const admin = createAdminClient();
  const competition = await ensureCompetition();
  const { data: matches } = await admin.from("cup_matches").select("*,home:clubs!cup_matches_home_club_id_fkey(id,name,reputation),away:clubs!cup_matches_away_club_id_fkey(id,name,reputation),winner:clubs!cup_matches_winner_club_id_fkey(id,name)").eq("competition_id", competition.id).order("round").order("match_order");
  return { competition, matches: matches ?? [], prizes: PRIZES };
}

export async function GET() {
  const clubId = await userClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  try {
    return NextResponse.json(await cupPayload());
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Impossible de charger la coupe." }, { status: 500 });
  }
}

export async function POST() {
  const clubId = await userClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();

  try {
    const { competition, matches } = await cupPayload();
    const pending = matches.find((match: any) => !match.played && match.home_club_id && match.away_club_id);
    if (!pending) return NextResponse.json({ error: competition.status === "finished" ? "La coupe est terminée." : "Aucun match disponible." }, { status: 400 });

    let [homeScore, awayScore] = scorePair(pending.home, pending.away);
    let extraTime = false;
    let homePenalties: number | null = null;
    let awayPenalties: number | null = null;
    let winnerId: string;

    if (homeScore === awayScore) {
      extraTime = true;
      if (Math.random() < 0.45) {
        if (Math.random() < 0.5) homeScore += 1; else awayScore += 1;
      }
    }
    if (homeScore === awayScore) {
      homePenalties = 3 + Math.floor(Math.random() * 3);
      awayPenalties = 3 + Math.floor(Math.random() * 3);
      while (homePenalties === awayPenalties) {
        if (Math.random() < 0.5) homePenalties += 1; else awayPenalties += 1;
      }
      winnerId = homePenalties > awayPenalties ? pending.home_club_id : pending.away_club_id;
    } else {
      winnerId = homeScore > awayScore ? pending.home_club_id : pending.away_club_id;
    }

    await admin.from("cup_matches").update({ home_score: homeScore, away_score: awayScore, extra_time: extraTime, home_penalties: homePenalties, away_penalties: awayPenalties, winner_club_id: winnerId, played: true, played_at: new Date().toISOString() }).eq("id", pending.id);

    await admin.from("clubs").update({ balance: (winnerId === pending.home_club_id ? pending.home : pending.away).balance }).eq("id", winnerId);
    const { data: winnerClub } = await admin.from("clubs").select("balance,reputation").eq("id", winnerId).single();
    await admin.from("clubs").update({ balance: Number(winnerClub?.balance ?? 0) + PRIZES[pending.round], reputation: Math.min(100, Number(winnerClub?.reputation ?? 50) + pending.round) }).eq("id", winnerId);

    if ([pending.home_club_id, pending.away_club_id].includes(clubId)) {
      const { data: squad } = await admin.from("players").select("id,fatigue").eq("club_id", clubId);
      for (const player of squad ?? []) {
        await admin.from("players").update({ fatigue: Math.min(100, Number(player.fatigue ?? 0) + 7) }).eq("id", player.id);
      }
    }

    const roundMatches = matches.filter((match: any) => match.round === pending.round);
    const remainingAfter = roundMatches.filter((match: any) => !match.played && match.id !== pending.id);
    if (remainingAfter.length === 0) {
      const winners = [...roundMatches.filter((match: any) => match.played).map((match: any) => match.winner_club_id), winnerId];
      if (pending.round < 3) {
        const nextRound = pending.round + 1;
        const nextFixtures = Array.from({ length: winners.length / 2 }, (_, index) => ({ competition_id: competition.id, round: nextRound, match_order: index + 1, home_club_id: winners[index * 2], away_club_id: winners[index * 2 + 1] }));
        await admin.from("cup_matches").insert(nextFixtures);
        await admin.from("cup_competitions").update({ current_round: nextRound }).eq("id", competition.id);
      } else {
        const { data: season } = await admin.from("seasons").select("name").eq("id", competition.season_id).maybeSingle();
        const { data: champion } = await admin.from("clubs").select("reputation").eq("id", winnerId).single();
        await admin.from("cup_competitions").update({ status: "finished", champion_club_id: winnerId, finished_at: new Date().toISOString() }).eq("id", competition.id);
        await admin.from("clubs").update({ reputation: Math.min(100, Number(champion?.reputation ?? 50) + 5) }).eq("id", winnerId);
        await admin.from("club_trophies").upsert({ club_id: winnerId, competition_name: competition.name, season_name: season?.name ?? "Saison actuelle" });
      }
    }

    return NextResponse.json(await cupPayload());
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "La simulation a échoué." }, { status: 500 });
  }
}
