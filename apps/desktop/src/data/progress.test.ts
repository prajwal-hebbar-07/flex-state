import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorkoutCompletion,
  localDateKey,
  questXp,
  summarizeProgress,
  type WorkoutCompletion,
} from "./progress.ts";

function completion(completedOn: string, durationMinutes = 10): WorkoutCompletion {
  return {
    completedOn,
    completedAt: `${completedOn}T12:00:00.000Z`,
    planDay: 1,
    sessionTitle: "Full Body",
    planName: "Weekly Plan",
    locationId: "home",
    durationMinutes,
    xp: questXp(durationMinutes),
  };
}

function historyForTotalXp(totalXp: number): WorkoutCompletion[] {
  const rows: WorkoutCompletion[] = [];
  for (let remaining = totalXp, day = 1; remaining > 0; day += 1) {
    const xp = Math.min(remaining, 100);
    rows.push(completion(`2025-01-${String(day).padStart(2, "0")}`, xp / 10));
    remaining -= xp;
  }
  return rows;
}

test("localDateKey uses local calendar fields", () => {
  assert.equal(localDateKey(new Date(2026, 0, 2, 23, 59)), "2026-01-02");
  assert.equal(localDateKey(new Date(2026, 10, 12, 0, 1)), "2026-11-12");
});

test("questXp awards ten XP per target minute", () => {
  assert.equal(questXp(15), 150);
  assert.equal(questXp(30), 300);
  assert.equal(questXp(45), 450);
});

test("level and rank boundaries are exact", () => {
  const now = new Date(2026, 7, 10);
  for (const [totalXp, level, rank] of [
    [0, 1, "E"],
    [1000, 2, "E"],
    [8000, 9, "E"],
    [9000, 10, "D"],
    [18000, 19, "D"],
    [19000, 20, "C"],
    [28000, 29, "C"],
    [29000, 30, "B"],
    [38000, 39, "B"],
    [39000, 40, "A"],
    [48000, 49, "A"],
    [49000, 50, "S"],
  ] as const) {
    const progress = summarizeProgress(historyForTotalXp(totalXp), now);
    assert.equal(progress.level, level, `${totalXp} XP level`);
    assert.equal(progress.rank, rank, `${totalXp} XP rank`);
    assert.equal(progress.levelXp, totalXp % 1000);
    assert.equal(progress.levelXpTarget, 1000);
  }
});

test("weekly count uses Monday through Sunday and distinct dates", () => {
  const monday = new Date(2026, 7, 10);
  const rows = [
    completion("2026-08-09"),
    completion("2026-08-10"),
    completion("2026-08-10"),
    completion("2026-08-16"),
    completion("2026-08-17"),
  ];
  assert.equal(summarizeProgress(rows, monday).weeklyCompleted, 2);
  assert.equal(summarizeProgress(rows, new Date(2026, 7, 16)).weeklyCompleted, 2);
});

test("streak counts adjacent dates regardless of input order", () => {
  const rows = [completion("2026-08-08"), completion("2026-08-10"), completion("2026-08-09")];
  assert.equal(summarizeProgress(rows, new Date(2026, 7, 10)).currentStreak, 3);
  assert.equal(summarizeProgress(rows.slice(0, 2), new Date(2026, 7, 10)).currentStreak, 1);
});

test("yesterday continues a streak and older history does not", () => {
  assert.equal(
    summarizeProgress([completion("2026-08-09"), completion("2026-08-08")], new Date(2026, 7, 10))
      .currentStreak,
    2,
  );
  assert.equal(
    summarizeProgress([completion("2026-08-08")], new Date(2026, 7, 10)).currentStreak,
    0,
  );
});

test("isWorkoutCompletion validates the persisted contract", () => {
  const valid = completion("2026-08-10", 30);
  assert.equal(isWorkoutCompletion(valid), true);
  for (const invalid of [
    null,
    { ...valid, completedOn: "2026-02-30" },
    { ...valid, completedAt: "not-a-date" },
    { ...valid, planDay: 0 },
    { ...valid, planDay: 1.5 },
    { ...valid, sessionTitle: " " },
    { ...valid, planName: "" },
    { ...valid, locationId: " " },
    { ...valid, durationMinutes: 0 },
    { ...valid, durationMinutes: 1.5 },
    { ...valid, xp: 999 },
  ]) {
    assert.equal(isWorkoutCompletion(invalid), false);
  }
});
