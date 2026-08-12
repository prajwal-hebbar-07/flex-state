---
id: apps-desktop-data-progress
source: apps/desktop/src/data/progress.ts
updated: 2026-08-10
depends_on: []
status: current
---

## Purpose
Defines the pure, dependency-free workout completion contract and derives local player progression from completion history.

## Contract

```ts
export type HunterRank = "E" | "D" | "C" | "B" | "A" | "S";

export interface WorkoutCompletion {
  completedOn: string;
  completedAt: string;
  planDay: number;
  sessionTitle: string;
  planName: string;
  locationId: string;
  durationMinutes: number;
  xp: number;
}

export interface PlayerProgress {
  totalXp: number;
  level: number;
  rank: HunterRank;
  levelXp: number;
  levelXpTarget: 1000;
  currentStreak: number;
  weeklyCompleted: number;
}

export function localDateKey(date: Date): string;
export function questXp(targetDurationMin: number): number;
export function summarizeProgress(
  completions: WorkoutCompletion[],
  now: Date,
): PlayerProgress;
export function isWorkoutCompletion(value: unknown): value is WorkoutCompletion;
```

## Behavior
1. `localDateKey()` formats local `getFullYear()`, `getMonth()`, and `getDate()` values as `YYYY-MM-DD`; it never slices a UTC ISO string.
2. `questXp(minutes)` returns `minutes * 10`.
3. Total XP is the sum of completion XP. Level is `floor(totalXp / 1000) + 1`, and `levelXp` is `totalXp % 1000`.
4. Rank boundaries are E at levels 1-9, D at 10-19, C at 20-29, B at 30-39, A at 40-49, and S at 50 or above.
5. Streak calculation deduplicates completion dates. It counts backward from today or yesterday only; an older or future most-recent date yields zero.
6. Weekly completion counts distinct local dates from the current local Monday through Sunday.
7. `isWorkoutCompletion()` validates the full object, real local calendar dates, parseable completion timestamps, nonblank text, positive integer day/duration, integer XP, and `xp === questXp(durationMinutes)`.

## Invariants
- No React, Tauri, SQLite, or network imports.
- The level XP target is always 1000.
- Rank, streak, and weekly count are never persisted by this module.
- Date membership compares canonical local date keys.

## Gotchas
- Clock and timezone changes can change local streak and week results by design.
- `summarizeProgress()` accepts typed completion objects and does not revalidate them; database rows must pass `isWorkoutCompletion()` first.
- The database primary key prevents duplicate dates, but summarization still deduplicates dates for streak and weekly counts.

## Related
[[apps-desktop-data-db]]
[[apps-desktop-app]]
[[apps-desktop-personalized-plan]]
