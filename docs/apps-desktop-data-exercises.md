---
id: apps-desktop-data-exercises
source: apps/desktop/src/data/exercises.ts, apps/desktop/src/data/exercises.test.ts
updated: 2026-08-10
depends_on: [apps-desktop-exercise-browser]
status: current
---

## Purpose
Defines the categories, exercise records, and source references used to seed the desktop exercise database. The catalog covers bodyweight and 5 kg dumbbell exercises, including Tai Chi, chair Tai Chi, mobility, and balance movements.

## Contract

```ts
export type EquipmentKind = "bodyweight" | "furniture" | "dumbbells" | "floor";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export const EQUIPMENT_KINDS: EquipmentKind[];
export const EQUIPMENT_LABELS: Record<EquipmentKind, string>;

export interface SourceRef {
  label: string;
  url: string;
}

export interface Exercise {
  slug: string;
  name: string;
  categorySlug: string;
  subCategory?: string;
  requires: EquipmentKind[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  difficulty: Difficulty;
  instructions: string;
  tips: string;
  sourceRefs: SourceRef[];
  /** Demo video. YouTube watch URL; the UI swaps it to an embed. */
  video?: string;
  displayOrder: number;
}

export interface Category {
  slug: string;
  name: string;
  displayOrder: number;
}

export const CATEGORIES: Category[];
export const EXERCISES: Exercise[];
```

## Behavior
1. `CATEGORIES` returns eight categories in display order: chest, back, shoulders, arms, legs, core, cardio, and mobility.
2. `EXERCISES` returns 117 records ordered within each category by `displayOrder`.
3. Every exercise declares instructions, tips, difficulty, muscle groups, a non-empty `requires` array, and a `video` URL.
4. Every `video` is a `https://www.youtube.com/watch?v=<id>` URL. No record omits it.
5. The mobility category contains 22 Tai Chi, chair Tai Chi, mobility, and balance records.
6. `sourceRefs` holds web URLs only. Nine records carry an empty `sourceRefs` array because their only citations were local PDFs.
7. Web references include NHS and VA Tai Chi or chair-exercise guidance.
8. `requires` lists every equipment kind the exercise needs at once. A location can run it only when the location's `equipment` is a superset.
9. The 46 slugs reachable by the planner (`WARMUPS` plus every `CANDIDATE_POOLS` entry in `apps/desktop/src/data/schedule.ts`) carry hand-written `requires` tags.
10. The other 71 records carry tags derived from the retired `equipment` field: `"dumbbells"` became `["bodyweight", "dumbbells"]`, `"bodyweight"` and `"both"` became `["bodyweight"]`.
11. `EQUIPMENT_KINDS` is the render order for every equipment checklist and filter in the app. `EQUIPMENT_LABELS` supplies the user-facing text; no component hardcodes a kind string.
12. This module performs no database I/O; `seed()` in `apps/desktop/src/data/db.ts` persists these arrays.

## Invariants
- Every category slug is unique.
- Every exercise slug is unique.
- Every `categorySlug` names an entry in `CATEGORIES`.
- `requires` is always non-empty and every member is in `EQUIPMENT_KINDS`, asserted in `exercises.test.ts`.
- Every record requires `bodyweight`.
- `difficulty` is always `beginner`, `intermediate`, or `advanced`.
- `displayOrder` determines presentation order inside a category.
- Source references are always resolvable `https://` URLs.
- `video` is always present and always a YouTube watch URL.

## Gotchas
- The 71 exercises outside the planner pools carry derived `requires` tags covering bodyweight and dumbbells only; their furniture and floor needs are not modelled, so the library equipment filter is approximate for them.
- No catalog exercise models a pull-up bar. `pull-up`, `chin-up`, `inverted-row`, and `handstand-hold` are tagged `["bodyweight"]` and are library-only, so no generated plan can prescribe them.
- `furniture` covers walls as well as chairs and benches; its label reads `A chair, bench, or wall`. `wall-sit` and `wall-crunch` require it.
- Nine records have an empty `sourceRefs`; the detail pane omits the sources line rather than rendering an empty list.
- Video URLs point at third-party uploads. A deleted or embedding-disabled upload renders an empty player, and nothing in the app detects that.
- Adding a record with an existing slug replaces the persisted database row during `seed()`.
- Renaming a category slug without migrating every exercise leaves records outside that category filter.

## Related
[[apps-desktop-data-locations]]
[[apps-desktop-data-db]]
[[apps-desktop-exercise-browser]]
[[apps-desktop-data-schedule]]
[[apps-desktop-personalized-plan]]
