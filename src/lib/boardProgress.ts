export function seasonObjective(reputation: number, clubCount: number) {
  if (reputation >= 80) return { code: "title", label: "Remporter le titre", target: 1 };
  if (reputation >= 65) return { code: "top3", label: "Terminer dans le top 3", target: Math.min(3, clubCount) };
  if (reputation >= 50) return { code: "top5", label: "Terminer dans le top 5", target: Math.min(5, clubCount) };
  return { code: "survival", label: "Éviter les deux dernières places", target: Math.max(1, clubCount - 2) };
}

export async function updateBoardProgress(admin: any, season: any, club: any, outcome: "win" | "draw" | "loss", seasonFinished: boolean) {
  const { data: rows } = await admin.from("season_clubs").select("*").eq("season_id", season.id);
  const standings = [...(rows ?? [])].sort((a: any, b: any) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) || b.goals_for - a.goals_for);
  const position = standings.findIndex((row: any) => row.club_id === club.id) + 1;
  const target = season.target_position ?? seasonObjective(club.reputation ?? 50, standings.length || 10).target;
  const onTrack = position > 0 && position <= target;
  const resultDelta = outcome === "win" ? 6 : outcome === "draw" ? 1 : -5;
  const positionDelta = onTrack ? 2 : -2;
  const confidence = Math.max(0, Math.min(100, (season.board_confidence ?? 60) + resultDelta + positionDelta));
  const updates: Record<string, unknown> = { board_confidence: confidence };

  if (seasonFinished) {
    const objectiveMet = position > 0 && position <= target;
    const finalBonus = objectiveMet ? (position === 1 ? 3_000_000 : position <= 3 ? 1_800_000 : 900_000) : 0;
    const reputationDelta = objectiveMet ? (position === 1 ? 8 : 4) : -3;
    updates.final_position = position;
    updates.final_bonus = finalBonus;
    updates.objective_met = objectiveMet;
    updates.reward_claimed = true;
    updates.season_summary = { position, points: standings[position - 1]?.points ?? 0, wins: standings[position - 1]?.wins ?? 0, draws: standings[position - 1]?.draws ?? 0, losses: standings[position - 1]?.losses ?? 0 };
    await admin.from("clubs").update({ balance: club.balance + finalBonus, reputation: Math.max(0, Math.min(100, (club.reputation ?? 50) + reputationDelta)) }).eq("id", club.id);
  }

  await admin.from("seasons").update(updates).eq("id", season.id);
  return { confidence, position, target, objectiveMet: updates.objective_met ?? null, finalBonus: updates.final_bonus ?? 0 };
}
