---
id: apps-desktop-data-schedule
source: apps/desktop/src/data/schedule.ts, apps/desktop/src/data/schedule.test.ts, apps/desktop/package.json, apps/desktop/tsconfig.json
updated: 2026-08-09
depends_on: [apps-desktop-data-exercises]
status: current
---

## Purpose
Defines the versioned offline personalization profile, deterministic weekly-plan generator, prescription estimator, and catalog resolver. The generated plan is a snapshot containing exercise slugs and prescriptions rather than duplicated catalog records.

## Contract

```ts
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

export function isPersonalizationProfile(value: unknown): value is PersonalizationProfile;
export function isWeeklyPlan(value: unknown): value is WeeklyPlan;
export function generateWeeklyPlan(
  profile: PersonalizationProfile,
  catalog: Exercise[],
): PlanGenerationResult;
export function resolvePlan(plan: WeeklyPlan, catalog: Exercise[]): ResolvedPlan;
export function formatPrescription(prescription: Prescription): string;
export function sessionDurationSec(session: WorkoutSession): number;
```

`apps/desktop/package.json` exposes `pnpm --filter @flex-state/desktop test`. The script runs `schedule.test.ts` with Node's type stripping and `node:test`; the desktop TypeScript configuration excludes `*.test.ts` because the browser build does not load Node type declarations.

## Behavior
1. `generateWeeklyPlan()` validates the complete profile and returns one `invalid_profile` issue for any invalid value or duplicate exclusion.
2. Generation validates every candidate slug needed by the selected focus cycle before applying profile filters and reports unique catalog gaps in candidate order.
3. Difficulty, dumbbell-only equipment, high impact, and exact-slug exclusions are hard filters for warmups and main exercises.
4. Each session uses the first two eligible warmups and at least two unique main exercises, preferring main slugs not used earlier in the week.
5. The generator adds later main candidates only while the estimated session remains within the requested duration; the mandatory first two may exceed it.
6. Rep estimates use three seconds per repetition and 45 seconds between sets. Timed estimates use the prescribed seconds and 30 seconds between sets. Per-side work doubles work time but not rest.
7. Duration warnings record sessions below 80 percent or above 110 percent of the requested duration. Unknown exclusions produce warnings and do not prevent generation.
8. `resolvePlan()` maps a saved snapshot to the live catalog and reports unique missing slugs without changing the plan.
9. Generation uses ordered pools and no randomness, clock, network, account, or AI service.

## Invariants
- Generator version `1` is embedded in every valid snapshot.
- Identical profile and catalog inputs produce deeply equal plan objects.
- A main slug occurs at most once in a session.
- Filters are never relaxed to satisfy exercise count or duration.
- Every successful day contains at least two warmups and two main exercises.
- Candidate impact is explicit planner metadata and is not inferred from exercise names.

## Gotchas
- Catalog records with equipment `both` remain eligible when `hasDumbbells` is false because they support bodyweight use.
- Removing a planner candidate from the catalog prevents generation; removing only an excluded slug produces `unknown_exclusion`.
- A warmup slug may also appear in the same session's main pool because warmup use does not count as main-work reuse.
- Tests use explicit `.ts` import extensions for Node execution and are intentionally outside the browser TypeScript project.

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-data-db]]
[[apps-desktop-personalized-plan]]
