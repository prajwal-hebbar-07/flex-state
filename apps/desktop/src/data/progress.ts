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

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function questXp(targetDurationMin: number): number {
  return targetDurationMin * 10;
}

function isLocalDateKey(value: string): boolean {
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return localDateKey(date) === value;
}

export function isWorkoutCompletion(value: unknown): value is WorkoutCompletion {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.completedOn === "string" &&
    isLocalDateKey(row.completedOn) &&
    typeof row.completedAt === "string" &&
    row.completedAt.trim() !== "" &&
    Number.isFinite(Date.parse(row.completedAt)) &&
    Number.isInteger(row.planDay) &&
    (row.planDay as number) > 0 &&
    typeof row.sessionTitle === "string" &&
    row.sessionTitle.trim() !== "" &&
    typeof row.planName === "string" &&
    row.planName.trim() !== "" &&
    typeof row.locationId === "string" &&
    row.locationId.trim() !== "" &&
    Number.isInteger(row.durationMinutes) &&
    (row.durationMinutes as number) > 0 &&
    Number.isInteger(row.xp) &&
    row.xp === questXp(row.durationMinutes as number)
  );
}

function rankForLevel(level: number): HunterRank {
  if (level >= 50) return "S";
  if (level >= 40) return "A";
  if (level >= 30) return "B";
  if (level >= 20) return "C";
  if (level >= 10) return "D";
  return "E";
}

export function summarizeProgress(completions: WorkoutCompletion[], now: Date): PlayerProgress {
  const totalXp = completions.reduce((sum, completion) => sum + completion.xp, 0);
  const level = Math.floor(totalXp / 1000) + 1;
  const completedDates = new Set(completions.map((completion) => completion.completedOn));

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const latest = [...completedDates].sort().at(-1);
  let currentStreak = 0;
  if (latest === localDateKey(today) || latest === localDateKey(yesterday)) {
    const cursor = new Date(today);
    if (latest === localDateKey(yesterday)) cursor.setDate(cursor.getDate() - 1);
    while (completedDates.has(localDateKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const mondayKey = localDateKey(monday);
  const sundayKey = localDateKey(sunday);
  const weeklyCompleted = [...completedDates].filter(
    (date) => date >= mondayKey && date <= sundayKey,
  ).length;

  return {
    totalXp,
    level,
    rank: rankForLevel(level),
    levelXp: totalXp % 1000,
    levelXpTarget: 1000,
    currentStreak,
    weeklyCompleted,
  };
}
