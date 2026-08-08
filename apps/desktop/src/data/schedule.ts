// Combined weekly workout plan generated from the catalog.
// Synthesizes the 3 rotating-structure PDFs (Basic Home Workouts, Calisthenics,
// Military) plus the 21-Day Military Calisthenics structure. The 7-day schedule
// repeats each workout type twice, with Day 7 as a Full-Body Challenge, matching
// the original printable plan layouts.
//
// Each prescription is a list of (exercise slug, prescribed dose). The dose is
// either a count like "3x10" or a duration like "1 min". All doses in this plan
// are beginner-friendly and rely only on bodyweight + a 5 kg dumbbell pair.

import type { Exercise } from "./exercises";

export type Dose = `${number}x${number}` | `${number} min` | `${number} sec` | string;

export interface PrescribedExercise {
  slug: string;
  dose: Dose;
  notes?: string;
}

export interface WorkoutSession {
  title: string;
  focus: string;
  durationMin: number;
  warmup: PrescribedExercise[];
  main: PrescribedExercise[];
}

export interface WorkoutDay {
  day: number;
  label: string;
  session: WorkoutSession;
}

export interface WeeklyPlan {
  name: string;
  equipment: "bodyweight + 5 kg dumbbells";
  days: WorkoutDay[];
}

// One template for the rotating-structure PDFs. Day 1/4 = Lower Body,
// Day 2/5 = Upper Body, Day 3/6 = Core, Day 7 = Full-Body Challenge.
export const WEEKLY_TEMPLATE: WeeklyPlan = {
  name: "Combined Home Workout — 7-Day Plan",
  equipment: "bodyweight + 5 kg dumbbells",
  days: [
    {
      day: 1,
      label: "Lower Body",
      session: {
        title: "Lower Body 1",
        focus: "Legs, glutes, calves",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "high-knees", dose: "1 min" },
        ],
        main: [
          { slug: "bodyweight-squat", dose: "3x10" },
          { slug: "reverse-lunge", dose: "2x10 each leg" },
          { slug: "static-glute-bridge", dose: "3x20 sec" },
          { slug: "squat-pulse", dose: "2x30 sec" },
          { slug: "calf-raise", dose: "2x15" },
        ],
      },
    },
    {
      day: 2,
      label: "Upper Body",
      session: {
        title: "Upper Body 1",
        focus: "Chest, back, shoulders, arms",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "high-knees", dose: "1 min" },
        ],
        main: [
          { slug: "push-up", dose: "3x8" },
          {
            slug: "dumbbell-bent-over-row",
            dose: "3x10 each side",
            notes: "Use 5 kg dumbbells; if unavailable, sub inverted-row.",
          },
          { slug: "dumbbell-overhead-press", dose: "3x10" },
          { slug: "dumbbell-bicep-curl", dose: "2x12" },
          { slug: "bench-dip", dose: "2x10" },
        ],
      },
    },
    {
      day: 3,
      label: "Core",
      session: {
        title: "Core 1",
        focus: "Abs, obliques, lower back",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "tactical-march", dose: "1 min" },
        ],
        main: [
          { slug: "sit-up", dose: "2x15" },
          { slug: "bicycle-crunch", dose: "2x20" },
          { slug: "front-plank", dose: "3x30 sec" },
          { slug: "mountain-climber", dose: "2x30 sec" },
          { slug: "superman", dose: "2x12" },
        ],
      },
    },
    {
      day: 4,
      label: "Lower Body",
      session: {
        title: "Lower Body 2",
        focus: "Quads, glutes, hip stability",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "high-knees", dose: "1 min" },
        ],
        main: [
          {
            slug: "goblet-squat",
            dose: "3x10",
            notes: "Hold a 5 kg dumbbell at chest.",
          },
          { slug: "military-lunge", dose: "2x10 each leg" },
          {
            slug: "plyo-single-leg-glute-bridge",
            dose: "3x6 each leg",
            notes: "Regression: alternate slow single-leg glute bridges.",
          },
          { slug: "squat-side-step", dose: "2x30 sec" },
          { slug: "wall-sit", dose: "2x30 sec" },
        ],
      },
    },
    {
      day: 5,
      label: "Upper Body",
      session: {
        title: "Upper Body 2",
        focus: "Chest, back, shoulders, triceps",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "high-knees", dose: "1 min" },
        ],
        main: [
          { slug: "diamond-push-up", dose: "3x6" },
          {
            slug: "single-arm-dumbbell-row",
            dose: "3x10 each arm",
            notes: "5 kg dumbbell; support hand/knee on a bench.",
          },
          { slug: "lateral-raise", dose: "2x12" },
          { slug: "dumbbell-tricep-extension", dose: "2x12" },
          { slug: "low-to-high-plank", dose: "2x6 each side" },
        ],
      },
    },
    {
      day: 6,
      label: "Core",
      session: {
        title: "Core 2",
        focus: "Anti-rotation, obliques, total core",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "tactical-march", dose: "1 min" },
        ],
        main: [
          { slug: "plank-shoulder-tap", dose: "2x40 sec" },
          { slug: "plank-knee-to-elbow", dose: "2x20" },
          { slug: "oblique-crunch", dose: "2x15 each side" },
          { slug: "side-plank", dose: "2x25 sec each side" },
          { slug: "wall-crunch", dose: "2x15" },
        ],
      },
    },
    {
      day: 7,
      label: "Full-Body Challenge",
      session: {
        title: "Full-Body Challenge",
        focus: "Strength + stamina benchmark",
        durationMin: 5,
        warmup: [
          { slug: "tactical-jack", dose: "1 min" },
          { slug: "high-knees", dose: "1 min" },
        ],
        main: [
          { slug: "push-up", dose: "1 min" },
          { slug: "bodyweight-squat", dose: "1 min" },
          { slug: "mountain-climber", dose: "1 min" },
          { slug: "reverse-lunge", dose: "1 min" },
          { slug: "bear-crawl", dose: "1 min" },
        ],
      },
    },
  ],
};

// Resolve the plan against the live catalog and report any missing slugs.
export interface ResolvedPlan {
  plan: WeeklyPlan;
  bySlug: Map<string, Exercise>;
  missing: string[];
}

export function resolvePlan(catalog: Exercise[]): ResolvedPlan {
  const bySlug = new Map<string, Exercise>(catalog.map((e) => [e.slug, e]));
  const missing: string[] = [];
  for (const day of WEEKLY_TEMPLATE.days) {
    for (const item of [...day.session.warmup, ...day.session.main]) {
      if (!bySlug.has(item.slug)) missing.push(item.slug);
    }
  }
  return { plan: WEEKLY_TEMPLATE, bySlug, missing };
}

// Helper: total estimated seconds for a session (rough).
export function sessionDurationSec(session: WorkoutSession): number {
  const all = [...session.warmup, ...session.main];
  let secs = 0;
  for (const item of all) {
    if (item.dose.endsWith("min")) {
      secs += parseInt(item.dose, 10) * 60;
    } else {
      const m = item.dose.match(/^(\d+)x(\d+)/);
      if (m) {
        const sets = parseInt(m[1] ?? "0", 10);
        const reps = parseInt(m[2] ?? "0", 10);
        secs += sets * (reps * 3 + 45); // ~3 s per rep + 45 s rest
      } else if (item.dose.endsWith("sec")) {
        secs += parseInt(item.dose, 10);
      }
    }
  }
  return secs;
}
