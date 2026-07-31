import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CONFIG = {
  champions_league: { name: "Ligue des Champions", prizes: { 1: 1_000_000, 2: 2_500_000, 3: 7_500_000 }, reputation: 7 },
  europa_league: { name: "Ligue Europa", prizes: { 1: 500_000, 2: 1_250_000, 3: 3_500_000 }, reputation: 4 },
} as const;

type CompetitionCode = keyof typeof CONFIG;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function simulate(home: any, away: any) {
  const homePower = Number(home.reputation ?? 50) + 3;
  const awayPower = Number(away.reputation ?? 50);
  let homeScore = Math.max(0, Math.min(6, Math.round(Math.random() * 2.8 + (homePower - awayPower) / 20)));
  let awayScore = Math.max(0, Math.min(6, Math.round(Math.random() * 2.6 + (awayPower - homePower) / 20)));
  let extraTime = false;
  let homePenalties: number | null = null;
  let awayPenalties: number | null = null;

  if (homeScore === awayScore) {
    extraTime = true;
    if (Math.random() < 0.5) Math.random() < 0.5 ? homeScore++ : awayScore++;
  }
  if (homeScore === awayScore) {
    homePenalties = 3 + Math.floor(Math.random() * 3);
    awayPenalties = 3 + Math.floor(Math.random() * 3);
    while (homePenalties === awayPenalties) Math.random() < 0.5 ? homePenalties++ : awayPenalties++;
  }
  const winnerId = homeScore !== awayScore
    ? (homeScore > awayScore ? home.id : away.id)
    : ((homePenalties ?? 0) > (awayPenalties ?? 0) ? home.id : away.id);
  return { homeScore, awayScore, extraTime, homePenalties, awayPenalties, winnerId };
}

async function currentUserClub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return data?.club_id ?? null;
}

async function ensureCompetition(code: CompetitionCode) {
  const admin = createAdminClient();
  const { data: current } = await admin.from("european_competitions").select("*").eq("code", code).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (current) return current;

  const { data: season } = await admin.from("seasons").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: clubs } = await admin.from("clubs").select("id,name,reputation,balance").order("reputation", { ascending: false }).limit(16);
  if (!clubs || clubs.length < 8) throw new Error("Il faut au moins 8 clubs pour lancer une compétition européenne.");

  const pool = code === "champions_league" ? clubs.slice(0, 8) : (clubs.length >= 16 ? clubs.slice(8, 16) : shuffle(clubs).slice(0, 8));
  const { data: competition, error } = await admin.from("european_competitions").insert({ season_id: season?.id ?? null, code, name: CONFIG[code].name }).select("*").single();
  if (error) throw error;

  const draw = shuffle(pool);
  await admin.from("european_matches").insert(Array.from({ length: 4 }, (_, index) => ({
    competition_id: competition.id,
    round: 1,
    match_order: index + 1,
    home_club_id: draw[index * 2].id,
    away_club_id: draw[index * 2 + 1].id,
  })));
  return competition;
}

async function payload(code: CompetitionCode) {
  const admin = createAdminClient();
  const competition = await ensureCompetition(code);
  const { data: matches } = await admin.from("european_matches").select("*,home:clubs!european_matches_home_club_id_fkey(id,name,reputation),away:clubs!european_matches_away_club_id_fkey(id,name,reputation),winner:clubs!european_matches_winner_club_id_fkey(id,name)").eq("competition_id", competition.id).order("round").order("match_order");
  return { competition, matches: matches ?? [], prizes: CONFIG[code].prizes };
}

export async function GET(req: Request) {
  if (!await currentUserClub()) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code") as CompetitionCode || "champions_league";
  if (!CONFIG[code]) return NextResponse.json({ error: "Compétition invalide." }, { status: 400 });
  try { return NextResponse.json(await payload(code)); }
  catch (error: any) { return NextResponse.json({ error: error.message ?? "Chargement impossible." }, { status: 500 }); }
}

export async function POST(req: Request) {
  const clubId = await currentUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code") as CompetitionCode || "champions_league";
  if (!CONFIG[code]) return NextResponse.json({ error: "Compétition invalide." }, { status: 400 });
  const admin = createAdminClient();

  try {
    const { competition, matches } = await payload(code);
    const pending = matches.find((match: any) => !match.played);
    if (!pending) return NextResponse.json({ error: "Aucun match à simuler." }, { status: 400 });

    const result = simulate(pending.home, pending.away);
    await admin.from("european_matches").update({
      home_score: result.homeScore, away_score: result.awayScore, extra_time: result.extraTime,
      home_penalties: result.homePenalties, away_penalties: result.awayPenalties,
      winner_club_id: result.winnerId, played: true, played_at: new Date().toISOString(),
    }).eq("id", pending.id);

    const { data: winner } = await admin.from("clubs").select("balance,reputation").eq("id", result.winnerId).single();
    await admin.from("clubs").update({
      balance: Number(winner?.balance ?? 0) + CONFIG[code].prizes[pending.round as 1 | 2 | 3],
      reputation: Math.min(100, Number(winner?.reputation ?? 50) + pending.round),
    }).eq("id", result.winnerId);

    if ([pending.home_club_id, pending.away_club_id].includes(clubId)) {
      const { data: squad } = await admin.from("players").select("id,fatigue").eq("club_id", clubId);
      await Promise.all((squad ?? []).map((player: any) => admin.from("players").update({ fatigue: Math.min(100, Number(player.fatigue ?? 0) + 9) }).eq("id", player.id)));
    }

    const roundMatches = matches.filter((match: any) => match.round === pending.round);
    const remaining = roundMatches.filter((match: any) => !match.played && match.id !== pending.id);
    if (remaining.length === 0) {
      const winners = [...roundMatches.filter((match: any) => match.played).map((match: any) => match.winner_club_id), result.winnerId];
      if (pending.round < 3) {
        const nextRound = pending.round + 1;
        await admin.from("european_matches").insert(Array.from({ length: winners.length / 2 }, (_, index) => ({ competition_id: competition.id, round: nextRound, match_order: index + 1, home_club_id: winners[index * 2], away_club_id: winners[index * 2 + 1] })));
        await admin.from("european_competitions").update({ current_round: nextRound }).eq("id", competition.id);
      } else {
        await admin.from("european_competitions").update({ status: "finished", champion_club_id: result.winnerId, finished_at: new Date().toISOString() }).eq("id", competition.id);
        const { data: champion } = await admin.from("clubs").select("reputation").eq("id", result.winnerId).single();
        await admin.from("clubs").update({ reputation: Math.min(100, Number(champion?.reputation ?? 50) + CONFIG[code].reputation) }).eq("id", result.winnerId);
        await admin.from("club_trophies").insert({ club_id: result.winnerId, competition_name: CONFIG[code].name, season_name: "Saison actuelle" });
      }
    }

    return NextResponse.json(await payload(code));
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Simulation impossible." }, { status: 500 });
  }
}
