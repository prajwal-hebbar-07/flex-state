---
id: apps-desktop-data-db
source: apps/desktop/src/data/db.ts, apps/desktop/src/data/schema.sql
updated: 2026-08-10
depends_on: [apps-desktop-data-exercises, apps-desktop-data-progress, apps-desktop-data-schedule, apps-desktop-data-locations]
status: current
---

## Purpose
Owns the Tauri SQLite connection, idempotent schema/catalog setup, locations, the single personalization snapshot, and append-only daily workout completion claims.

## Contract

```ts
export function getDb(): Promise<Database>;
export function migrate(): Promise<void>;
export function seed(): Promise<void>;
export function ensureReady(): Promise<void>;
export function listCategories(): Promise<Category[]>;
export function listExercises(categorySlug?: string): Promise<Exercise[]>;
export function listLocations(): Promise<Location[]>;
export function upsertLocation(location: Location): Promise<void>;
export function deleteLocation(id: string): Promise<void>;

export interface SavedPersonalization {
  profile: PersonalizationProfile;
  plan: WeeklyPlan;
  generatorVersion: typeof PERSONALIZATION_GENERATOR_VERSION;
  generatedAt: string;
  updatedAt: string;
}

export type PersonalizationLoadResult =
  | { kind: "none" }
  | { kind: "ready"; saved: SavedPersonalization }
  | {
      kind: "regeneration_required";
      profile: PersonalizationProfile;
      reason: "invalid_plan_json" | "unsupported_generator_version" | "location_missing";
    }
  | { kind: "invalid_profile"; message: string };

export function loadPersonalization(): Promise<PersonalizationLoadResult>;
export function savePersonalization(
  profile: PersonalizationProfile,
  plan: WeeklyPlan,
): Promise<SavedPersonalization>;
export function clearPersonalization(): Promise<void>;
export function listWorkoutCompletions(): Promise<WorkoutCompletion[]>;
export function claimWorkoutCompletion(completion: WorkoutCompletion): Promise<boolean>;
```

## Behavior
1. `ensureReady()` runs `migrate()`, then `seed()`, then `migrateLegacyPersonalization()`.
2. `migrate()` drops the `exercises` table before applying the schema when `SELECT equipment FROM exercises` succeeds, because that column belongs only to the pre-`requires` shape. The table holds no user data; `seed()` rewrites all 117 rows on every launch.
3. `migrate()` runs `ALTER TABLE exercises ADD COLUMN video TEXT` after the schema and swallows the resulting error on installs that already have the column.
4. `seed()` writes `JSON.stringify(exercise.requires)` into the `requires` column and does not touch the `locations` table. There is no location seeding anywhere in the app.
5. `rowToExercise()` parses `requires` and falls back to `["bodyweight"]` on malformed JSON, so an unparseable row stays eligible somewhere rather than vanishing from every location.
6. `migrateLegacyPersonalization()` is guarded by `SELECT has_dumbbells, excluded_exercise_slugs FROM personalization`. That statement fails on a v2 install and the function returns immediately.
7. On a v1 install holding a profile row, the migration creates one location named `LEGACY_LOCATION_NAME` with `INSERT OR IGNORE`, carrying `has_dumbbells` as its equipment array (`true` adds `dumbbells`; both cases assume `furniture` and `floor`) and `excluded_exercise_slugs` as its exclusions.
8. The migration then rebuilds `personalization` into its v2 shape, copying every column across, writing the new location's id into `location_id`, and leaving `generator_version` at its old value so the next load returns `regeneration_required`.
9. A v1 install with no profile row creates no location and still rebuilds the table, so it reaches the first-run `LocationManager` with an empty list.
10. `listLocations()` orders by `display_order ASC`, parses the two JSON columns, and skips any row failing `isLocation` with a console warning instead of throwing.
11. `upsertLocation()` throws `Error("Location contains invalid values.")` when `isLocation` fails, then executes one `INSERT ... ON CONFLICT(id) DO UPDATE`.
12. `deleteLocation()` reads `personalization.location_id` first and throws `Error("Cannot delete the location your saved plan uses.")` on a match.
13. `loadPersonalization()` returns `none` when fixed row `id = 1` is absent.
14. Loading validates the profile fields, including `location_id`, before checking generator version or plan JSON. It does not check the id against the location list; that reconciliation belongs to `App`.
15. A valid profile with a non-current version returns `regeneration_required` with `unsupported_generator_version` without parsing the plan.
16. A current row with malformed or structurally invalid plan JSON returns `regeneration_required` with `invalid_plan_json`.
17. `savePersonalization()` serializes only the plan, then replaces every saved field with one `INSERT ... ON CONFLICT(id) DO UPDATE` execution. It writes `location_id` and no longer writes `has_dumbbells` or `excluded_exercise_slugs`; neither column exists.
18. Saving uses one ISO timestamp for `generated_at` and `updated_at` and returns the exact saved profile and plan.
19. `clearPersonalization()` deletes only row `id = 1`.

20. `workout_completions.completed_on` is the local-date primary key and has no location foreign key, so one date can award XP once and historical rows survive location deletion.
21. `listWorkoutCompletions()` selects explicit columns in date order, maps them to camelCase, validates with `isWorkoutCompletion()`, and warns before skipping malformed rows.
22. `claimWorkoutCompletion()` validates its input and uses `INSERT OR IGNORE`; `rowsAffected === 1` means the claim was inserted and `false` means that local date already existed.

## Invariants
- At most one personalization row exists per installation.
- Fresh and upgraded installs end with the same `personalization` and `locations` shape.
- A fresh install ends with zero rows in `locations`.
- Profile inputs and plan JSON change atomically in one SQL statement.
- The SQLite table constrains profile literals, booleans, days, duration, and fixed id.
- Invalid profile data takes precedence over stale version and invalid plan data.
- Launch loading never regenerates or overwrites a snapshot.
- A non-current plan passed to `savePersonalization()` throws `Error("Cannot save a plan from an unsupported generator version.")`.
- Completion history is the only persisted progression state; XP, level, rank, streak, weekly count, and quest cursor are derived.
- `clearPersonalization()` never deletes workout completions.

## Gotchas
- `migrateLegacyPersonalization()` runs at most once per installation, guarded by a `SELECT` that fails once the rebuild has happened. It is the only code that creates a location the user did not name, and only on a v1 install that had a saved profile.
- The `personalization_v2` table built by the rebuild deliberately omits the `CHECK` clauses that `schema.sql` declares. Reproducing them there would give two copies of the same constraint text to keep in sync. Copy all of them or none.
- Dropping the legacy `exercises` table uses an explicit flag rather than `.then(drop).catch(() => {})`, which would swallow a failure of the `DROP` itself and leave the old table in place.
- The installed SQL plugin exposes pooled `execute()` calls but no transaction object; multiple calls are not an atomic replacement.
- `clearPersonalization()` is destructive and is reserved for the confirmed reset action in `App`.
- Catalog seeding uses `INSERT OR REPLACE`, so source catalog records remain authoritative for exercise details.
- Completion rows intentionally retain location ids that may no longer resolve.

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-data-locations]]
[[apps-desktop-data-schedule]]
[[apps-desktop-data-progress]]
[[apps-desktop-app]]
