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
export type Equipment = "bodyweight" | "dumbbells" | "both";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface SourceRef {
  label: string;
  url: string;
}

export interface Exercise {
  slug: string;
  name: string;
  categorySlug: string;
  subCategory?: string;
  equipment: Equipment;
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
3. Every exercise declares instructions, tips, difficulty, muscle groups, equipment, and a `video` URL.
4. Every `video` is a `https://www.youtube.com/watch?v=<id>` URL. No record omits it.
5. The mobility category contains 22 Tai Chi, chair Tai Chi, mobility, and balance records.
6. `sourceRefs` holds web URLs only. Nine records carry an empty `sourceRefs` array because their only citations were local PDFs.
7. Web references include NHS and VA Tai Chi or chair-exercise guidance.
8. This module performs no database I/O; `seed()` in `apps/desktop/src/data/db.ts` persists these arrays.

## Invariants
- Every category slug is unique.
- Every exercise slug is unique.
- Every `categorySlug` names an entry in `CATEGORIES`.
- `equipment` is always `bodyweight`, `dumbbells`, or `both`.
- `difficulty` is always `beginner`, `intermediate`, or `advanced`.
- `displayOrder` determines presentation order inside a category.
- Source references are always resolvable `https://` URLs.
- `video` is always present and always a YouTube watch URL.

## Gotchas
- Nine records have an empty `sourceRefs`; the detail pane omits the sources line rather than rendering an empty list.
- Video URLs point at third-party uploads. A deleted or embedding-disabled upload renders an empty player, and nothing in the app detects that.
- Adding a record with an existing slug replaces the persisted database row during `seed()`.
- Renaming a category slug without migrating every exercise leaves records outside that category filter.

## Related
[[apps-desktop-data-db]]
[[apps-desktop-exercise-browser]]
[[apps-desktop-data-schedule]]
[[apps-desktop-personalized-plan]]
