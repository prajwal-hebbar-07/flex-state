import Database from "@tauri-apps/plugin-sql";
import { CATEGORIES, type Category, EXERCISES, type Exercise } from "./exercises";
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
        instructions, tips, source_refs, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
