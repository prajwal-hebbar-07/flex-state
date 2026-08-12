---
id: apps-desktop-data-schedule
source: apps/desktop/src/data/schedule.ts, apps/desktop/src/data/schedule.test.ts, apps/desktop/package.json, apps/desktop/tsconfig.json
updated: 2026-08-11
depends_on: [apps-desktop-data-exercises, apps-desktop-data-locations]
status: current
---

## Purpose
Defines the versioned offline personalization profile, deterministic weekly-plan generator, prescription estimator, and catalog resolver. The generated plan is a snapshot containing exercise slugs and prescriptions rather than duplicated catalog records.

## Contract

```ts
export const PERSONALIZATION_GENERATOR_VERSION = 3 as const;
export type TrainingGoal = "general_fitness" | "strength" | "conditioning" | "mobility_balance";
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6 | 7;
export type SessionMinutes = 15 | 30 | 45;
export type PlanFocus = "lower" | "upper" | "core" | "full_body" | "mobility_balance";
export type BodyFocus = Extract<PlanFocus, "lower" | "upper" | "core">;
export type Impact = "low" | "high";

export interface PersonalizationProfile {
  primaryGoal: TrainingGoal;
  bodyFocuses: BodyFocus[];
  experience: Difficulty;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
  lowImpactOnly: boolean;
  locationId: string;
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
  code:
    | "invalid_profile"
    | "missing_catalog_exercise"
    | "insufficient_eligible_exercises"
    | "location_missing";
  message: string;
  day?: number;
  focus?: PlanFocus;
  slug?: string;
  locationId?: string;
}

export interface FocusReadiness {
  focus: PlanFocus;
  label: string;
  eligible: number;
  missing: EquipmentKind[];
}

export type PlanGenerationResult =
  | { ok: true; plan: WeeklyPlan }
  | { ok: false; issues: PlanGenerationIssue[] };

export interface ResolvedPlan {
  plan: WeeklyPlan;
  bySlug: Map<string, Exercise>;
  missing: string[];
}

export function isPersonalizationProfile(value: unknown): value is PersonalizationProfile;
export function isWeeklyPlan(value: unknown): value is WeeklyPlan;
export function generateWeeklyPlan(
  profile: PersonalizationProfile,
  catalog: Exercise[],
  locations: Location[],
): PlanGenerationResult;
export function locationReadiness(location: Location, catalog: Exercise[]): FocusReadiness[];
export function resolvePlan(plan: WeeklyPlan, catalog: Exercise[]): ResolvedPlan;
export function formatPrescription(prescription: Prescription): string;
export function sessionDurationSec(session: WorkoutSession): number;
```

`apps/desktop/package.json` exposes `pnpm --filter @flex-state/desktop test`. The script runs `schedule.test.ts`, `locations.test.ts`, and `exercises.test.ts` with Node's type stripping and `node:test`; the desktop TypeScript configuration excludes `*.test.ts` because the browser build does not load Node type declarations.

## Behavior
1. `generateWeeklyPlan()` validates the complete profile and returns one `invalid_profile` issue for any invalid value.
2. Generation resolves `profile.locationId` against the `locations` argument and returns one `location_missing` issue carrying that id when nothing matches.
3. Generation prioritizes the selected `bodyFocuses` in profile order, then fills remaining days from the primary goal cycle without duplicating those priorities in the same cycle.
4. Difficulty, equipment, high impact, and exact-slug exclusions are hard filters for warmups and main exercises. Equipment passes when `equipmentCovers(location.equipment, exercise.requires)` holds; exclusions come from `location.excludedExerciseSlugs`, not from the profile.
5. Each session uses the first two eligible warmups and at least two unique main exercises, preferring main slugs not used earlier in the week.
6. The generator adds later main candidates only while the estimated session remains within the requested duration; the mandatory first two may exceed it.
7. Rep estimates use three seconds per repetition and 45 seconds between sets. Timed estimates use the prescribed seconds and 30 seconds between sets. Per-side work doubles work time but not rest.
8. Duration warnings record sessions below 80 percent or above 110 percent of the requested duration. Unknown exclusions produce warnings and do not prevent generation.
9. `resolvePlan()` maps a saved snapshot to the live catalog and reports unique missing slugs without changing the plan.
10. An `insufficient_eligible_exercises` message always ends with `Change exclusions or profile constraints.` and appends ` Add <labels> at <location name>, or pick another place.` when the focus pool needs equipment the location lacks.
11. `locationReadiness()` returns one entry per `PlanFocus` counting the pool candidates that pass the equipment and exclusion filters at that location, plus the kinds the location is missing. It ignores difficulty and impact.
12. Generation uses ordered pools and no randomness, clock, network, account, or AI service.

## Invariants
- Generator version `3` is embedded in every valid snapshot.
- Identical profile and catalog inputs produce deeply equal plan objects.
- A main slug occurs at most once in a session.
- Filters are never relaxed to satisfy exercise count or duration.
- Every successful day contains at least two warmups and two main exercises.
- Candidate impact is explicit planner metadata and is not inferred from exercise names.

## Gotchas
- The v1 boolean maps onto locations exactly: `hasDumbbells: true` is `["bodyweight", "furniture", "dumbbells", "floor"]` and `hasDumbbells: false` is `["bodyweight", "furniture", "floor"]`. `schedule.test.ts` asserts both rows.
- A location without `floor` leaves the `core` pool with one eligible exercise (`wall-crunch`), so the `general_fitness` and `conditioning` goals cannot generate there at all. Without `dumbbells` as well, `upper` starves too. This is correct and unavoidable; `LocationManager`'s readiness line exists so the user sees it before hitting Save.
- `mobility_balance` is the one goal that generates on `["bodyweight"]` alone: every non-chair-assisted mobility exercise is standing.
- An exercise with an empty `requires` would be eligible everywhere, because `[].every(...)` is `true`. No catalog record has one; every record requires `bodyweight`.
- Removing a planner candidate from the catalog prevents generation; removing only an excluded slug produces `unknown_exclusion`.
- A warmup slug may also appear in the same session's main pool because warmup use does not count as main-work reuse.
- `schedule.ts` and its tests use explicit `.ts` import extensions so `node --experimental-strip-types` resolves them; `apps/desktop/tsconfig.json` sets `allowImportingTsExtensions` for that reason. The tests stay outside the browser TypeScript project.

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-data-locations]]
[[apps-desktop-data-db]]
[[apps-desktop-personalized-plan]]
