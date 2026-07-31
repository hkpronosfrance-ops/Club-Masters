const FIRST_NAMES = ["Lucas","Yanis","Adam","Noah","Ilyes","Mathis","Tiago","Enzo","Amir","Hugo","Léo","Nolan","Rayan","Milan","Elias","Sacha"];
const LAST_NAMES = ["Martin","Diallo","Traoré","Silva","Bernard","Moreau","Fernandes","Benali","Lopez","Kovač","Sow","Rossi","Mendes","Petit","Costa","Demir"];
const NATIONALITIES = ["France","Belgique","Portugal","Espagne","Maroc","Algérie","Sénégal","Côte d’Ivoire","Italie","Pays-Bas","Croatie","Turquie"];
const POSITIONS = ["GK","DC","DL","DR","MDC","MC","MOC","AG","AD","BU"];
const PERSONALITIES = ["Travailleur","Ambitieux","Leader","Calme","Déterminé","Créatif","Instable"];

const rand = (min:number,max:number) => Math.floor(Math.random()*(max-min+1))+min;
const pick = <T,>(items:T[]) => items[rand(0,items.length-1)];
const clamp = (value:number,min=1,max=99) => Math.max(min,Math.min(max,value));

export function generateAcademyPlayer(level:number) {
  const age = rand(15,18);
  const rare = Math.random() < 0.006 + level * 0.0015;
  const base = clamp(43 + level * 2 + rand(-5,7), 40, rare ? 72 : 68);
  const potential = rare ? rand(92,99) : clamp(base + rand(14,27) + level, 62, 94);
  const position = pick(POSITIONS);
  const pace = clamp(base + rand(-8,10));
  const shooting = clamp(base + rand(-12,10));
  const passing = clamp(base + rand(-8,10));
  const defending = clamp(base + rand(-12,10));
  const physical = clamp(base + rand(-10,9));
  const stars = potential >= 92 ? 5 : potential >= 84 ? 4 : potential >= 76 ? 3 : potential >= 69 ? 2 : 1;
  const labels = ["Très faible","Faible","Moyen","Bon","Excellent"];

  return {
    first_name: pick(FIRST_NAMES), last_name: pick(LAST_NAMES), nationality: pick(NATIONALITIES), age, position,
    strong_foot: Math.random() < 0.22 ? "Gauche" : "Droit",
    height_cm: position === "GK" || position === "DC" ? rand(181,198) : rand(166,190),
    weight_kg: rand(58,86), personality: pick(PERSONALITIES), overall: base, potential,
    pace, shooting, passing, defending, physical, scout_stars: stars,
    scout_label: rare ? "Exceptionnel" : labels[stars - 1],
  };
}

export function academyIntakeSize(level:number) {
  return Math.min(8, 3 + Math.floor(level / 2) + rand(0,2));
}

export function academyUpgradeCost(level:number) {
  return level >= 10 ? 0 : Math.round(1_500_000 * Math.pow(1.65, level - 1));
}
