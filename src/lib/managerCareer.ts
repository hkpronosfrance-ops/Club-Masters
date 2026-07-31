type Outcome = "win" | "draw" | "loss";

function reputationDelta(outcome: Outcome, opponentReputation: number, clubReputation: number) {
  const difficulty = Math.max(-12, Math.min(12, opponentReputation - clubReputation));
  if (outcome === "win") return Math.max(1, Math.round(2 + difficulty / 8));
  if (outcome === "draw") return difficulty >= 5 ? 1 : 0;
  return difficulty <= -6 ? -2 : -1;
}

function careerScore(matches: number, wins: number, draws: number, trophies: number, reputation: number) {
  return Math.max(0, Math.round(wins * 3 + draws + trophies * 35 + reputation * 2 - Math.max(0, matches - wins - draws)));
}

export async function awardManagerTrophy(
  admin: any,
  params: {
    userId: string;
    clubId: string;
    trophyType: string;
    trophyName: string;
    season: string;
    reputationBonus: number;
  },
) {
  const { data: manager } = await admin.from("manager_profiles").select("*").eq("user_id", params.userId).maybeSingle();
  if (!manager || manager.current_club_id !== params.clubId) return null;

  const { data: existing } = await admin
    .from("manager_trophies")
    .select("id")
    .eq("manager_id", manager.id)
    .eq("club_id", params.clubId)
    .eq("trophy_type", params.trophyType)
    .eq("season", params.season)
    .maybeSingle();
  if (existing) return null;

  const { data: trophy, error } = await admin.from("manager_trophies").insert({
    manager_id: manager.id,
    club_id: params.clubId,
    trophy_type: params.trophyType,
    trophy_name: params.trophyName,
    season: params.season,
  }).select("*").single();
  if (error) throw error;

  const trophies = Number(manager.trophies ?? 0) + 1;
  const reputation = Math.min(100, Number(manager.reputation ?? 10) + params.reputationBonus);
  await admin.from("manager_profiles").update({
    trophies,
    reputation,
    career_score: careerScore(Number(manager.matches ?? 0), Number(manager.wins ?? 0), Number(manager.draws ?? 0), trophies, reputation),
    updated_at: new Date().toISOString(),
  }).eq("id", manager.id);

  const { data: history } = await admin
    .from("manager_career_history")
    .select("id,trophies")
    .eq("manager_id", manager.id)
    .eq("club_id", params.clubId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (history) await admin.from("manager_career_history").update({ trophies: Number(history.trophies ?? 0) + 1 }).eq("id", history.id);

  await admin.from("world_news").insert({
    club_id: params.clubId,
    category: "competition",
    importance: 5,
    title: `${params.trophyName} remporté !`,
    body: `${manager.display_name} ajoute un nouveau trophée à son palmarès avec son club.`,
  });
  return trophy;
}

export async function recordManagerMatch(
  admin: any,
  params: {
    userId: string;
    clubId: string;
    outcome: Outcome;
    opponentReputation?: number;
    clubReputation?: number;
    seasonId?: string;
    seasonFinished?: boolean;
  },
) {
  const { data: manager } = await admin.from("manager_profiles").select("*").eq("user_id", params.userId).maybeSingle();
  if (!manager) return null;

  const matches = Number(manager.matches ?? 0) + 1;
  const wins = Number(manager.wins ?? 0) + (params.outcome === "win" ? 1 : 0);
  const draws = Number(manager.draws ?? 0) + (params.outcome === "draw" ? 1 : 0);
  const losses = Number(manager.losses ?? 0) + (params.outcome === "loss" ? 1 : 0);
  const reputation = Math.max(0, Math.min(100, Number(manager.reputation ?? 10) + reputationDelta(params.outcome, Number(params.opponentReputation ?? 50), Number(params.clubReputation ?? 50))));
  const update = { matches, wins, draws, losses, reputation, career_score: careerScore(matches, wins, draws, Number(manager.trophies ?? 0), reputation), updated_at: new Date().toISOString() };
  await admin.from("manager_profiles").update(update).eq("id", manager.id);

  const { data: activeHistory } = await admin.from("manager_career_history").select("*").eq("manager_id", manager.id).eq("club_id", params.clubId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (activeHistory) {
    await admin.from("manager_career_history").update({
      matches: Number(activeHistory.matches ?? 0) + 1,
      wins: Number(activeHistory.wins ?? 0) + (params.outcome === "win" ? 1 : 0),
      draws: Number(activeHistory.draws ?? 0) + (params.outcome === "draw" ? 1 : 0),
      losses: Number(activeHistory.losses ?? 0) + (params.outcome === "loss" ? 1 : 0),
    }).eq("id", activeHistory.id);
  }

  let trophy = null;
  if (params.seasonFinished && params.seasonId) {
    const { data: standings } = await admin.from("season_clubs").select("club_id,points,goals_for,goals_against").eq("season_id", params.seasonId).order("points", { ascending: false });
    const ranked = [...(standings ?? [])].sort((a: any, b: any) => {
      const points = Number(b.points ?? 0) - Number(a.points ?? 0);
      if (points !== 0) return points;
      const bDiff = Number(b.goals_for ?? 0) - Number(b.goals_against ?? 0);
      const aDiff = Number(a.goals_for ?? 0) - Number(a.goals_against ?? 0);
      if (bDiff !== aDiff) return bDiff - aDiff;
      return Number(b.goals_for ?? 0) - Number(a.goals_for ?? 0);
    });
    if (ranked[0]?.club_id === params.clubId) {
      trophy = await awardManagerTrophy(admin, {
        userId: params.userId,
        clubId: params.clubId,
        trophyType: "league",
        trophyName: "Championnat national",
        season: String(new Date().getFullYear()),
        reputationBonus: 8,
      });
    }
  }
  return { ...update, trophy };
}
