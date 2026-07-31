// Génération procédurale de joueurs et clubs IA.

const FIRST_NAMES = [
  "Lucas", "Karim", "Yanis", "Mathis", "Enzo", "Rayan", "Nathan", "Adam", "Théo", "Amir",
  "Bilal", "Diego", "Mamadou", "Ismael", "Léo", "Hugo", "Kylian", "Antoine", "Ousmane", "Wesley",
  "Bruno", "Marco", "Ivan", "Erik", "Sami", "Nicolas", "João", "Alejandro", "Milan", "Noah",
  "Elias", "Samuel", "Victor", "Gabriel", "Matteo", "Tiago", "Adem", "Nabil", "Arthur", "Louis",
];

const LAST_NAMES = [
  "Traoré", "Martin", "Silva", "Diallo", "Bernard", "Costa", "N'Diaye", "García", "Novak", "Petit",
  "Dubois", "Keita", "Moreau", "Fernandes", "Kovač", "Andersson", "Roux", "Barry", "Lemoine", "Sow",
  "Rossi", "Weber", "Mendes", "Oliveira", "Benali", "Haddad", "Santos", "Müller", "Jensen", "Bianchi",
  "Pereira", "Lopez", "Demir", "Popescu", "Keller", "Varga", "Martínez", "Laurent", "Fontaine", "Henry",
];

export type Position = "GK" | "DC" | "DL" | "DR" | "MDC" | "MC" | "MOC" | "AG" | "AD" | "BU";

export const FORMATION_SLOTS: Record<string, Position[]> = {
  "4-3-3": ["GK", "DL", "DC", "DC", "DR", "MDC", "MC", "MOC", "AG", "AD", "BU"],
  "4-4-2": ["GK", "DL", "DC", "DC", "DR", "AG", "MC", "MC", "AD", "BU", "BU"],
  "3-5-2": ["GK", "DC", "DC", "DC", "AG", "MC", "MDC", "MC", "AD", "BU", "BU"],
  "4-2-3-1": ["GK", "DL", "DC", "DC", "DR", "MDC", "MDC", "MOC", "AG", "AD", "BU"],
  "5-3-2": ["GK", "DL", "DC", "DC", "DC", "DR", "MC", "MDC", "MC", "BU", "BU"],
};

const SQUAD_TEMPLATE: Position[] = [
  "GK", "GK", "GK", "DC", "DC", "DC", "DL", "DL", "DR", "MDC", "MC", "MC", "MOC", "MOC", "AG", "AD", "BU", "BU",
];

const POSITION_PROFILE: Record<Position, { pace: number; shooting: number; passing: number; defending: number; physical: number }> = {
  GK: { pace: 42, shooting: 18, passing: 48, defending: 68, physical: 64 },
  DC: { pace: 55, shooting: 28, passing: 52, defending: 74, physical: 72 },
  DL: { pace: 69, shooting: 38, passing: 58, defending: 66, physical: 63 },
  DR: { pace: 69, shooting: 38, passing: 58, defending: 66, physical: 63 },
  MDC: { pace: 60, shooting: 43, passing: 68, defending: 68, physical: 69 },
  MC: { pace: 63, shooting: 54, passing: 72, defending: 57, physical: 63 },
  MOC: { pace: 68, shooting: 65, passing: 75, defending: 36, physical: 56 },
  AG: { pace: 79, shooting: 64, passing: 64, defending: 28, physical: 57 },
  AD: { pace: 79, shooting: 64, passing: 64, defending: 28, physical: 57 },
  BU: { pace: 72, shooting: 77, passing: 52, defending: 22, physical: 68 },
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

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(items: T[]): T { return items[rand(0, items.length - 1)]; }
function clamp(value: number, min = 1, max = 99) { return Math.max(min, Math.min(max, value)); }

function weightedAge() {
  const roll = Math.random();
  if (roll < 0.18) return rand(17, 20);
  if (roll < 0.62) return rand(21, 27);
  if (roll < 0.9) return rand(28, 32);
  return rand(33, 36);
}

function calculateOverall(position: Position, attributes: Omit<typeof POSITION_PROFILE[Position], never>) {
  const weights: Record<Position, [number, number, number, number, number]> = {
    GK: [0.05, 0.02, 0.18, 0.5, 0.25],
    DC: [0.12, 0.03, 0.1, 0.42, 0.33],
    DL: [0.24, 0.05, 0.2, 0.3, 0.21],
    DR: [0.24, 0.05, 0.2, 0.3, 0.21],
    MDC: [0.12, 0.08, 0.27, 0.29, 0.24],
    MC: [0.16, 0.16, 0.34, 0.14, 0.2],
    MOC: [0.2, 0.25, 0.36, 0.04, 0.15],
    AG: [0.31, 0.29, 0.24, 0.03, 0.13],
    AD: [0.31, 0.29, 0.24, 0.03, 0.13],
    BU: [0.21, 0.42, 0.12, 0.03, 0.22],
  };
  const values = [attributes.pace, attributes.shooting, attributes.passing, attributes.defending, attributes.physical];
  return Math.round(values.reduce((sum, value, index) => sum + value * weights[position][index], 0));
}

function generatePlayer(position: Position, clubLevel: number): GeneratedPlayer {
  const age = weightedAge();
  const profile = POSITION_PROFILE[position];
  const quality = clamp(clubLevel + rand(-7, 9), 35, 88);
  const adjustment = (quality - 60) * 0.68;
  const variance = () => rand(-7, 7);

  const pace = clamp(Math.round(profile.pace + adjustment + variance()));
  const shooting = clamp(Math.round(profile.shooting + adjustment + variance()));
  const passing = clamp(Math.round(profile.passing + adjustment + variance()));
  const defending = clamp(Math.round(profile.defending + adjustment + variance()));
  const physical = clamp(Math.round(profile.physical + adjustment + variance()));
  const overall = clamp(calculateOverall(position, { pace, shooting, passing, defending, physical }), 35, 92);

  const potentialBonus = age <= 19 ? rand(8, 18) : age <= 22 ? rand(4, 13) : age <= 25 ? rand(1, 7) : 0;
  const potential = clamp(Math.max(overall, overall + potentialBonus), overall, 95);
  const ageMultiplier = age <= 21 ? 2.6 : age <= 25 ? 2.1 : age <= 29 ? 1.45 : age <= 32 ? 0.85 : 0.45;
  const value = Math.round(Math.pow(overall, 3.25) * ageMultiplier * 2.2);
  const wage = Math.max(1_000, Math.round(value / rand(220, 310)));

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
    morale: rand(58, 88),
    fatigue: rand(0, 12),
    form: rand(45, 72),
    value,
    wage,
    contract_until: `${new Date().getFullYear() + rand(1, 5)}-06-30`,
  };
}

export function generateSquad(clubLevel = 58): GeneratedPlayer[] {
  return SQUAD_TEMPLATE.map((position) => generatePlayer(position, clubLevel));
}

export function generateAiClubName(): { name: string; short_name: string } {
  const patterns = [
    ["FC", "Rotterdam"], ["Sporting", "Porto"], ["Athletic", "Glasgow"], ["Union", "Berlin"],
    ["Olympique", "Nice"], ["Racing", "Bruxelles"], ["Real", "Valencia"], ["Stade", "Lausanne"],
    ["AC", "Torino"], ["SC", "Hamburg"], ["Dynamo", "Prague"], ["FK", "Belgrade"],
    ["Inter", "Genova"], ["Club", "Bruges"], ["Rapid", "Vienne"], ["Sporting", "Lisboa"],
    ["FC", "Genève"], ["Royal", "Antwerp"], ["Lokomotiv", "Sofia"], ["Athletic", "Bilbao Norte"],
    ["Racing", "Lyon"], ["Olympique", "Marseille Sud"], ["United", "Manchester North"], ["City", "Birmingham"],
  ];
  const [prefix, city] = pick(patterns);
  const name = `${prefix} ${city}`;
  const short_name = `${prefix[0]}${city.replace(/[^A-Za-zÀ-ÿ]/g, "")[0] ?? "C"}${city.replace(/[^A-Za-zÀ-ÿ]/g, "")[1] ?? "L"}`.toUpperCase().slice(0, 3);
  return { name, short_name };
}
