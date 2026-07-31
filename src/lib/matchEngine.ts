// ============================================================
// MATCH ENGINE — MVP
// Simule un match à partir de deux effectifs + tactiques.
// Volontairement transparent : chaque coefficient est commenté
// pour pouvoir être retravaillé (cf GDD §4).
// ============================================================

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
  mentality: number; // 0-100
  players: EnginePlayer[];
}

export interface MatchEvent {
  minute: number;
  type: "goal" | "yellow" | "red" | "chance_missed";
  team: "home" | "away";
  playerName: string;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  homeStrength: number;
  awayStrength: number;
  events: MatchEvent[];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Coefficient d'efficacité individuelle : la forme du jour d'un joueur.
// - la fatigue réduit le rendement jusqu'à -30% à fatigue=100
// - le moral module +/-15%
// - la forme récente module +/-20%
function effectiveRating(p: EnginePlayer) {
  const fatiguePenalty = 1 - (p.fatigue / 100) * 0.3;
  const moraleFactor = 0.85 + (p.morale / 100) * 0.3;
  const formFactor = 0.8 + (p.form / 100) * 0.4;
  return p.overall * fatiguePenalty * moraleFactor * formFactor;
}

// Sélectionne les 11 meilleurs joueurs qui correspondent aux postes
// requis par la formation (algorithme glouton simple pour le MVP).
function selectStartingXI(club: EngineClub): EnginePlayer[] {
  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS["4-3-3"];
  const pool = [...club.players];
  const xi: EnginePlayer[] = [];

  for (const slot of slots) {
    const candidates = pool
      .filter((p) => p.position === slot)
      .sort((a, b) => effectiveRating(b) - effectiveRating(a));

    if (candidates[0]) {
      xi.push(candidates[0]);
      pool.splice(pool.indexOf(candidates[0]), 1);
    } else {
      // pas de joueur au poste exact -> prend le meilleur joueur restant (dépannage)
      const fallback = pool.sort((a, b) => effectiveRating(b) - effectiveRating(a))[0];
      if (fallback) {
        xi.push(fallback);
        pool.splice(pool.indexOf(fallback), 1);
      }
    }
  }
  return xi;
}

// Modificateurs tactiques : chaque style renforce une facette du jeu
// au prix d'une autre (aucun style n'est strictement supérieur).
const TACTIC_MODIFIERS: Record<
  EngineClub["tactic_style"],
  { attack: number; defense: number }
> = {
  offensif: { attack: 1.15, defense: 0.9 },
  defensif: { attack: 0.85, defense: 1.15 },
  possession: { attack: 1.05, defense: 1.0 },
  contre: { attack: 1.0, defense: 1.05 },
  balanced: { attack: 1.0, defense: 1.0 },
};

function computeAttackDefense(club: EngineClub, xi: EnginePlayer[]) {
  const mod = TACTIC_MODIFIERS[club.tactic_style];

  const attackers = xi.filter((p) =>
    ["BU", "AG", "AD", "MOC"].includes(p.position)
  );
  const midfielders = xi.filter((p) => ["MC", "MDC"].includes(p.position));
  const defenders = xi.filter((p) =>
    ["DC", "DL", "DR", "GK"].includes(p.position)
  );

  const avg = (list: EnginePlayer[], key: keyof EnginePlayer) =>
    list.length
      ? list.reduce((s, p) => s + (p[key] as number), 0) / list.length
      : 50;

  const rawAttack =
    avg(attackers, "shooting") * 0.5 +
    avg(midfielders, "passing") * 0.3 +
    avg(xi, "pace") * 0.2;

  const rawDefense =
    avg(defenders, "defending") * 0.55 +
    avg(midfielders, "defending") * 0.25 +
    avg(xi, "physical") * 0.2;

  // Mentalité (curseur 0-100) : pousse encore le curseur attaque/défense
  const mentalityShift = (club.mentality - 50) / 100; // -0.5 .. +0.5

  const attack = rawAttack * mod.attack * (1 + mentalityShift * 0.2);
  const defense = rawDefense * mod.defense * (1 - mentalityShift * 0.15);

  return { attack, defense, attackers, xi };
}

// Poisson simplifié pour générer un nombre de buts crédible (0-6 la plupart du temps)
function poissonGoals(expected: number): number {
  const L = Math.exp(-expected);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function simulateMatch(
  home: EngineClub,
  away: EngineClub,
  options: { weather?: "sunny" | "rain" | "cold"; neutralVenue?: boolean } = {}
): MatchResult {
  const homeXI = selectStartingXI(home);
  const awayXI = selectStartingXI(away);

  const homeStats = computeAttackDefense(home, homeXI);
  const awayStats = computeAttackDefense(away, awayXI);

  // Avantage du terrain : +8% d'attaque, +5% de défense pour l'équipe à domicile
  const homeAdvantage = options.neutralVenue ? 1 : 1.08;
  const homeAdvantageDef = options.neutralVenue ? 1 : 1.05;

  // Météo : légère variance globale (simplifiée pour le MVP)
  const weatherFactor =
    options.weather === "rain" ? 0.95 : options.weather === "cold" ? 0.97 : 1;

  const homeAttack = homeStats.attack * homeAdvantage * weatherFactor;
  const awayAttack = awayStats.attack * weatherFactor;
  const homeDefense = homeStats.defense * homeAdvantageDef;
  const awayDefense = awayStats.defense;

  // Buts attendus (xG simplifié) = attaque adverse défense, calibré /100 -> ~1.4 buts moyens
  const homeXG = clamp((homeAttack / awayDefense) * 1.4, 0.15, 5);
  const awayXG = clamp((awayAttack / homeDefense) * 1.2, 0.1, 5);

  const homeScore = poissonGoals(homeXG);
  const awayScore = poissonGoals(awayXG);

  // Génération des events (minutes de buts aléatoires, buteur pondéré par shooting)
  const events: MatchEvent[] = [];
  const pickScorer = (attackers: EnginePlayer[]) => {
    if (!attackers.length) return "Joueur";
    const weighted = attackers.flatMap((p) =>
      Array(Math.max(1, Math.round(p.shooting / 10))).fill(p)
    );
    const scorer = weighted[Math.floor(Math.random() * weighted.length)];
    return `${scorer.first_name} ${scorer.last_name}`;
  };

  for (let i = 0; i < homeScore; i++) {
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "goal",
      team: "home",
      playerName: pickScorer(homeStats.attackers),
    });
  }
  for (let i = 0; i < awayScore; i++) {
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "goal",
      team: "away",
      playerName: pickScorer(awayStats.attackers),
    });
  }
  events.sort((a, b) => a.minute - b.minute);

  return {
    homeScore,
    awayScore,
    homeStrength: Math.round(homeAttack + homeDefense),
    awayStrength: Math.round(awayAttack + awayDefense),
    events,
  };
}
