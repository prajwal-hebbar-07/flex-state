---
id: apps-desktop-data-locations
source: apps/desktop/src/data/locations.ts, apps/desktop/src/data/locations.test.ts
updated: 2026-08-10
depends_on: [apps-desktop-data-exercises]
status: current
---

## Purpose
Defines a named place the user trains in, the equipment kinds available there, and the exercises they exclude there. A `PersonalizationProfile` references exactly one location, and that reference is the only record of which place the saved plan was generated for.

## Contract

```ts
export interface Location {
  /** Immutable slug, [a-z0-9-]+. Derived from the first name given, never recomputed. */
  id: string;
  name: string;
  equipment: EquipmentKind[];
  excludedExerciseSlugs: string[];
  displayOrder: number;
}

export const LEGACY_LOCATION_NAME = "My usual place";

export function equipmentCovers(owned: EquipmentKind[], required: EquipmentKind[]): boolean;
export function normalizeLocationId(raw: string): string;
export function isLocation(value: unknown): value is Location;
```

## Behavior
1. `equipmentCovers(owned, required)` returns `required.every((kind) => owned.includes(kind))`. There is no branch on any specific kind.
2. `equipmentCovers(owned, [])` is `true` for every `owned`, including `[]`.
3. `normalizeLocationId` lowercases, replaces every run of non-`[a-z0-9]` with a single `-`, and strips leading and trailing `-`. `"  The Park!  "` returns `"the-park"`.
4. `normalizeLocationId` returns `""` when the input holds no ASCII alphanumerics. The caller substitutes `` `location-${crypto.randomUUID().slice(0, 8)}` ``; it does not reject the name.
5. `isLocation` requires `id` to match `/^[a-z0-9]+(-[a-z0-9]+)*$/`, `name` to be a string with a non-empty `trim()`, `equipment` to be a non-empty array of unique values drawn from `EQUIPMENT_KINDS`, `excludedExerciseSlugs` to be an array of unique strings, and `displayOrder` to be a non-negative integer.
6. `LEGACY_LOCATION_NAME` is the name the v1 database migration gives the one location it creates. Nothing else in the app generates a location name.
7. This module performs no database I/O and holds no state.

## Invariants
- `Location.id` never changes after creation. Renaming a location changes only `name`.
- `equipment` is never empty; a location with no equipment is rejected at the form, not discovered at generation time.
- `Location` and `Exercise.requires` use the same `EquipmentKind` vocabulary, so eligibility is a subset test with no translation step.
- No location exists on a fresh install. The `locations` table is legitimately empty until the user names a place.

## Gotchas
- SQLite cannot `CHECK`-constrain the contents of a JSON array, so `isLocation` is the only defense on `equipment` and `excludedExerciseSlugs`. It is called from `upsertLocation` (throwing), from `listLocations` (skipping the row), and from `LocationManager` before save.
- `Location.id` is immutable because the saved profile references it; renaming `Garage` to `Shed` leaves `garage` in the database. The id is never shown in the UI.
- `normalizeLocationId` returns `""` for any name written in a non-Latin script. Treating that as a validation error would reject perfectly good names, so callers must generate an id instead.
- Two distinct names can normalize to the same id (`Nani's house` and `nanis house`). `LocationManager` reports that as a name collision naming the existing place; it never rewrites what the user typed.
- `equipment: ["dumbbells"]` is legal. It is unusual, and it starves most focus pools, which surfaces as `insufficient_eligible_exercises` naming the missing kinds.

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-data-schedule]]
[[apps-desktop-data-db]]
[[apps-desktop-location-manager]]
