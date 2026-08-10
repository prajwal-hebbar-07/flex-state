import assert from "node:assert/strict";
import test from "node:test";
import { EXERCISES } from "./exercises.ts";
import {
  formatPrescription,
  generateWeeklyPlan,
  type PersonalizationProfile,
  sessionDurationSec,
  type WorkoutSession,
} from "./schedule.ts";

const baseProfile: PersonalizationProfile = {
  primaryGoal: "general_fitness",
  experience: "advanced",
  daysPerWeek: 3,
  sessionMinutes: 15,
  hasDumbbells: true,
  lowImpactOnly: false,
  excludedExerciseSlugs: [],
};

function planFor(overrides: Partial<PersonalizationProfile> = {}) {
  const result = generateWeeklyPlan({ ...baseProfile, ...overrides }, EXERCISES);
  if (!result.ok) {
    assert.fail(result.issues.map((issue) => issue.message).join("\n"));
  }
  return result.plan;
}

test("identical profiles generate identical plan snapshots", () => {
  const profile: PersonalizationProfile = {
    ...baseProfile,
    primaryGoal: "conditioning",
    daysPerWeek: 6,
    excludedExerciseSlugs: ["push-up"],
  };
  const first = generateWeeklyPlan(profile, EXERCISES);
  const second = generateWeeklyPlan(profile, EXERCISES);
  assert.deepStrictEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("hard eligibility filters are never relaxed", () => {
  const excludedSlug = "push-up";
  const plan = planFor({
    primaryGoal: "conditioning",
    experience: "beginner",
    daysPerWeek: 2,
    hasDumbbells: false,
    lowImpactOnly: true,
    excludedExerciseSlugs: [excludedSlug],
  });
  const bySlug = new Map(EXERCISES.map((exercise) => [exercise.slug, exercise]));
  const highImpact = new Set(["high-knees", "mountain-climber", "plyo-single-leg-glute-bridge"]);

  for (const day of plan.days) {
    for (const item of [...day.session.warmup, ...day.session.main]) {
      const exercise = bySlug.get(item.slug);
      assert.ok(exercise);
      assert.notEqual(exercise.equipment, "dumbbells");
      assert.equal(exercise.difficulty, "beginner");
      assert.equal(highImpact.has(item.slug), false);
      assert.notEqual(item.slug, excludedSlug);
    }
  }
});

test("goals repeat their exact focus cycles", () => {
  assert.deepEqual(
    planFor({ primaryGoal: "general_fitness", daysPerWeek: 7 }).days.map(
      (day) => day.session.focus,
    ),
    ["full_body", "mobility_balance", "full_body", "core", "lower", "upper", "full_body"],
  );
  assert.deepEqual(
    planFor({ primaryGoal: "strength", daysPerWeek: 7 }).days.map((day) => day.session.focus),
    ["lower", "upper", "full_body", "lower", "upper", "full_body", "lower"],
  );
  assert.deepEqual(
    planFor({ primaryGoal: "conditioning", daysPerWeek: 7 }).days.map((day) => day.session.focus),
    ["full_body", "core", "full_body", "core", "full_body", "core", "full_body"],
  );
  assert.deepEqual(
    planFor({ primaryGoal: "mobility_balance", daysPerWeek: 7 }).days.map(
      (day) => day.session.focus,
    ),
    Array(7).fill("mobility_balance"),
  );
});

test("generation fails when a focus has fewer than two eligible exercises", () => {
  const result = generateWeeklyPlan(
    {
      ...baseProfile,
      primaryGoal: "mobility_balance",
      daysPerWeek: 2,
      excludedExerciseSlugs: [
        "tai-chi-arm-swings",
        "tai-chi-chest-opening",
        "parting-wild-horses-mane",
        "breath-body-connection",
        "grasp-sparrows-tail",
        "embrace-the-moon",
        "rooted-stance",
        "seated-cat-cow",
        "chair-downward-dog",
        "seated-knee-hug",
        "chair-assisted-quadriceps-stretch",
      ],
    },
    EXERCISES,
  );
  assert.deepEqual(result, {
    ok: false,
    issues: [
      {
        code: "insufficient_eligible_exercises",
        message:
          "Not enough eligible exercises for day 1 (Mobility & balance). Change exclusions or profile constraints.",
        day: 1,
        focus: "mobility_balance",
      },
    ],
  });
});

test("catalog gaps, stale exclusions, prescriptions, and duration are explicit", () => {
  const missing = generateWeeklyPlan(
    baseProfile,
    EXERCISES.filter((exercise) => exercise.slug !== "tactical-jack"),
  );
  assert.deepEqual(missing, {
    ok: false,
    issues: [
      {
        code: "missing_catalog_exercise",
        message: 'Planner exercise "tactical-jack" is missing from the catalog.',
        slug: "tactical-jack",
      },
    ],
  });

  const staleExclusion = planFor({ excludedExerciseSlugs: ["retired-exercise"] });
  assert.ok(
    staleExclusion.warnings.some(
      (warning) => warning.code === "unknown_exclusion" && warning.slug === "retired-exercise",
    ),
  );

  assert.equal(formatPrescription({ kind: "reps", sets: 3, reps: 10 }), "3 x 10");
  assert.equal(
    formatPrescription({ kind: "reps", sets: 2, reps: 10, perSide: true }),
    "2 x 10 / side",
  );
  assert.equal(formatPrescription({ kind: "time", sets: 1, seconds: 60 }), "60 sec");
  assert.equal(
    formatPrescription({ kind: "time", sets: 2, seconds: 30, perSide: true }),
    "2 x 30 sec / side",
  );

  const session: WorkoutSession = {
    title: "Duration check",
    focus: "core",
    targetDurationMin: 15,
    estimatedDurationSec: 0,
    warmup: [],
    main: [
      {
        slug: "rep-check",
        prescription: { kind: "reps", sets: 2, reps: 10, perSide: true },
      },
      {
        slug: "time-check",
        prescription: { kind: "time", sets: 2, seconds: 30, perSide: true },
      },
    ],
  };
  assert.equal(sessionDurationSec(session), 315);
});
