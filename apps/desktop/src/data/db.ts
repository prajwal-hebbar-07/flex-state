import Database from "@tauri-apps/plugin-sql";
import {
  CATEGORIES,
  type Category,
  type EquipmentKind,
  EXERCISES,
  type Exercise,
} from "./exercises";
import { isLocation, LEGACY_LOCATION_NAME, type Location, normalizeLocationId } from "./locations";
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
  // `exercises` is derived data, re-seeded from exercises.ts on every launch.
  // When its shape changes, drop it rather than migrating rows: the old table
  // has `equipment TEXT NOT NULL`, which the new INSERT never supplies. Detect
  // the old shape by selecting a column only the old shape has.
  let legacyCatalog = true;
  try {
    await db.select("SELECT equipment FROM exercises LIMIT 1");
  } catch {
    legacyCatalog = false; // no such column, or no such table
  }
  if (legacyCatalog) await db.execute("DROP TABLE exercises");

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
        slug, name, category_slug, sub_category, requires,
        primary_muscles, secondary_muscles, difficulty,
        instructions, tips, source_refs, video, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        ex.slug,
        ex.name,
        ex.categorySlug,
        ex.subCategory ?? null,
        JSON.stringify(ex.requires),
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
  await migrateLegacyPersonalization();
}

interface DbExerciseRow {
  slug: string;
  name: string;
  category_slug: string;
  sub_category: string | null;
  requires: string;
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
  // Fall back to ["bodyweight"] rather than []: an unparseable row should stay
  // eligible somewhere rather than silently vanish from every location.
  let requires: EquipmentKind[] = ["bodyweight"];
  try {
    requires = JSON.parse(row.requires);
  } catch {
    requires = ["bodyweight"];
  }
  return {
    slug: row.slug,
    name: row.name,
    categorySlug: row.category_slug,
    subCategory: row.sub_category ?? undefined,
    requires,
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

// v1 installs have `has_dumbbells INTEGER NOT NULL` and
// `excluded_exercise_slugs TEXT NOT NULL` on `personalization`. SQLite cannot
// drop a NOT NULL constraint, so the v2 writer (which omits both columns) would
// fail with a constraint error forever. Rebuild the table once, moving the two
// values onto a location created here on the way out. The failing SELECT guards
// it: on a fresh install nothing runs and no location is created.
async function migrateLegacyPersonalization(): Promise<void> {
  const db = await getDb();
  const legacy = (await db
    .select<{ has_dumbbells: number; excluded_exercise_slugs: string }[]>(
      "SELECT has_dumbbells, excluded_exercise_slugs FROM personalization WHERE id = 1",
    )
    .catch(() => null)) as unknown as
    | { has_dumbbells: number; excluded_exercise_slugs: string }[]
    | null;
  if (legacy === null) return; // no such column => already v2

  const legacyId = normalizeLocationId(LEGACY_LOCATION_NAME);
  const row = legacy[0];
  if (row) {
    // The user has never named a place; this row is the only home for their old
    // equipment and exclusions. App routes them to LocationManager to rename it
    // before they can regenerate. The v1 boolean said nothing about furniture or
    // floor, so assume both - the permissive reading keeps every previously
    // eligible exercise eligible, and the user corrects it on that screen.
    const equipment: EquipmentKind[] =
      row.has_dumbbells === 1
        ? ["bodyweight", "furniture", "dumbbells", "floor"]
        : ["bodyweight", "furniture", "floor"];
    // OR IGNORE, not plain INSERT: if a location already normalizes to this id,
    // keep theirs. `location_id` below resolves either way.
    await db.execute(
      `INSERT OR IGNORE INTO locations
         (id, name, equipment, excluded_exercise_slugs, display_order)
       VALUES ($1, $2, $3, $4, 0)`,
      [legacyId, LEGACY_LOCATION_NAME, JSON.stringify(equipment), row.excluded_exercise_slugs],
    );
  }

  // CHECK clauses are deliberately omitted here; schema.sql re-establishes them
  // for fresh installs, and two copies of the same constraint text would drift.
  // `generator_version` is carried across unchanged so loadPersonalization
  // returns `regeneration_required` and the user confirms on the prefilled form.
  await db.execute(`
    CREATE TABLE personalization_v2 (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      primary_goal TEXT NOT NULL,
      experience TEXT NOT NULL,
      days_per_week INTEGER NOT NULL,
      session_minutes INTEGER NOT NULL,
      low_impact_only INTEGER NOT NULL,
      location_id TEXT NOT NULL,
      generator_version INTEGER NOT NULL,
      plan_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO personalization_v2
      SELECT id, primary_goal, experience, days_per_week, session_minutes,
             low_impact_only, '${legacyId}', generator_version,
             plan_json, generated_at, updated_at
      FROM personalization;
    DROP TABLE personalization;
    ALTER TABLE personalization_v2 RENAME TO personalization;
  `);
}

interface DbLocationRow {
  id: string;
  name: string;
  equipment: string;
  excluded_exercise_slugs: string;
  display_order: number;
}

// SQLite cannot CHECK-constrain the contents of a JSON array, so `isLocation`
// is the only defense. One corrupt row must not make the app unbootable.
export async function listLocations(): Promise<Location[]> {
  const db = await getDb();
  const rows = (await db.select<DbLocationRow[]>(
    `SELECT id, name, equipment, excluded_exercise_slugs, display_order
     FROM locations ORDER BY display_order ASC`,
  )) as unknown as DbLocationRow[];
  const locations: Location[] = [];
  for (const row of rows) {
    let value: unknown;
    try {
      value = {
        id: row.id,
        name: row.name,
        equipment: JSON.parse(row.equipment),
        excludedExerciseSlugs: JSON.parse(row.excluded_exercise_slugs),
        displayOrder: row.display_order,
      };
    } catch {
      value = null;
    }
    if (isLocation(value)) locations.push(value);
    else console.warn(`Skipping malformed location row "${row.id}".`);
  }
  return locations;
}

export async function upsertLocation(location: Location): Promise<void> {
  if (!isLocation(location)) throw new Error("Location contains invalid values.");
  const db = await getDb();
  await db.execute(
    `INSERT INTO locations (id, name, equipment, excluded_exercise_slugs, display_order)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       equipment = excluded.equipment,
       excluded_exercise_slugs = excluded.excluded_exercise_slugs,
       display_order = excluded.display_order`,
    [
      location.id,
      location.name,
      JSON.stringify(location.equipment),
      JSON.stringify(location.excludedExerciseSlugs),
      location.displayOrder,
    ],
  );
}

export async function deleteLocation(id: string): Promise<void> {
  const db = await getDb();
  const rows = (await db.select<{ location_id: string }[]>(
    "SELECT location_id FROM personalization WHERE id = 1",
  )) as unknown as { location_id: string }[];
  if (rows[0]?.location_id === id) {
    throw new Error("Cannot delete the location your saved plan uses.");
  }
  await db.execute("DELETE FROM locations WHERE id = $1", [id]);
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
      reason: "invalid_plan_json" | "unsupported_generator_version" | "location_missing";
    }
  | { kind: "invalid_profile"; message: string };

interface DbPersonalizationRow {
  primary_goal: unknown;
  experience: unknown;
  days_per_week: unknown;
  session_minutes: unknown;
  low_impact_only: unknown;
  location_id: unknown;
  generator_version: unknown;
  plan_json: unknown;
  generated_at: string;
  updated_at: string;
}

export async function loadPersonalization(): Promise<PersonalizationLoadResult> {
  const db = await getDb();
  const rows = (await db.select<DbPersonalizationRow[]>(
    `SELECT primary_goal, experience, days_per_week, session_minutes,
      low_impact_only, location_id,
      generator_version, plan_json, generated_at, updated_at
    FROM personalization WHERE id = 1`,
  )) as unknown as DbPersonalizationRow[];
  const row = rows[0];
  if (!row) return { kind: "none" };

  const profileValue = {
    primaryGoal: row.primary_goal,
    experience: row.experience,
    daysPerWeek: row.days_per_week,
    sessionMinutes: row.session_minutes,
    lowImpactOnly:
      row.low_impact_only === 0 ? false : row.low_impact_only === 1 ? true : row.low_impact_only,
    locationId: row.location_id,
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
      low_impact_only, location_id,
      generator_version, plan_json, generated_at, updated_at
    ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT(id) DO UPDATE SET
      primary_goal = excluded.primary_goal,
      experience = excluded.experience,
      days_per_week = excluded.days_per_week,
      session_minutes = excluded.session_minutes,
      low_impact_only = excluded.low_impact_only,
      location_id = excluded.location_id,
      generator_version = excluded.generator_version,
      plan_json = excluded.plan_json,
      generated_at = excluded.generated_at,
      updated_at = excluded.updated_at`,
    [
      profile.primaryGoal,
      profile.experience,
      profile.daysPerWeek,
      profile.sessionMinutes,
      profile.lowImpactOnly ? 1 : 0,
      profile.locationId,
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
