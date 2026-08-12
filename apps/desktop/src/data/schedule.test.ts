import assert from "node:assert/strict";
import test from "node:test";
import { type EquipmentKind, EXERCISES } from "./exercises.ts";
import type { Location } from "./locations.ts";
import {
  formatPrescription,
  generateWeeklyPlan,
  type PersonalizationProfile,
  sessionDurationSec,
  type TrainingGoal,
  type WeeklyPlan,
  type WorkoutSession,
} from "./schedule.ts";

// Fixtures, not defaults: nothing seeds locations and no production code names
// these ids. They exist because the two v1 equivalences need labels.
const homeLocation: Location = {
  id: "home",
  name: "Home",
  // == v1 hasDumbbells: true
  equipment: ["bodyweight", "furniture", "dumbbells", "floor"],
  excludedExerciseSlugs: [],
  displayOrder: 0,
};
const officeLocation: Location = {
  id: "office",
  name: "Office",
  // == v1 hasDumbbells: false
  equipment: ["bodyweight", "furniture", "floor"],
  excludedExerciseSlugs: [],
  displayOrder: 1,
};

const baseProfile: PersonalizationProfile = {
  primaryGoal: "general_fitness",
  bodyFocuses: [],
  experience: "advanced",
  daysPerWeek: 3,
  sessionMinutes: 15,
  lowImpactOnly: false,
  locationId: "home",
};

function planFor(
  overrides: Partial<PersonalizationProfile> = {},
  locations: Location[] = [homeLocation, officeLocation],
) {
  const result = generateWeeklyPlan({ ...baseProfile, ...overrides }, EXERCISES, locations);
  if (!result.ok) {
    assert.fail(result.issues.map((issue) => issue.message).join("\n"));
  }
  return result.plan;
}

test("identical profiles generate identical plan snapshots", () => {
  const location: Location = { ...homeLocation, excludedExerciseSlugs: ["push-up"] };
  const profile: PersonalizationProfile = {
    ...baseProfile,
    primaryGoal: "conditioning",
    daysPerWeek: 6,
  };
  const first = generateWeeklyPlan(profile, EXERCISES, [location]);
  const second = generateWeeklyPlan(profile, EXERCISES, [location]);
  assert.deepStrictEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("hard eligibility filters are never relaxed", () => {
  const excludedSlug = "push-up";
  const plan = planFor(
    {
      primaryGoal: "conditioning",
      experience: "beginner",
      daysPerWeek: 2,
      lowImpactOnly: true,
      locationId: "office",
    },
    [{ ...officeLocation, excludedExerciseSlugs: [excludedSlug] }],
  );
  const bySlug = new Map(EXERCISES.map((exercise) => [exercise.slug, exercise]));
  const highImpact = new Set(["high-knees", "mountain-climber", "plyo-single-leg-glute-bridge"]);

  for (const day of plan.days) {
    for (const item of [...day.session.warmup, ...day.session.main]) {
      const exercise = bySlug.get(item.slug);
      assert.ok(exercise);
      assert.equal(exercise.requires.includes("dumbbells"), false);
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

test("selected body focuses are prioritized before the primary goal cycle", () => {
  assert.deepEqual(
    planFor({
      primaryGoal: "general_fitness",
      bodyFocuses: ["core", "upper", "lower"],
      daysPerWeek: 4,
    }).days.map((day) => day.session.focus),
    ["core", "upper", "lower", "full_body"],
  );
  assert.deepEqual(
    planFor({
      primaryGoal: "conditioning",
      bodyFocuses: ["core"],
      daysPerWeek: 3,
    }).days.map((day) => day.session.focus),
    ["core", "full_body", "core"],
  );
});

test("generation fails when a focus has fewer than two eligible exercises", () => {
  const mobilityLocation: Location = {
    ...homeLocation,
    id: "mobility-test",
    name: "Mobility test",
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
  };
  const result = generateWeeklyPlan(
    {
      ...baseProfile,
      primaryGoal: "mobility_balance",
      daysPerWeek: 2,
      locationId: "mobility-test",
    },
    EXERCISES,
    [mobilityLocation],
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

test("an unknown location id fails generation instead of throwing", () => {
  const result = generateWeeklyPlan({ ...baseProfile, locationId: "gone" }, EXERCISES, [
    homeLocation,
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.ok ? [] : result.issues.map((issue) => issue.code), ["location_missing"]);
});

test("location equipment reproduces the v1 hasDumbbells behaviour", () => {
  // `strength` so the cycle reaches the lower and upper pools, the only two
  // that hold dumbbell candidates.
  const withDumbbells = planFor({ locationId: "home", primaryGoal: "strength" });
  const withoutDumbbells = planFor({ locationId: "office", primaryGoal: "strength" });
  const bySlug = new Map(EXERCISES.map((exercise) => [exercise.slug, exercise]));
  const slugs = (plan: WeeklyPlan) =>
    plan.days.flatMap((day) =>
      [...day.session.warmup, ...day.session.main].map((item) => item.slug),
    );

  // hasDumbbells: true -> dumbbell exercises are reachable
  assert.ok(slugs(withDumbbells).some((slug) => bySlug.get(slug)?.requires.includes("dumbbells")));
  // hasDumbbells: false -> none, and reverse-lunge (was "both") is still allowed
  assert.ok(
    slugs(withoutDumbbells).every((slug) => !bySlug.get(slug)?.requires.includes("dumbbells")),
  );
  assert.ok(slugs(withoutDumbbells).includes("reverse-lunge"));
});

test("equipment kinds gate the pools they are supposed to gate", () => {
  const kit = (equipment: EquipmentKind[]): Location => ({
    id: "test",
    name: "Test",
    equipment,
    excludedExerciseSlugs: [],
    displayOrder: 0,
  });
  const generate = (equipment: EquipmentKind[], primaryGoal: TrainingGoal) =>
    generateWeeklyPlan({ ...baseProfile, primaryGoal, locationId: "test" }, EXERCISES, [
      kit(equipment),
    ]);

  // A floorless place cannot fill a core day: general_fitness and conditioning fail.
  const floorless = generate(["bodyweight", "furniture", "dumbbells"], "conditioning");
  assert.equal(floorless.ok, false);
  assert.ok(
    !floorless.ok && floorless.issues.some((i) => i.code === "insufficient_eligible_exercises"),
  );
  assert.match(floorless.ok ? "" : (floorless.issues[0]?.message ?? ""), /proper floor/);

  // Mobility is all standing or chair-assisted, so it generates on bodyweight alone.
  assert.equal(generate(["bodyweight"], "mobility_balance").ok, true);

  // The full kit generates every goal.
  for (const goal of ["general_fitness", "strength", "conditioning", "mobility_balance"] as const) {
    assert.equal(generate(["bodyweight", "furniture", "dumbbells", "floor"], goal).ok, true);
  }
});

test("catalog gaps, stale exclusions, prescriptions, and duration are explicit", () => {
  const missing = generateWeeklyPlan(
    baseProfile,
    EXERCISES.filter((exercise) => exercise.slug !== "tactical-jack"),
    [homeLocation],
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

  const staleExclusion = planFor({}, [
    { ...homeLocation, excludedExerciseSlugs: ["retired-exercise"] },
  ]);
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
