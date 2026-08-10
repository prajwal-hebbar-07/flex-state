---
id: apps-desktop-data-db
source: apps/desktop/src/data/db.ts, apps/desktop/src/data/schema.sql
updated: 2026-08-10
depends_on: [apps-desktop-data-exercises, apps-desktop-data-schedule]
status: current
---

## Purpose
Owns the Tauri SQLite connection, idempotent catalog setup, catalog queries, and the single locally persisted personalization profile and plan snapshot.

## Contract

```ts
export function getDb(): Promise<Database>;
export function migrate(): Promise<void>;
export function seed(): Promise<void>;
export function ensureReady(): Promise<void>;
export function listCategories(): Promise<Category[]>;
export function listExercises(categorySlug?: string): Promise<Exercise[]>;

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
      reason: "invalid_plan_json" | "unsupported_generator_version";
    }
  | { kind: "invalid_profile"; message: string };

export function loadPersonalization(): Promise<PersonalizationLoadResult>;
export function savePersonalization(
  profile: PersonalizationProfile,
  plan: WeeklyPlan,
): Promise<SavedPersonalization>;
export function clearPersonalization(): Promise<void>;
```

## Behavior
1. `ensureReady()` applies the idempotent schema and seeds categories before exercises.
2. `migrate()` runs `ALTER TABLE exercises ADD COLUMN video TEXT` after the schema and swallows the resulting error on installs that already have the column.
3. `loadPersonalization()` returns `none` when fixed row `id = 1` is absent.
4. Loading parses and validates profile exclusions and fields before checking generator version or plan JSON.
5. A valid profile with a non-current version returns `regeneration_required` with `unsupported_generator_version` without parsing the plan.
6. A current row with malformed or structurally invalid plan JSON returns `regeneration_required` with `invalid_plan_json`.
7. `savePersonalization()` serializes only exclusions and the plan, then replaces every saved field with one `INSERT ... ON CONFLICT(id) DO UPDATE` execution.
8. Saving uses one ISO timestamp for `generated_at` and `updated_at` and returns the exact saved profile and plan.
9. `clearPersonalization()` deletes only row `id = 1`.

## Invariants
- At most one personalization row exists per installation.
- Profile inputs and plan JSON change atomically in one SQL statement.
- The SQLite table constrains profile literals, booleans, days, duration, and fixed id.
- Invalid profile data takes precedence over stale version and invalid plan data.
- Launch loading never regenerates or overwrites a snapshot.
- A non-current plan passed to `savePersonalization()` throws `Error("Cannot save a plan from an unsupported generator version.")`.

## Gotchas
- The installed SQL plugin exposes pooled `execute()` calls but no transaction object; multiple calls are not an atomic replacement.
- `clearPersonalization()` is destructive and is reserved for the confirmed reset action in `App`.
- Catalog seeding uses `INSERT OR REPLACE`, so source catalog records remain authoritative for exercise details.

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-data-schedule]]
[[apps-desktop-app]]
