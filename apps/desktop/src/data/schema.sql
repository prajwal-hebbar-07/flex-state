-- Schema for the flex-state home workout catalog.
-- Run idempotently on every app start before any seed/select.

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  sub_category TEXT,
  requires TEXT NOT NULL,           -- JSON array of EquipmentKind
  primary_muscles TEXT NOT NULL,    -- comma-separated
  secondary_muscles TEXT NOT NULL,  -- comma-separated
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  instructions TEXT NOT NULL,
  tips TEXT NOT NULL,
  source_refs TEXT NOT NULL,        -- JSON array of {label, url}
  video TEXT,                       -- demo video URL, NULL when none
  display_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_slug);


CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  equipment TEXT NOT NULL,                  -- JSON array of EquipmentKind
  excluded_exercise_slugs TEXT NOT NULL,    -- JSON array of slugs
  display_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_display_order ON locations(display_order);


CREATE TABLE IF NOT EXISTS personalization (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  primary_goal TEXT NOT NULL
    CHECK (primary_goal IN ('general_fitness', 'strength', 'conditioning', 'mobility_balance')),
  experience TEXT NOT NULL
    CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 7),
  session_minutes INTEGER NOT NULL CHECK (session_minutes IN (15, 30, 45)),
  low_impact_only INTEGER NOT NULL CHECK (low_impact_only IN (0, 1)),
  location_id TEXT NOT NULL,
  generator_version INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);