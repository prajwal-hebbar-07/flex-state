import * as React from "react";
import {
  type Category,
  EQUIPMENT_KINDS,
  EQUIPMENT_LABELS,
  type EquipmentKind,
  type Exercise,
  type SourceRef,
} from "./data/exercises";

type EquipmentFilter = EquipmentKind | "all";
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
    if (equipment !== "all" && !e.requires.includes(equipment)) return false;
    if (difficulty !== "all" && e.difficulty !== difficulty) return false;
    return true;
  });

  const counts: Record<string, number> = {};
  for (const e of exercises) counts[e.categorySlug] = (counts[e.categorySlug] ?? 0) + 1;

  return (
    <section className="screen-section">
      <header className="archive-header">
        <div>
          <p className="system-label">SKILL ARCHIVE</p>
          <h2>Skill Archive</h2>
          <p>Review movement technique before accepting a quest.</p>
        </div>
        <span className="result-count">
          {filtered.length} of {exercises.length} exercises
        </span>
      </header>

      <fieldset className="filter-group">
        <legend className="filter-label">Category</legend>
        <button
          type="button"
          className="system-tab"
          aria-pressed={categorySlug === null}
          onClick={() => setCategorySlug(null)}
        >
          All ({exercises.length})
        </button>
        {categories.map((category) => (
          <button
            type="button"
            className="system-tab"
            aria-pressed={categorySlug === category.slug}
            key={category.slug}
            onClick={() => setCategorySlug(category.slug)}
          >
            {category.name} ({counts[category.slug] ?? 0})
          </button>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend className="visually-hidden">Equipment and difficulty filters</legend>
        <span className="filter-label">Equipment</span>
        {(["all", ...EQUIPMENT_KINDS] as EquipmentFilter[]).map((kind) => (
          <button
            type="button"
            className="filter-chip"
            aria-pressed={equipment === kind}
            key={kind}
            onClick={() => setEquipment(kind)}
          >
            {kind === "all" ? "Any" : EQUIPMENT_LABELS[kind]}
          </button>
        ))}
        <span className="filter-label filter-label-spaced">Difficulty</span>
        {(["all", "beginner", "intermediate", "advanced"] as const).map((value) => (
          <button
            type="button"
            className="filter-chip"
            aria-pressed={difficulty === value}
            key={value}
            onClick={() => setDifficulty(value)}
          >
            {value === "all" ? "Any" : value}
          </button>
        ))}
      </fieldset>

      {filtered.length === 0 ? (
        <div className="system-panel empty-state">
          <p className="system-label">NO SKILL RECORDS FOUND</p>
          <p>No exercises match those filters.</p>
        </div>
      ) : (
        <div className="card-grid skill-grid">
          {filtered.map((exercise) => (
            <ExerciseCard
              key={exercise.slug}
              exercise={exercise}
              isOpen={openSlug === exercise.slug}
              onToggle={() =>
                setOpenSlug((previous) => (previous === exercise.slug ? null : exercise.slug))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface CardProps {
  exercise: Exercise;
  isOpen: boolean;
  onToggle: () => void;
}

function ExerciseCard({ exercise, isOpen, onToggle }: CardProps): React.JSX.Element {
  return (
    <article className="system-panel skill-record">
      <p className="system-label">SKILL RECORD</p>
      <h3>{exercise.name}</h3>
      <p className="meta-text">
        {exercise.subCategory ? `${exercise.subCategory} · ` : ""}
        Primary: {exercise.primaryMuscles.join(", ")}
      </p>
      <div className="badge-row">
        <span className="text-badge equipment-badge">
          {exercise.requires.map((kind) => EQUIPMENT_LABELS[kind]).join(" · ")}
        </span>
        <span className={`text-badge difficulty-${exercise.difficulty}`}>
          {exercise.difficulty}
        </span>
      </div>
      <button type="button" className="detail-toggle" onClick={onToggle}>
        {isOpen ? "Hide details" : "Show details"}
      </button>
      {isOpen ? <Detail exercise={exercise} /> : null}
    </article>
  );
}

// Catalog stores shareable watch URLs; only the embed form loads in an iframe.
// Every entry is currently a YouTube link, so nothing else is rendered.
const YOUTUBE_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;

function Detail({ exercise }: { exercise: Exercise }): React.JSX.Element {
  const videoId = exercise.video ? YOUTUBE_ID.exec(exercise.video)?.[1] : undefined;
  return (
    <div className="skill-detail">
      {videoId ? (
        <iframe
          className="exercise-video"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={`${exercise.name} demo`}
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <span className="meta-text video-missing">No video yet.</span>
      )}
      <p>
        <strong>How:</strong> {exercise.instructions}
      </p>
      <p>
        <strong>Tips:</strong> {exercise.tips}
      </p>
      <p className="meta-text">
        <strong>Also works:</strong> {exercise.secondaryMuscles.join(", ")}
      </p>
      {exercise.sourceRefs.length > 0 ? (
        <p className="source-list">
          Sources:{" "}
          {exercise.sourceRefs.map((source: SourceRef, index: number) => (
            <span key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
              {index < exercise.sourceRefs.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
