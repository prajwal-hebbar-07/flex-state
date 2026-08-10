import Database from "@tauri-apps/plugin-sql";
import { CATEGORIES, type Category, EXERCISES, type Exercise } from "./exercises";
import {
  isPersonalizationProfile,
  isWeeklyPlan,
  PERSONALIZATION_GENERATOR_VERSION,
  type PersonalizationProfile,
  type WeeklyPlan,
} from "./schedule";
import schemaSql from "./schema.sql?raw";

// DB filename lives in the app's data directory by default in tauri-plugin-sql.
const DB_URL = "sqlite:flex_state.db";

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

export async function migrate(): Promise<void> {
  const db = await getDb();
  // schema.sql contains CREATE TABLE / CREATE INDEX statements, all idempotent.
  await db.execute(schemaSql);
  // CREATE TABLE IF NOT EXISTS is a no-op on installs made before `video` existed,
  // so add it separately. Throws "duplicate column name" once it is there.
  await db.execute("ALTER TABLE exercises ADD COLUMN video TEXT").catch(() => {});
}

export async function seed(): Promise<void> {
  const db = await getDb();
  // Categories first (FK target). INSERT OR IGNORE makes seeding safe to re-run.
  for (const c of CATEGORIES) {
    await db.execute(
      "INSERT OR IGNORE INTO categories (slug, name, display_order) VALUES ($1, $2, $3)",
      [c.slug, c.name, c.displayOrder],
    );
  }
  for (const ex of EXERCISES) {
    await db.execute(
      `INSERT OR REPLACE INTO exercises (
        slug, name, category_slug, sub_category, equipment,
        primary_muscles, secondary_muscles, difficulty,
        instructions, tips, source_refs, video, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        ex.slug,
        ex.name,
        ex.categorySlug,
        ex.subCategory ?? null,
        ex.equipment,
        ex.primaryMuscles.join(","),
        ex.secondaryMuscles.join(","),
        ex.difficulty,
        ex.instructions,
        ex.tips,
        JSON.stringify(ex.sourceRefs),
        ex.video ?? null,
        ex.displayOrder,
      ],
    );
  }
}

export async function ensureReady(): Promise<void> {
  await migrate();
  await seed();
}

interface DbExerciseRow {
  slug: string;
  name: string;
  category_slug: string;
  sub_category: string | null;
  equipment: "bodyweight" | "dumbbells" | "both";
  primary_muscles: string;
  secondary_muscles: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  instructions: string;
  tips: string;
  source_refs: string;
  video: string | null;
  display_order: number;
}

interface DbCategoryRow {
  slug: string;
  name: string;
  display_order: number;
}

function rowToExercise(row: DbExerciseRow): Exercise {
  let refs: { label: string; url: string }[] = [];
  try {
    refs = JSON.parse(row.source_refs);
  } catch {
    refs = [];
  }
  return {
    slug: row.slug,
    name: row.name,
    categorySlug: row.category_slug,
    subCategory: row.sub_category ?? undefined,
    equipment: row.equipment,
    primaryMuscles: row.primary_muscles.split(",").filter(Boolean),
    secondaryMuscles: row.secondary_muscles.split(",").filter(Boolean),
    difficulty: row.difficulty,
    instructions: row.instructions,
    tips: row.tips,
    sourceRefs: refs,
    video: row.video ?? undefined,
    displayOrder: row.display_order,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = (await db.select<DbCategoryRow[]>(
    "SELECT slug, name, display_order FROM categories ORDER BY display_order ASC",
  )) as unknown as DbCategoryRow[];
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    displayOrder: r.display_order,
  }));
}

export async function listExercises(categorySlug?: string): Promise<Exercise[]> {
  const db = await getDb();
  const rows = categorySlug
    ? ((await db.select<DbExerciseRow[]>(
        "SELECT * FROM exercises WHERE category_slug = $1 ORDER BY display_order ASC",
        [categorySlug],
      )) as unknown as DbExerciseRow[])
    : ((await db.select<DbExerciseRow[]>(
        "SELECT * FROM exercises ORDER BY category_slug, display_order ASC",
      )) as unknown as DbExerciseRow[]);
  return rows.map(rowToExercise);
}

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

interface DbPersonalizationRow {
  primary_goal: unknown;
  experience: unknown;
  days_per_week: unknown;
  session_minutes: unknown;
  has_dumbbells: unknown;
  low_impact_only: unknown;
  excluded_exercise_slugs: unknown;
  generator_version: unknown;
  plan_json: unknown;
  generated_at: string;
  updated_at: string;
}

export async function loadPersonalization(): Promise<PersonalizationLoadResult> {
  const db = await getDb();
  const rows = (await db.select<DbPersonalizationRow[]>(
    `SELECT primary_goal, experience, days_per_week, session_minutes,
      has_dumbbells, low_impact_only, excluded_exercise_slugs,
      generator_version, plan_json, generated_at, updated_at
    FROM personalization WHERE id = 1`,
  )) as unknown as DbPersonalizationRow[];
  const row = rows[0];
  if (!row) return { kind: "none" };

  let excludedExerciseSlugs: unknown;
  try {
    if (typeof row.excluded_exercise_slugs !== "string") {
      throw new TypeError("Expected exclusion JSON.");
    }
    excludedExerciseSlugs = JSON.parse(row.excluded_exercise_slugs);
  } catch {
    return {
      kind: "invalid_profile",
      message: "Saved personalization profile is invalid.",
    };
  }

  const profileValue = {
    primaryGoal: row.primary_goal,
    experience: row.experience,
    daysPerWeek: row.days_per_week,
    sessionMinutes: row.session_minutes,
    hasDumbbells:
      row.has_dumbbells === 0 ? false : row.has_dumbbells === 1 ? true : row.has_dumbbells,
    lowImpactOnly:
      row.low_impact_only === 0 ? false : row.low_impact_only === 1 ? true : row.low_impact_only,
    excludedExerciseSlugs,
  };
  if (!isPersonalizationProfile(profileValue)) {
    return {
      kind: "invalid_profile",
      message: "Saved personalization profile is invalid.",
    };
  }

  if (row.generator_version !== PERSONALIZATION_GENERATOR_VERSION) {
    return {
      kind: "regeneration_required",
      profile: profileValue,
      reason: "unsupported_generator_version",
    };
  }

  let planValue: unknown;
  try {
    if (typeof row.plan_json !== "string") {
      throw new TypeError("Expected plan JSON.");
    }
    planValue = JSON.parse(row.plan_json);
  } catch {
    return {
      kind: "regeneration_required",
      profile: profileValue,
      reason: "invalid_plan_json",
    };
  }
  if (!isWeeklyPlan(planValue)) {
    return {
      kind: "regeneration_required",
      profile: profileValue,
      reason: "invalid_plan_json",
    };
  }

  return {
    kind: "ready",
    saved: {
      profile: profileValue,
      plan: planValue,
      generatorVersion: PERSONALIZATION_GENERATOR_VERSION,
      generatedAt: row.generated_at,
      updatedAt: row.updated_at,
    },
  };
}

export async function savePersonalization(
  profile: PersonalizationProfile,
  plan: WeeklyPlan,
): Promise<SavedPersonalization> {
  if (plan.generatorVersion !== PERSONALIZATION_GENERATOR_VERSION) {
    throw new Error("Cannot save a plan from an unsupported generator version.");
  }
  const db = await getDb();
  const timestamp = new Date().toISOString();
  await db.execute(
    `INSERT INTO personalization (
      id, primary_goal, experience, days_per_week, session_minutes,
      has_dumbbells, low_impact_only, excluded_exercise_slugs,
      generator_version, plan_json, generated_at, updated_at
    ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT(id) DO UPDATE SET
      primary_goal = excluded.primary_goal,
      experience = excluded.experience,
      days_per_week = excluded.days_per_week,
      session_minutes = excluded.session_minutes,
      has_dumbbells = excluded.has_dumbbells,
      low_impact_only = excluded.low_impact_only,
      excluded_exercise_slugs = excluded.excluded_exercise_slugs,
      generator_version = excluded.generator_version,
      plan_json = excluded.plan_json,
      generated_at = excluded.generated_at,
      updated_at = excluded.updated_at`,
    [
      profile.primaryGoal,
      profile.experience,
      profile.daysPerWeek,
      profile.sessionMinutes,
      profile.hasDumbbells ? 1 : 0,
      profile.lowImpactOnly ? 1 : 0,
      JSON.stringify(profile.excludedExerciseSlugs),
      PERSONALIZATION_GENERATOR_VERSION,
      JSON.stringify(plan),
      timestamp,
      timestamp,
    ],
  );
  return {
    profile,
    plan,
    generatorVersion: PERSONALIZATION_GENERATOR_VERSION,
    generatedAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function clearPersonalization(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM personalization WHERE id = 1");
}
