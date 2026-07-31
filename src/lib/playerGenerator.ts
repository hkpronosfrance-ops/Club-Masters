// Génération procédurale de joueurs réalistes pour un nouveau club (MVP)

const FIRST_NAMES = [
  "Lucas", "Karim", "Yanis", "Mathis", "Enzo", "Rayan", "Nathan", "Adam",
  "Théo", "Amir", "Bilal", "Diego", "Mamadou", "Ismael", "Léo", "Hugo",
  "Kylian", "Antoine", "Ousmane", "Wesley", "Bruno", "Marco", "Ivan", "Erik",
];
const LAST_NAMES = [
  "Traoré", "Martin", "Silva", "Diallo", "Bernard", "Costa", "N'Diaye",
  "García", "Novak", "Petit", "Dubois", "Keita", "Moreau", "Fernandes",
  "Kovač", "Andersson", "Roux", "Barry", "Lemoine", "Sow", "Rossi", "Weber",
];

export type Position =
  | "GK" | "DC" | "DL" | "DR" | "MDC" | "MC" | "MOC" | "AG" | "AD" | "BU";

export const FORMATION_SLOTS: Record<string, Position[]> = {
  "4-3-3": ["GK", "DL", "DC", "DC", "DR", "MDC", "MC", "MOC", "AG", "AD", "BU"],
  "4-4-2": ["GK", "DL", "DC", "DC", "DR", "AG", "MC", "MC", "AD", "BU", "BU"],
  "3-5-2": ["GK", "DC", "DC", "DC", "AG", "MC", "MDC", "MC", "AD", "BU", "BU"],
  "4-2-3-1": ["GK", "DL", "DC", "DC", "DR", "MDC", "MDC", "MOC", "MOC", "MOC", "BU"],
  "5-3-2": ["GK", "DL", "DC", "DC", "DC", "DR", "MC", "MC", "MC", "BU", "BU"],
};

const SQUAD_TEMPLATE: Position[] = [
  "GK", "GK",
  "DC", "DC", "DC", "DL", "DR", "DL",
  "MDC", "MC", "MC", "MOC", "MOC",
  "AG", "AD",
  "BU", "BU", "BU",
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}
function clamp(v: number, min = 1, max = 99) {
  return Math.max(min, Math.min(max, v));
}

// Profils d'attributs par poste (base + variance)
const POSITION_PROFILE: Record<
  Position,
  { pace: number; shooting: number; passing: number; defending: number; physical: number }
> = {
  GK: { pace: 40, shooting: 20, passing: 45, defending: 55, physical: 60 },
  DC: { pace: 55, shooting: 25, passing: 50, defending: 75, physical: 70 },
  DL: { pace: 68, shooting: 35, passing: 55, defending: 65, physical: 62 },
  DR: { pace: 68, shooting: 35, passing: 55, defending: 65, physical: 62 },
  MDC: { pace: 58, shooting: 40, passing: 68, defending: 65, physical: 68 },
  MC: { pace: 62, shooting: 50, passing: 70, defending: 55, physical: 62 },
  MOC: { pace: 65, shooting: 62, passing: 72, defending: 35, physical: 55 },
  AG: { pace: 78, shooting: 60, passing: 60, defending: 25, physical: 55 },
  AD: { pace: 78, shooting: 60, passing: 60, defending: 25, physical: 55 },
  BU: { pace: 70, shooting: 75, passing: 50, defending: 20, physical: 65 },
};

export interface GeneratedPlayer {
  first_name: string;
  last_name: string;
  age: number;
  position: Position;
  overall: number;
  potential: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  morale: number;
  fatigue: number;
  form: number;
  value: number;
  wage: number;
  contract_until: string;
}

function generatePlayer(position: Position, clubLevel: number): GeneratedPlayer {
  const age = rand(17, 34);
  const profile = POSITION_PROFILE[position];
  const variance = () => rand(-8, 8);

  // clubLevel: 30-85, influence le niveau moyen généré
  const base = clubLevel + rand(-10, 10);

  const pace = clamp(Math.round(profile.pace + variance() + (base - 60) / 2));
  const shooting = clamp(Math.round(profile.shooting + variance() + (base - 60) / 2));
  const passing = clamp(Math.round(profile.passing + variance() + (base - 60) / 2));
  const defending = clamp(Math.round(profile.defending + variance() + (base - 60) / 2));
  const physical = clamp(Math.round(profile.physical + variance() + (base - 60) / 2));

  const overall = clamp(
    Math.round((pace + shooting + passing + defending + physical) / 5)
  );

  // Potentiel plus haut si jeune
  const potentialBonus = age < 21 ? rand(5, 20) : age < 26 ? rand(0, 8) : 0;
  const potential = clamp(overall + potentialBonus);

  const value = Math.round(
    Math.pow(overall, 3) * (age < 24 ? 4 : age < 30 ? 2.2 : 0.8) * 3
  );
  const wage = Math.round(value / 250);

  return {
    first_name: pick(FIRST_NAMES),
    last_name: pick(LAST_NAMES),
    age,
    position,
    overall,
    potential,
    pace,
    shooting,
    passing,
    defending,
    physical,
    morale: rand(60, 85),
    fatigue: 0,
    form: rand(45, 65),
    value,
    wage,
    contract_until: `${new Date().getFullYear() + rand(1, 4)}-06-30`,
  };
}

export function generateSquad(clubLevel = 55): GeneratedPlayer[] {
  return SQUAD_TEMPLATE.map((pos) => generatePlayer(pos, clubLevel));
}

export function generateAiClubName(): { name: string; short_name: string } {
  const prefixes = ["FC", "AS", "Olympique", "Racing", "Stade", "SC", "Real", "Sporting", "Athletic", "Union"];
  const roots = [
    "Nordvale", "Montclair", "Riverport", "Castellon", "Belmonte", "Ostrava",
    "Silvano", "Kranholm", "Verano", "Brackwood", "Lindenau", "Solheim",
    "Dornbach", "Marchetti", "Kolvik", "Ambrosia", "Halveston",
  ];
  const name = `${pick(prefixes)} ${pick(roots)}`;
  const short_name = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3);
  return { name, short_name };
}
