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

type StatsRow = {
  season_id: string;
  player_id: string;
  club_id: string;
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number;
  goals_conceded: number;
  saves: number;
  man_of_match?: number;
  rating_total: number;
  rating_count: number;
  updated_at: string;
  [key: string]: string | number | undefined;
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
    { team: "home" as const, clubId: input.homeClubId, players: input.homePlayers, starters: input.homeStarterIds, conceded: input.awayScore },
    { team: "away" as const, clubId: input.awayClubId, players: input.awayPlayers, starters: input.awayStarterIds, conceded: input.homeScore },
  ];

  const rows: StatsRow[] = [];
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
        man_of_match: 0,
        rating_total: rating,
        rating_count: 1,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (!rows.length) return;

  const playerIds = rows.map((row) => row.player_id);
  const { data: currentRows, error: readError } = await input.admin
    .from("player_season_stats")
    .select("*")
    .eq("season_id", input.seasonId)
    .in("player_id", playerIds);
  if (readError) throw readError;

  const currentByPlayer = new Map((currentRows ?? []).map((row: any) => [row.player_id, row]));
  const additive = ["appearances", "starts", "minutes", "goals", "assists", "shots", "shots_on_target", "yellow_cards", "red_cards", "clean_sheets", "goals_conceded", "saves", "rating_total", "rating_count"] as const;

  const candidates = rows.map((row) => ({ ...row, score: Number(row.rating_total) + Number(row.goals) * 0.7 + Number(row.assists) * 0.4 }));
  const man = candidates.sort((a, b) => Number(b.score) - Number(a.score))[0];

  const mergedRows = rows.map((row) => {
    const current = currentByPlayer.get(row.player_id) as Record<string, unknown> | undefined;
    const merged: StatsRow = { ...row };
    for (const key of additive) merged[key] = Number(current?.[key] ?? 0) + Number(row[key] ?? 0);
    merged.man_of_match = Number(current?.man_of_match ?? 0) + (row.player_id === man?.player_id ? 1 : 0);
    return merged;
  });

  const { error: upsertError } = await input.admin
    .from("player_season_stats")
    .upsert(mergedRows, { onConflict: "season_id,player_id" });
  if (upsertError) throw upsertError;
}
