import type { CSSProperties } from "react";
import * as React from "react";
import type { Category, Equipment, Exercise, SourceRef } from "./data/exercises";

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: 960,
    margin: "0 auto",
    padding: "1rem",
  },
  headerRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  filterRow: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  select: {
    padding: "0.4rem 0.6rem",
    borderRadius: 6,
    border: "1px solid #2a2a2a",
    background: "#161616",
    color: "#eee",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "0.75rem",
  },
  card: {
    border: "1px solid #262626",
    borderRadius: 10,
    padding: "0.85rem",
    background: "#141414",
  },
  cardTitle: { margin: "0 0 0.25rem 0", fontSize: "1rem" },
  meta: { color: "#9aa0a6", fontSize: "0.8rem", marginBottom: "0.5rem" },
  detail: { marginTop: "0.5rem", fontSize: "0.85rem", color: "#cfcfcf" },
  empty: { color: "#9aa0a6", textAlign: "center", padding: "2rem" },
};

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: "0.35rem 0.75rem",
    borderRadius: 999,
    border: "1px solid #333",
    background: active ? "#2563eb" : "#1a1a1a",
    color: active ? "#fff" : "#ddd",
    cursor: "pointer",
    fontSize: "0.85rem",
  };
}

function badgeStyle(color: string): CSSProperties {
  return {
    display: "inline-block",
    padding: "0.1rem 0.5rem",
    borderRadius: 6,
    background: color,
    color: "#0b0b0b",
    fontSize: "0.72rem",
    fontWeight: 600,
    marginRight: "0.4rem",
  };
}

const DIFFICULTY_COLOR: Record<Exercise["difficulty"], string> = {
  beginner: "#34d399",
  intermediate: "#fbbf24",
  advanced: "#f87171",
};

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: "Bodyweight",
  dumbbells: "5 kg DBs",
  both: "Bodyweight + DBs",
};

const EQUIPMENT_COLOR: Record<Equipment, string> = {
  bodyweight: "#93c5fd",
  dumbbells: "#fdba74",
  both: "#c4b5fd",
};

type EquipmentFilter = Equipment | "all";
type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";

interface Props {
  categories: Category[];
  exercises: Exercise[];
}

export function ExerciseBrowser({ categories, exercises }: Props): React.JSX.Element {
  const [categorySlug, setCategorySlug] = React.useState<string | null>(null);
  const [equipment, setEquipment] = React.useState<EquipmentFilter>("all");
  const [difficulty, setDifficulty] = React.useState<DifficultyFilter>("all");
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);

  const filtered = exercises.filter((e) => {
    if (categorySlug && e.categorySlug !== categorySlug) return false;
    if (equipment !== "all") {
      const ok = e.equipment === equipment || e.equipment === "both";
      if (!ok) return false;
    }
    if (difficulty !== "all" && e.difficulty !== difficulty) return false;
    return true;
  });

  const counts: Record<string, number> = {};
  for (const e of exercises) counts[e.categorySlug] = (counts[e.categorySlug] ?? 0) + 1;

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Home Workout Library</h2>
        <span style={styles.meta}>
          {filtered.length} of {exercises.length} exercises
        </span>
      </div>

      <div style={styles.filterRow}>
        <span style={styles.meta}>Category:</span>
        <button
          type="button"
          style={pillStyle(categorySlug === null)}
          onClick={() => setCategorySlug(null)}
        >
          All ({exercises.length})
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.slug}
            style={pillStyle(categorySlug === c.slug)}
            onClick={() => setCategorySlug(c.slug)}
          >
            {c.name} ({counts[c.slug] ?? 0})
          </button>
        ))}
      </div>

      <div style={styles.filterRow}>
        <span style={styles.meta}>Equipment:</span>
        {(["all", "bodyweight", "dumbbells", "both"] as const).map((e) => (
          <button
            type="button"
            key={e}
            style={pillStyle(equipment === e)}
            onClick={() => setEquipment(e)}
          >
            {e === "all" ? "Any" : EQUIPMENT_LABEL[e]}
          </button>
        ))}
        <span style={{ ...styles.meta, marginLeft: "0.5rem" }}>Difficulty:</span>
        {(["all", "beginner", "intermediate", "advanced"] as const).map((d) => (
          <button
            type="button"
            key={d}
            style={pillStyle(difficulty === d)}
            onClick={() => setDifficulty(d)}
          >
            {d === "all" ? "Any" : d}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>No exercises match those filters.</div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.slug}
              exercise={ex}
              isOpen={openSlug === ex.slug}
              onToggle={() => setOpenSlug((prev) => (prev === ex.slug ? null : ex.slug))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  exercise: Exercise;
  isOpen: boolean;
  onToggle: () => void;
}

function ExerciseCard({ exercise, isOpen, onToggle }: CardProps): React.JSX.Element {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{exercise.name}</h3>
      <div style={styles.meta}>
        {exercise.subCategory ? `${exercise.subCategory} · ` : ""}
        Primary: {exercise.primaryMuscles.join(", ")}
      </div>
      <div>
        <span style={badgeStyle(EQUIPMENT_COLOR[exercise.equipment])}>
          {EQUIPMENT_LABEL[exercise.equipment]}
        </span>
        <span style={badgeStyle(DIFFICULTY_COLOR[exercise.difficulty])}>{exercise.difficulty}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          marginTop: "0.5rem",
          background: "transparent",
          color: "#60a5fa",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontSize: "0.85rem",
        }}
      >
        {isOpen ? "Hide details" : "Show details"}
      </button>
      {isOpen ? <Detail exercise={exercise} /> : null}
    </div>
  );
}

// Catalog stores shareable watch URLs; only the embed form loads in an iframe.
// Every entry is currently a YouTube link, so nothing else is rendered.
const YOUTUBE_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;

function Detail({ exercise }: { exercise: Exercise }): React.JSX.Element {
  const videoId = exercise.video ? YOUTUBE_ID.exec(exercise.video)?.[1] : undefined;
  return (
    <div style={styles.detail}>
      {videoId ? (
        <iframe
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: 8 }}
          src={`https://www.youtube.com/embed/${videoId}`}
          title={`${exercise.name} demo`}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <span style={{ ...styles.meta, display: "block" }}>No video yet.</span>
      )}
      <p style={{ margin: "0.4rem 0" }}>
        <strong>How:</strong> {exercise.instructions}
      </p>
      <p style={{ margin: "0.4rem 0" }}>
        <strong>Tips:</strong> {exercise.tips}
      </p>
      <p style={{ margin: "0.4rem 0", color: "#9aa0a6" }}>
        <strong>Also works:</strong> {exercise.secondaryMuscles.join(", ")}
      </p>
      {exercise.sourceRefs.length > 0 ? (
        <p style={{ margin: "0.4rem 0", fontSize: "0.75rem", color: "#777" }}>
          Sources:{" "}
          {exercise.sourceRefs.map((s: SourceRef, i: number) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
              {i < exercise.sourceRefs.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
