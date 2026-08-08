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
  equipment TEXT NOT NULL CHECK (equipment IN ('bodyweight', 'dumbbells', 'both')),
  primary_muscles TEXT NOT NULL,    -- comma-separated
  secondary_muscles TEXT NOT NULL,  -- comma-separated
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  instructions TEXT NOT NULL,
  tips TEXT NOT NULL,
  source_refs TEXT NOT NULL,        -- JSON array of {label, url}
  display_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_slug);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
