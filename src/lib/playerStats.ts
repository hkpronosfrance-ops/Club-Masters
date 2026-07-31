type MatchEvent = {
  minute: number;
  type: string;
  team: "home" | "away";
  playerName?: string;
  secondaryPlayerName?: string;
};

type Player = {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  position: string;
  overall: number;
  form?: number;
};

type UpdateInput = {
  admin: any;
  seasonId: string;
  homeClubId: string;
  awayClubId: string;
  homePlayers: Player[];
  awayPlayers: Player[];
  homeStarterIds: string[];
  awayStarterIds: string[];
  events: MatchEvent[];
  homeScore: number;
  awayScore: number;
};

const fullName = (player: Player) => `${player.first_name} ${player.last_name}`;

function minutesByPlayer(players: Player[], starterIds: string[], events: MatchEvent[], team: "home" | "away") {
  const result = new Map<string, { appeared: boolean; started: boolean; minutes: number }>();
  const starters = new Set(starterIds);
  for (const player of players) result.set(player.id, { appeared: starters.has(player.id), started: starters.has(player.id), minutes: starters.has(player.id) ? 90 : 0 });

  for (const event of events.filter((item) => item.type === "substitution" && item.team === team)) {
    const incoming = players.find((player) => fullName(player) === event.playerName);
    const outgoing = players.find((player) => fullName(player) === event.secondaryPlayerName);
    if (outgoing) {
      const row = result.get(outgoing.id)!;
      row.minutes = Math.min(row.minutes, Math.max(1, event.minute));
    }
    if (incoming) {
      const row = result.get(incoming.id)!;
      row.appeared = true;
      row.minutes = Math.max(row.minutes, Math.max(1, 90 - event.minute));
    }
  }
  return result;
}

function eventCount(events: MatchEvent[], team: "home" | "away", type: string, name: string, secondary = false) {
  return events.filter((event) => event.team === team && event.type === type && (secondary ? event.secondaryPlayerName : event.playerName) === name).length;
}

function playerRating(player: Player, minutes: number, goals: number, assists: number, yellow: number, red: number, cleanSheet: number, conceded: number) {
  const base = 6 + (Number(player.form ?? 50) - 50) / 100 + (Number(player.overall ?? 60) - 60) / 200;
  const contribution = goals * 0.85 + assists * 0.55 + cleanSheet * (player.position === "GK" ? 0.8 : 0.2) - yellow * 0.15 - red * 0.8 - (player.position === "GK" ? conceded * 0.18 : 0);
  return Math.max(3, Math.min(10, Number((base + contribution + Math.min(0.2, minutes / 450)).toFixed(2))));
}

export async function updatePlayerSeasonStats(input: UpdateInput) {
  const teams = [
    { team: "home" as const, clubId: input.homeClubId, players: input.homePlayers, starters: input.homeStarterIds, scored: input.homeScore, conceded: input.awayScore },
    { team: "away" as const, clubId: input.awayClubId, players: input.awayPlayers, starters: input.awayStarterIds, scored: input.awayScore, conceded: input.homeScore },
  ];

  const rows: Record<string, unknown>[] = [];
  for (const side of teams) {
    const minutes = minutesByPlayer(side.players, side.starters, input.events, side.team);
    for (const player of side.players) {
      const usage = minutes.get(player.id)!;
      if (!usage.appeared) continue;
      const name = fullName(player);
      const goals = eventCount(input.events, side.team, "goal", name);
      const assists = eventCount(input.events, side.team, "goal", name, true);
      const shots = input.events.filter((event) => event.team === side.team && ["goal", "save", "chance_missed"].includes(event.type) && event.playerName === name).length;
      const shotsOnTarget = input.events.filter((event) => event.team === side.team && ["goal", "save"].includes(event.type) && event.playerName === name).length;
      const yellow = eventCount(input.events, side.team, "yellow", name);
      const red = eventCount(input.events, side.team, "red", name);
      const isKeeper = player.position === "GK";
      const cleanSheet = isKeeper && side.conceded === 0 ? 1 : 0;
      const rating = playerRating(player, usage.minutes, goals, assists, yellow, red, cleanSheet, isKeeper ? side.conceded : 0);
      rows.push({
        season_id: input.seasonId,
        player_id: player.id,
        club_id: side.clubId,
        appearances: 1,
        starts: usage.started ? 1 : 0,
        minutes: usage.minutes,
        goals,
        assists,
        shots,
        shots_on_target: shotsOnTarget,
        yellow_cards: yellow,
        red_cards: red,
        clean_sheets: cleanSheet,
        goals_conceded: isKeeper ? side.conceded : 0,
        saves: isKeeper ? input.events.filter((event) => event.type === "save" && event.team !== side.team).length : 0,
        rating_total: rating,
        rating_count: 1,
        updated_at: new Date().toISOString(),
      });
    }
  }

  for (const row of rows) {
    const { data: current } = await input.admin.from("player_season_stats").select("*").eq("season_id", input.seasonId).eq("player_id", row.player_id).maybeSingle();
    if (!current) {
      await input.admin.from("player_season_stats").insert(row);
      continue;
    }
    const additive = ["appearances", "starts", "minutes", "goals", "assists", "shots", "shots_on_target", "yellow_cards", "red_cards", "clean_sheets", "goals_conceded", "saves", "rating_total", "rating_count"];
    const update: Record<string, unknown> = { club_id: row.club_id, updated_at: row.updated_at };
    for (const key of additive) update[key] = Number(current[key] ?? 0) + Number(row[key] ?? 0);
    await input.admin.from("player_season_stats").update(update).eq("id", current.id);
  }

  const candidates = rows.map((row) => ({ ...row, score: Number(row.rating_total) + Number(row.goals) * 0.7 + Number(row.assists) * 0.4 }));
  const man = candidates.sort((a, b) => Number(b.score) - Number(a.score))[0];
  if (man?.player_id) {
    const { data: current } = await input.admin.from("player_season_stats").select("id,man_of_match").eq("season_id", input.seasonId).eq("player_id", man.player_id).maybeSingle();
    if (current) await input.admin.from("player_season_stats").update({ man_of_match: Number(current.man_of_match ?? 0) + 1 }).eq("id", current.id);
  }
}
