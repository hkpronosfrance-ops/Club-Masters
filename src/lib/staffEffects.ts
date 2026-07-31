export const STAFF_ROLES = [
  "sporting_director",
  "scout",
  "doctor",
  "fitness_coach",
  "video_analyst",
  "academy_manager",
] as const;

export type StaffRole = typeof STAFF_ROLES[number];
export type StaffLevels = Record<StaffRole, number>;

export const EMPTY_STAFF_LEVELS: StaffLevels = {
  sporting_director: 0,
  scout: 0,
  doctor: 0,
  fitness_coach: 0,
  video_analyst: 0,
  academy_manager: 0,
};

export async function loadStaffLevels(admin: any, clubId: string): Promise<StaffLevels> {
  const { data } = await admin
    .from("club_staff")
    .select("role,level")
    .eq("club_id", clubId)
    .eq("active", true);

  const levels = { ...EMPTY_STAFF_LEVELS };
  for (const member of data ?? []) {
    if (STAFF_ROLES.includes(member.role as StaffRole)) {
      levels[member.role as StaffRole] = Math.max(0, Math.min(10, Number(member.level ?? 0)));
    }
  }
  return levels;
}

export function trainingStaffEffects(levels: StaffLevels) {
  const fitness = levels.fitness_coach;
  const doctor = levels.doctor;
  const analyst = levels.video_analyst;
  return {
    progressMultiplier: 1 + fitness * 0.025 + analyst * 0.01,
    fatigueMultiplier: Math.max(0.68, 1 - fitness * 0.028),
    injuryMultiplier: Math.max(0.48, 1 - doctor * 0.045 - fitness * 0.012),
    cooldownMultiplier: Math.max(0.7, 1 - fitness * 0.025),
  };
}

export function academyStaffEffects(levels: StaffLevels) {
  const manager = levels.academy_manager;
  const scout = levels.scout;
  return {
    intakeBonus: Math.floor((manager + scout) / 7),
    overallBonusChance: Math.min(0.55, manager * 0.045),
    potentialBonus: Math.floor(manager / 3) + Math.floor(scout / 5),
    cooldownDays: Math.max(8, 14 - Math.floor(manager / 2)),
  };
}

export function matchMedicalEffects(levels: StaffLevels) {
  return {
    injuryMultiplier: Math.max(0.45, 1 - levels.doctor * 0.045 - levels.fitness_coach * 0.012),
    fatigueGainReduction: Math.floor(levels.fitness_coach / 2),
    recoveryBonus: Math.floor(levels.fitness_coach / 3),
  };
}
