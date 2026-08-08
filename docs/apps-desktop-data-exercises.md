---
id: apps-desktop-data-exercises
source: apps/desktop/src/data/exercises.ts
updated: 2026-08-08
depends_on: []
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
3. Every exercise declares instructions, tips, difficulty, muscle groups, equipment, and at least one source reference.
4. The mobility category contains 22 Tai Chi, chair Tai Chi, mobility, and balance records.
5. The mobility records cite all four Tai Chi PDFs from `/Users/hebbar/Downloads/Telegram Desktop`.
6. The earlier strength catalog records cite the four basic, calisthenics, military, and military calisthenics PDFs from the same directory.
7. Web references include NHS and VA Tai Chi or chair-exercise guidance alongside the local PDF references.
8. This module performs no database I/O; `seed()` in `apps/desktop/src/data/db.ts` persists these arrays.

## Invariants
- Every category slug is unique.
- Every exercise slug is unique.
- Every `categorySlug` names an entry in `CATEGORIES`.
- `equipment` is always `bodyweight`, `dumbbells`, or `both`.
- `difficulty` is always `beginner`, `intermediate`, or `advanced`.
- `displayOrder` determines presentation order inside a category.
- Source references preserve the originating local PDF path or web URL.

## Gotchas
- Local PDF source URLs are absolute `file://` URLs for the current workstation; another machine cannot open them without the same paths.
- Adding a record with an existing slug replaces the persisted database row during `seed()`.
- Renaming a category slug without migrating every exercise leaves records outside that category filter.

## Related
None.
