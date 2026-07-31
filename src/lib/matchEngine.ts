import { FORMATION_SLOTS, type Position } from "./playerGenerator";

export interface EnginePlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: Position;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  morale: number;
  fatigue: number;
  form: number;
}

export interface EngineClub {
  id: string;
  name: string;
  formation: string;
  tactic_style: "offensif" | "defensif" | "possession" | "contre" | "balanced";
  mentality: number;
  players: EnginePlayer[];
}

export type MatchEventType =
  | "kickoff"
  | "goal"
  | "chance"
  | "chance_missed"
  | "save"
  | "yellow"
  | "red"
  | "corner"
  | "free_kick"
  | "penalty"
  | "offside"
  | "injury"
  | "substitution"
  | "tactical_change"
  | "half_time"
  | "full_time";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: "home" | "away";
  playerName: string;
  secondaryPlayerName?: string;
  commentary: string;
  xg?: number;
}

export interface TeamMatchStats {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  corners: number;
  fouls: number;
  offsides: number;
  yellowCards: number;
  redCards: number;
  passAccuracy: number;
}

export interface TacticalReaction {
  minute: number;
  team: "home" | "away";
  from: EngineClub["tactic_style"];
  to: EngineClub["tactic_style"];
  reason: string;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  homeStrength: number;
  awayStrength: number;
  events: MatchEvent[];
  stats: { home: TeamMatchStats; away: TeamMatchStats };
  tacticalReactions: TacticalReaction[];
  weather: "sunny" | "rain" | "cold";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(players: EnginePlayer[], key: keyof EnginePlayer) {
  if (!players.length) return 50;
  return players.reduce((sum, player) => sum + Number(player[key] ?? 0), 0) / players.length;
}

function effectiveRating(player: EnginePlayer, minute = 0) {
  const matchFatigue = minute / 90 * 0.14;
  const fatiguePenalty = 1 - player.fatigue / 100 * 0.3 - matchFatigue;
  const moraleFactor = 0.85 + player.morale / 100 * 0.3;
  const formFactor = 0.8 + player.form / 100 * 0.4;
  return player.overall * clamp(fatiguePenalty, 0.48, 1) * moraleFactor * formFactor;
}

function selectStartingXI(club: EngineClub): EnginePlayer[] {
  if (club.players.length <= 11) return [...club.players];
  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS["4-3-3"];
  const pool = [...club.players];
  const eleven: EnginePlayer[] = [];
  for (const slot of slots) {
    const exact = pool.filter((player) => player.position === slot).sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
    const selected = exact ?? pool.sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
    if (selected) {
      eleven.push(selected);
      pool.splice(pool.indexOf(selected), 1);
    }
  }
  return eleven.slice(0, 11);
}

const MODIFIERS: Record<EngineClub["tactic_style"], { attack: number; defense: number; possession: number; tempo: number; discipline: number }> = {
  offensif: { attack: 1.16, defense: 0.9, possession: 1, tempo: 1.15, discipline: 0.94 },
  defensif: { attack: 0.84, defense: 1.17, possession: 0.91, tempo: 0.82, discipline: 1.08 },
  possession: { attack: 1.04, defense: 1.02, possession: 1.18, tempo: 0.94, discipline: 1.04 },
  contre: { attack: 1.05, defense: 1.06, possession: 0.86, tempo: 1.12, discipline: 0.98 },
  balanced: { attack: 1, defense: 1, possession: 1, tempo: 1, discipline: 1 },
};

function unitRatings(club: EngineClub, eleven: EnginePlayer[], minute: number, style: EngineClub["tactic_style"]) {
  const attackers = eleven.filter((player) => ["BU", "AG", "AD", "MOC"].includes(player.position));
  const midfielders = eleven.filter((player) => ["MC", "MDC", "MOC"].includes(player.position));
  const defenders = eleven.filter((player) => ["DC", "DL", "DR", "GK"].includes(player.position));
  const mod = MODIFIERS[style];
  const energy = average(eleven, "fatigue") / 100;
  const minuteDecay = minute / 90 * (0.08 + energy * 0.09);
  const mentalityShift = (club.mentality - 50) / 100;
  const attack = (average(attackers, "shooting") * 0.42 + average(midfielders, "passing") * 0.34 + average(eleven, "pace") * 0.24) * mod.attack * (1 + mentalityShift * 0.2) * (1 - minuteDecay);
  const defense = (average(defenders, "defending") * 0.55 + average(midfielders, "defending") * 0.23 + average(eleven, "physical") * 0.22) * mod.defense * (1 - mentalityShift * 0.14) * (1 - minuteDecay * 0.8);
  const control = (average(midfielders, "passing") * 0.55 + average(eleven, "overall") * 0.25 + average(eleven, "physical") * 0.2) * mod.possession * (1 - minuteDecay * 0.65);
  return { attack, defense, control, attackers, midfielders, defenders, tempo: mod.tempo, discipline: mod.discipline };
}

function weightedPlayer(players: EnginePlayer[], key: "shooting" | "passing" | "defending" | "overall") {
  if (!players.length) return undefined;
  const total = players.reduce((sum, player) => sum + Math.max(1, Number(player[key])), 0);
  let roll = Math.random() * total;
  for (const player of players) {
    roll -= Math.max(1, Number(player[key]));
    if (roll <= 0) return player;
  }
  return players[players.length - 1];
}

function name(player?: EnginePlayer) {
  return player ? `${player.first_name} ${player.last_name}` : "Joueur inconnu";
}

function emptyStats(): TeamMatchStats {
  return { possession: 50, shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, fouls: 0, offsides: 0, yellowCards: 0, redCards: 0, passAccuracy: 0 };
}

export function simulateMatch(home: EngineClub, away: EngineClub, options: { weather?: "sunny" | "rain" | "cold"; neutralVenue?: boolean } = {}): MatchResult {
  const weather = options.weather ?? "sunny";
  const homeXI = selectStartingXI(home);
  const awayXI = selectStartingXI(away);
  const events: MatchEvent[] = [{ minute: 1, type: "kickoff", team: "home", playerName: "", commentary: "Coup d’envoi de la rencontre." }];
  const tacticalReactions: TacticalReaction[] = [];
  const stats = { home: emptyStats(), away: emptyStats() };
  let homeScore = 0;
  let awayScore = 0;
  let homeStyle = home.tactic_style;
  let awayStyle = away.tactic_style;
  let homePasses = 0;
  let awayPasses = 0;
  let homeCompleted = 0;
  let awayCompleted = 0;
  let homeControlTotal = 0;
  let awayControlTotal = 0;

  const react = (minute: number, team: "home" | "away", scoreFor: number, scoreAgainst: number) => {
    const current = team === "home" ? homeStyle : awayStyle;
    let next = current;
    let reason = "";
    if (minute >= 60 && scoreFor < scoreAgainst && current !== "offensif") { next = "offensif"; reason = "L’équipe doit revenir au score."; }
    else if (minute >= 72 && scoreFor > scoreAgainst && current !== "defensif") { next = "defensif"; reason = "L’équipe cherche à protéger son avantage."; }
    else if (minute >= 55 && scoreFor === scoreAgainst && current === "defensif") { next = "balanced"; reason = "Le staff veut reprendre le contrôle du match."; }
    if (next !== current) {
      if (team === "home") homeStyle = next; else awayStyle = next;
      tacticalReactions.push({ minute, team, from: current, to: next, reason });
      events.push({ minute, type: "tactical_change", team, playerName: "Entraîneur", commentary: `${team === "home" ? home.name : away.name} passe en style ${next}. ${reason}` });
    }
  };

  for (let minute = 1; minute <= 90; minute++) {
    if (minute === 46) events.push({ minute: 45, type: "half_time", team: "home", playerName: "", commentary: `Mi-temps : ${home.name} ${homeScore}-${awayScore} ${away.name}.` });
    if ([55, 60, 65, 72, 78, 84].includes(minute)) {
      react(minute, "home", homeScore, awayScore);
      react(minute, "away", awayScore, homeScore);
    }

    const homeUnits = unitRatings(home, homeXI, minute, homeStyle);
    const awayUnits = unitRatings(away, awayXI, minute, awayStyle);
    const homeAdvantage = options.neutralVenue ? 1 : 1.055;
    homeControlTotal += homeUnits.control * homeAdvantage;
    awayControlTotal += awayUnits.control;

    const minutePossession = homeUnits.control * homeAdvantage / Math.max(1, homeUnits.control * homeAdvantage + awayUnits.control);
    const homeHasBall = Math.random() < minutePossession;
    const attackingClub = homeHasBall ? home : away;
    const attackUnits = homeHasBall ? homeUnits : awayUnits;
    const defenseUnits = homeHasBall ? awayUnits : homeUnits;
    const attackingPlayers = homeHasBall ? homeXI : awayXI;
    const defendingPlayers = homeHasBall ? awayXI : homeXI;
    const teamStats = homeHasBall ? stats.home : stats.away;
    const opponentStats = homeHasBall ? stats.away : stats.home;
    const team: "home" | "away" = homeHasBall ? "home" : "away";

    const passes = 3 + Math.floor(Math.random() * 5 * MODIFIERS[homeHasBall ? homeStyle : awayStyle].possession);
    const accuracy = clamp((average(attackingPlayers, "passing") + average(attackingPlayers, "form") * 0.1 - (weather === "rain" ? 5 : 0)) / 100, 0.55, 0.94);
    const completed = Array.from({ length: passes }).filter(() => Math.random() < accuracy).length;
    if (homeHasBall) { homePasses += passes; homeCompleted += completed; } else { awayPasses += passes; awayCompleted += completed; }

    const foulProbability = 0.018 * (2 - attackUnits.discipline) * (weather === "rain" ? 1.18 : 1);
    if (Math.random() < foulProbability) {
      opponentStats.fouls += 1;
      const offender = weightedPlayer(defendingPlayers.filter((player) => player.position !== "GK"), "defending");
      const dangerous = Math.random() < 0.22;
      const cardRoll = Math.random();
      if (cardRoll < 0.035) {
        opponentStats.redCards += 1;
        events.push({ minute, type: "red", team: homeHasBall ? "away" : "home", playerName: name(offender), commentary: `${name(offender)} est expulsé après une intervention très dangereuse.` });
      } else if (cardRoll < 0.3) {
        opponentStats.yellowCards += 1;
        events.push({ minute, type: "yellow", team: homeHasBall ? "away" : "home", playerName: name(offender), commentary: `Carton jaune pour ${name(offender)}.` });
      }
      if (dangerous) events.push({ minute, type: "free_kick", team, playerName: name(weightedPlayer(attackingPlayers, "shooting")), commentary: `Coup franc intéressant pour ${attackingClub.name}.` });
    }

    const attackChance = clamp((attackUnits.attack / Math.max(45, defenseUnits.defense)) * 0.034 * attackUnits.tempo, 0.012, 0.095);
    if (Math.random() >= attackChance) continue;

    if (Math.random() < 0.08) {
      teamStats.offsides += 1;
      const runner = weightedPlayer(attackUnits.attackers, "pace" as "overall");
      events.push({ minute, type: "offside", team, playerName: name(runner), commentary: `${name(runner)} est signalé hors-jeu.` });
      continue;
    }

    const shooter = weightedPlayer(attackUnits.attackers.length ? attackUnits.attackers : attackingPlayers, "shooting");
    const creator = weightedPlayer(attackUnits.midfielders.length ? attackUnits.midfielders : attackingPlayers, "passing");
    const goalkeeper = defendingPlayers.find((player) => player.position === "GK");
    const shotQuality = clamp((Number(shooter?.shooting ?? 55) * 0.48 + Number(creator?.passing ?? 55) * 0.18 + attackUnits.attack * 0.22 - defenseUnits.defense * 0.18 + Math.random() * 25) / 100, 0.04, 0.72);
    const penalty = Math.random() < 0.025;
    const xg = penalty ? 0.76 : clamp(shotQuality * (0.12 + Math.random() * 0.35), 0.03, 0.62);
    teamStats.shots += 1;
    teamStats.xg += xg;
    const onTarget = Math.random() < clamp(0.34 + Number(shooter?.shooting ?? 50) / 220, 0.38, 0.78);

    if (penalty) events.push({ minute, type: "penalty", team, playerName: name(shooter), commentary: `Penalty accordé à ${attackingClub.name} !`, xg });
    else if (Math.random() < 0.13) { teamStats.corners += 1; events.push({ minute, type: "corner", team, playerName: name(creator), commentary: `Corner obtenu par ${attackingClub.name}.` }); }

    if (!onTarget) {
      events.push({ minute, type: "chance_missed", team, playerName: name(shooter), secondaryPlayerName: name(creator), commentary: `${name(shooter)} manque le cadre après une passe de ${name(creator)}.`, xg });
      continue;
    }

    teamStats.shotsOnTarget += 1;
    const keeperSkill = Number(goalkeeper?.overall ?? 58) * 0.55 + Number(goalkeeper?.form ?? 50) * 0.16;
    const goalProbability = penalty ? 0.76 : clamp(xg * 1.45 + Number(shooter?.shooting ?? 50) / 500 - keeperSkill / 520, 0.08, 0.68);
    if (Math.random() < goalProbability) {
      if (homeHasBall) homeScore += 1; else awayScore += 1;
      events.push({ minute, type: "goal", team, playerName: name(shooter), secondaryPlayerName: name(creator), commentary: `BUT ! ${name(shooter)} conclut l’action de ${attackingClub.name}.`, xg });
    } else {
      events.push({ minute, type: "save", team: homeHasBall ? "away" : "home", playerName: name(goalkeeper), secondaryPlayerName: name(shooter), commentary: `${name(goalkeeper)} repousse la tentative de ${name(shooter)}.`, xg });
    }
  }

  const totalControl = homeControlTotal + awayControlTotal;
  stats.home.possession = Math.round(homeControlTotal / totalControl * 100);
  stats.away.possession = 100 - stats.home.possession;
  stats.home.passAccuracy = Math.round(homeCompleted / Math.max(1, homePasses) * 100);
  stats.away.passAccuracy = Math.round(awayCompleted / Math.max(1, awayPasses) * 100);
  stats.home.xg = Number(stats.home.xg.toFixed(2));
  stats.away.xg = Number(stats.away.xg.toFixed(2));
  events.push({ minute: 90, type: "full_time", team: "home", playerName: "", commentary: `Score final : ${home.name} ${homeScore}-${awayScore} ${away.name}.` });
  events.sort((a, b) => a.minute - b.minute);

  const initialHome = unitRatings(home, homeXI, 0, home.tactic_style);
  const initialAway = unitRatings(away, awayXI, 0, away.tactic_style);
  return {
    homeScore,
    awayScore,
    homeStrength: Math.round(initialHome.attack + initialHome.defense),
    awayStrength: Math.round(initialAway.attack + initialAway.defense),
    events,
    stats,
    tacticalReactions,
    weather,
  };
}
