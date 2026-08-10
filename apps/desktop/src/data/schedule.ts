import type { Difficulty, Exercise } from "./exercises";

export const PERSONALIZATION_GENERATOR_VERSION = 1 as const;

export type TrainingGoal = "general_fitness" | "strength" | "conditioning" | "mobility_balance";
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6 | 7;
export type SessionMinutes = 15 | 30 | 45;
export type PlanFocus = "lower" | "upper" | "core" | "full_body" | "mobility_balance";
export type Impact = "low" | "high";

export interface PersonalizationProfile {
  primaryGoal: TrainingGoal;
  experience: Difficulty;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
  hasDumbbells: boolean;
  lowImpactOnly: boolean;
  excludedExerciseSlugs: string[];
}

export type Prescription =
  | { kind: "reps"; sets: number; reps: number; perSide?: boolean }
  | { kind: "time"; sets: number; seconds: number; perSide?: boolean };

export interface PrescribedExercise {
  slug: string;
  prescription: Prescription;
  notes?: string;
}

export interface WorkoutSession {
  title: string;
  focus: PlanFocus;
  targetDurationMin: SessionMinutes;
  estimatedDurationSec: number;
  warmup: PrescribedExercise[];
  main: PrescribedExercise[];
}

export interface WorkoutDay {
  day: number;
  session: WorkoutSession;
}

export type PlanWarning =
  | { code: "duration_target_unmet" | "duration_target_exceeded"; day: number }
  | { code: "unknown_exclusion"; slug: string };

export interface WeeklyPlan {
  name: string;
  goal: TrainingGoal;
  generatorVersion: typeof PERSONALIZATION_GENERATOR_VERSION;
  days: WorkoutDay[];
  warnings: PlanWarning[];
}

export interface PlanGenerationIssue {
  code: "invalid_profile" | "missing_catalog_exercise" | "insufficient_eligible_exercises";
  message: string;
  day?: number;
  focus?: PlanFocus;
  slug?: string;
}

export type PlanGenerationResult =
  | { ok: true; plan: WeeklyPlan }
  | { ok: false; issues: PlanGenerationIssue[] };

export interface ResolvedPlan {
  plan: WeeklyPlan;
  bySlug: Map<string, Exercise>;
  missing: string[];
}

interface PlanCandidate extends PrescribedExercise {
  impact: Impact;
}

const GOALS: TrainingGoal[] = ["general_fitness", "strength", "conditioning", "mobility_balance"];
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const DAYS_PER_WEEK: DaysPerWeek[] = [2, 3, 4, 5, 6, 7];
const SESSION_MINUTES: SessionMinutes[] = [15, 30, 45];
const FOCUSES: PlanFocus[] = ["lower", "upper", "core", "full_body", "mobility_balance"];

const GOAL_LABELS: Record<TrainingGoal, string> = {
  general_fitness: "General fitness",
  strength: "Strength",
  conditioning: "Conditioning",
  mobility_balance: "Mobility & balance",
};

const FOCUS_LABELS: Record<PlanFocus, string> = {
  lower: "Lower body",
  upper: "Upper body",
  core: "Core",
  full_body: "Full body",
  mobility_balance: "Mobility & balance",
};

const FOCUS_CYCLES: Record<TrainingGoal, PlanFocus[]> = {
  general_fitness: [
    "full_body",
    "mobility_balance",
    "full_body",
    "core",
    "lower",
    "upper",
    "full_body",
  ],
  strength: ["lower", "upper", "full_body"],
  conditioning: ["full_body", "core"],
  mobility_balance: ["mobility_balance"],
};

const reps = (sets: number, count: number, perSide = false): Prescription => ({
  kind: "reps",
  sets,
  reps: count,
  ...(perSide ? { perSide: true } : {}),
});
const time = (sets: number, seconds: number, perSide = false): Prescription => ({
  kind: "time",
  sets,
  seconds,
  ...(perSide ? { perSide: true } : {}),
});
const low = (slug: string, prescription: Prescription, notes?: string): PlanCandidate => ({
  slug,
  prescription,
  impact: "low",
  ...(notes ? { notes } : {}),
});
const high = (slug: string, prescription: Prescription, notes?: string): PlanCandidate => ({
  slug,
  prescription,
  impact: "high",
  ...(notes ? { notes } : {}),
});

const deduplicate = (candidates: PlanCandidate[]): PlanCandidate[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.slug)) return false;
    seen.add(candidate.slug);
    return true;
  });
};

const WARMUPS = deduplicate([
  low("tactical-jack", time(1, 60)),
  high("high-knees", time(1, 60)),
  low("tactical-march", time(1, 60)),
  low("sunrise-flow", time(1, 60)),
  low("tai-chi-arm-swings", time(1, 60)),
]);

const CANDIDATE_POOLS: Record<PlanFocus, PlanCandidate[]> = {
  lower: deduplicate([
    low("bodyweight-squat", reps(3, 10)),
    low("reverse-lunge", reps(2, 10, true)),
    low("static-glute-bridge", time(3, 20)),
    low("squat-pulse", time(2, 30)),
    low("calf-raise", reps(2, 15)),
    low("goblet-squat", reps(3, 10), "Hold a 5 kg dumbbell at chest."),
    low("military-lunge", reps(2, 10, true)),
    high(
      "plyo-single-leg-glute-bridge",
      reps(3, 6, true),
      "Regression: alternate slow single-leg glute bridges.",
    ),
    low("squat-side-step", time(2, 30)),
    low("wall-sit", time(2, 30)),
  ]),
  upper: deduplicate([
    low("push-up", reps(3, 8)),
    low(
      "dumbbell-bent-over-row",
      reps(3, 10, true),
      "Use 5 kg dumbbells; if unavailable, sub inverted-row.",
    ),
    low("dumbbell-overhead-press", reps(3, 10)),
    low("dumbbell-bicep-curl", reps(2, 12)),
    low("bench-dip", reps(2, 10)),
    low("diamond-push-up", reps(3, 6)),
    low(
      "single-arm-dumbbell-row",
      reps(3, 10, true),
      "5 kg dumbbell; support hand/knee on a bench.",
    ),
    low("lateral-raise", reps(2, 12)),
    low("dumbbell-tricep-extension", reps(2, 12)),
    low("low-to-high-plank", reps(2, 6, true)),
  ]),
  core: deduplicate([
    low("sit-up", reps(2, 15)),
    low("bicycle-crunch", reps(2, 20)),
    low("front-plank", time(3, 30)),
    high("mountain-climber", time(2, 30)),
    low("superman", reps(2, 12)),
    low("plank-shoulder-tap", time(2, 40)),
    low("plank-knee-to-elbow", reps(2, 20)),
    low("oblique-crunch", reps(2, 15, true)),
    low("side-plank", time(2, 25, true)),
    low("wall-crunch", reps(2, 15)),
  ]),
  full_body: deduplicate([
    low("push-up", time(1, 60)),
    low("bodyweight-squat", time(1, 60)),
    high("mountain-climber", time(1, 60)),
    low("reverse-lunge", time(1, 60)),
    low("bear-crawl", time(1, 60)),
  ]),
  mobility_balance: deduplicate([
    low("sunrise-flow", time(1, 60)),
    low("tai-chi-arm-swings", time(1, 60)),
    low("tai-chi-chest-opening", time(1, 60)),
    low("parting-wild-horses-mane", time(1, 60)),
    low("breath-body-connection", time(1, 60)),
    low("grasp-sparrows-tail", time(1, 60)),
    low("embrace-the-moon", time(1, 60)),
    low("rooted-stance", time(1, 60)),
    low("seated-cat-cow", time(1, 60)),
    low("chair-downward-dog", time(1, 60)),
    low("seated-knee-hug", time(1, 60)),
    low("chair-assisted-quadriceps-stretch", time(1, 60)),
  ]),
};

const isOneOf = <T extends string | number>(value: unknown, values: T[]): value is T =>
  values.some((candidate) => candidate === value);
const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

export function isPersonalizationProfile(value: unknown): value is PersonalizationProfile {
  if (typeof value !== "object" || value === null) return false;
  const profile = value as {
    primaryGoal?: unknown;
    experience?: unknown;
    daysPerWeek?: unknown;
    sessionMinutes?: unknown;
    hasDumbbells?: unknown;
    lowImpactOnly?: unknown;
    excludedExerciseSlugs?: unknown;
  };
  const exclusions = profile.excludedExerciseSlugs;
  return (
    isOneOf(profile.primaryGoal, GOALS) &&
    isOneOf(profile.experience, DIFFICULTIES) &&
    isOneOf(profile.daysPerWeek, DAYS_PER_WEEK) &&
    isOneOf(profile.sessionMinutes, SESSION_MINUTES) &&
    typeof profile.hasDumbbells === "boolean" &&
    typeof profile.lowImpactOnly === "boolean" &&
    Array.isArray(exclusions) &&
    exclusions.every((slug) => typeof slug === "string") &&
    new Set(exclusions).size === exclusions.length
  );
}

const isPrescription = (value: unknown): value is Prescription => {
  if (typeof value !== "object" || value === null) return false;
  const prescription = value as {
    kind?: unknown;
    sets?: unknown;
    reps?: unknown;
    seconds?: unknown;
    perSide?: unknown;
  };
  if (!isPositiveInteger(prescription.sets)) return false;
  if (prescription.perSide !== undefined && typeof prescription.perSide !== "boolean") {
    return false;
  }
  return prescription.kind === "reps"
    ? isPositiveInteger(prescription.reps)
    : prescription.kind === "time" && isPositiveInteger(prescription.seconds);
};

const isPrescribedExercise = (value: unknown): value is PrescribedExercise => {
  if (typeof value !== "object" || value === null) return false;
  const exercise = value as {
    slug?: unknown;
    prescription?: unknown;
    notes?: unknown;
  };
  return (
    typeof exercise.slug === "string" &&
    isPrescription(exercise.prescription) &&
    (exercise.notes === undefined || typeof exercise.notes === "string")
  );
};

const isWorkoutSession = (value: unknown): value is WorkoutSession => {
  if (typeof value !== "object" || value === null) return false;
  const session = value as {
    title?: unknown;
    focus?: unknown;
    targetDurationMin?: unknown;
    estimatedDurationSec?: unknown;
    warmup?: unknown;
    main?: unknown;
  };
  return (
    typeof session.title === "string" &&
    isOneOf(session.focus, FOCUSES) &&
    isOneOf(session.targetDurationMin, SESSION_MINUTES) &&
    Number.isInteger(session.estimatedDurationSec) &&
    Number(session.estimatedDurationSec) >= 0 &&
    Array.isArray(session.warmup) &&
    session.warmup.every(isPrescribedExercise) &&
    Array.isArray(session.main) &&
    session.main.every(isPrescribedExercise)
  );
};

const isWorkoutDay = (value: unknown): value is WorkoutDay => {
  if (typeof value !== "object" || value === null) return false;
  const day = value as { day?: unknown; session?: unknown };
  return isPositiveInteger(day.day) && isWorkoutSession(day.session);
};

const isPlanWarning = (value: unknown): value is PlanWarning => {
  if (typeof value !== "object" || value === null) return false;
  const warning = value as { code?: unknown; slug?: unknown; day?: unknown };
  return (
    (warning.code === "unknown_exclusion" && typeof warning.slug === "string") ||
    ((warning.code === "duration_target_unmet" || warning.code === "duration_target_exceeded") &&
      isPositiveInteger(warning.day))
  );
};

export function isWeeklyPlan(value: unknown): value is WeeklyPlan {
  if (typeof value !== "object" || value === null) return false;
  const plan = value as {
    name?: unknown;
    goal?: unknown;
    generatorVersion?: unknown;
    days?: unknown;
    warnings?: unknown;
  };
  return (
    typeof plan.name === "string" &&
    isOneOf(plan.goal, GOALS) &&
    plan.generatorVersion === PERSONALIZATION_GENERATOR_VERSION &&
    Array.isArray(plan.days) &&
    plan.days.every(isWorkoutDay) &&
    Array.isArray(plan.warnings) &&
    plan.warnings.every(isPlanWarning)
  );
}

const prescriptionDurationSec = (prescription: Prescription): number => {
  const work =
    prescription.kind === "reps"
      ? prescription.sets * prescription.reps * 3
      : prescription.sets * prescription.seconds;
  const sideMultiplier = prescription.perSide ? 2 : 1;
  const rest = (prescription.sets - 1) * (prescription.kind === "reps" ? 45 : 30);
  return work * sideMultiplier + rest;
};

export function sessionDurationSec(session: WorkoutSession): number {
  return [...session.warmup, ...session.main].reduce(
    (total, exercise) => total + prescriptionDurationSec(exercise.prescription),
    0,
  );
}

export function formatPrescription(prescription: Prescription): string {
  const suffix = prescription.perSide ? " / side" : "";
  if (prescription.kind === "reps") {
    return `${prescription.sets} x ${prescription.reps}${suffix}`;
  }
  const dose =
    prescription.sets === 1
      ? `${prescription.seconds} sec`
      : `${prescription.sets} x ${prescription.seconds} sec`;
  return `${dose}${suffix}`;
}

const selectedFocuses = (profile: PersonalizationProfile): PlanFocus[] => {
  const cycle = FOCUS_CYCLES[profile.primaryGoal];
  return Array.from(
    { length: profile.daysPerWeek },
    (_, index) => cycle[index % cycle.length] as PlanFocus,
  );
};

const isEligible = (
  candidate: PlanCandidate,
  exercise: Exercise,
  profile: PersonalizationProfile,
  exclusions: Set<string>,
): boolean =>
  DIFFICULTIES.indexOf(exercise.difficulty) <= DIFFICULTIES.indexOf(profile.experience) &&
  (profile.hasDumbbells || exercise.equipment !== "dumbbells") &&
  (!profile.lowImpactOnly || candidate.impact === "low") &&
  !exclusions.has(candidate.slug);

const prescribed = ({ slug, prescription, notes }: PlanCandidate): PrescribedExercise => ({
  slug,
  prescription,
  ...(notes ? { notes } : {}),
});

export function generateWeeklyPlan(
  profile: PersonalizationProfile,
  catalog: Exercise[],
): PlanGenerationResult {
  if (!isPersonalizationProfile(profile)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_profile",
          message: "Profile contains invalid personalization values.",
        },
      ],
    };
  }

  const bySlug = new Map(catalog.map((exercise) => [exercise.slug, exercise]));
  const focuses = selectedFocuses(profile);
  const missingIssues: PlanGenerationIssue[] = [];
  const checked = new Set<string>();
  for (const pool of [WARMUPS, ...focuses.map((focus) => CANDIDATE_POOLS[focus])]) {
    for (const candidate of pool) {
      if (!checked.has(candidate.slug)) {
        checked.add(candidate.slug);
        if (!bySlug.has(candidate.slug)) {
          missingIssues.push({
            code: "missing_catalog_exercise",
            message: `Planner exercise "${candidate.slug}" is missing from the catalog.`,
            slug: candidate.slug,
          });
        }
      }
    }
  }
  if (missingIssues.length > 0) return { ok: false, issues: missingIssues };

  const exclusions = new Set(profile.excludedExerciseSlugs);
  const eligibleWarmups = WARMUPS.filter((candidate) =>
    isEligible(candidate, bySlug.get(candidate.slug) as Exercise, profile, exclusions),
  );
  const warnings: PlanWarning[] = profile.excludedExerciseSlugs
    .filter((slug) => !bySlug.has(slug))
    .map((slug) => ({ code: "unknown_exclusion", slug }));

  if (eligibleWarmups.length < 2) {
    const focus = focuses[0] as PlanFocus;
    return {
      ok: false,
      issues: [
        {
          code: "insufficient_eligible_exercises",
          message: `Not enough eligible exercises for day 1 (${FOCUS_LABELS[focus]}). Change exclusions or profile constraints.`,
          day: 1,
          focus,
        },
      ],
    };
  }

  const usedMainSlugs = new Set<string>();
  const days: WorkoutDay[] = [];
  for (const [index, focus] of focuses.entries()) {
    const day = index + 1;
    const eligible = CANDIDATE_POOLS[focus].filter((candidate) =>
      isEligible(candidate, bySlug.get(candidate.slug) as Exercise, profile, exclusions),
    );
    if (eligible.length < 2) {
      return {
        ok: false,
        issues: [
          {
            code: "insufficient_eligible_exercises",
            message: `Not enough eligible exercises for day ${day} (${FOCUS_LABELS[focus]}). Change exclusions or profile constraints.`,
            day,
            focus,
          },
        ],
      };
    }

    const ordered = [
      ...eligible.filter((candidate) => !usedMainSlugs.has(candidate.slug)),
      ...eligible.filter((candidate) => usedMainSlugs.has(candidate.slug)),
    ];
    const warmup = eligibleWarmups.slice(0, 2).map(prescribed);
    const main = ordered.slice(0, 2).map(prescribed);
    const session: WorkoutSession = {
      title: `Day ${day} - ${FOCUS_LABELS[focus]}`,
      focus,
      targetDurationMin: profile.sessionMinutes,
      estimatedDurationSec: 0,
      warmup,
      main,
    };
    const targetSeconds = profile.sessionMinutes * 60;
    for (const candidate of ordered.slice(2)) {
      const next = prescribed(candidate);
      session.main.push(next);
      if (sessionDurationSec(session) > targetSeconds) session.main.pop();
    }
    session.estimatedDurationSec = sessionDurationSec(session);
    for (const exercise of session.main) usedMainSlugs.add(exercise.slug);
    if (session.estimatedDurationSec < targetSeconds * 0.8) {
      warnings.push({ code: "duration_target_unmet", day });
    } else if (session.estimatedDurationSec > targetSeconds * 1.1) {
      warnings.push({ code: "duration_target_exceeded", day });
    }
    days.push({ day, session });
  }

  return {
    ok: true,
    plan: {
      name: `${GOAL_LABELS[profile.primaryGoal]} - ${profile.daysPerWeek}-day plan`,
      goal: profile.primaryGoal,
      generatorVersion: PERSONALIZATION_GENERATOR_VERSION,
      days,
      warnings,
    },
  };
}

export function resolvePlan(plan: WeeklyPlan, catalog: Exercise[]): ResolvedPlan {
  const bySlug = new Map(catalog.map((exercise) => [exercise.slug, exercise]));
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const day of plan.days) {
    for (const item of [...day.session.warmup, ...day.session.main]) {
      if (!bySlug.has(item.slug) && !seen.has(item.slug)) {
        seen.add(item.slug);
        missing.push(item.slug);
      }
    }
  }
  return { plan, bySlug, missing };
}
