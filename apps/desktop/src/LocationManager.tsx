import { Button } from "@flex-state/ui";
import type { CSSProperties, FormEvent } from "react";
import * as React from "react";
import {
  type Category,
  EQUIPMENT_KINDS,
  EQUIPMENT_LABELS,
  type EquipmentKind,
  type Exercise,
} from "./data/exercises";
import { isLocation, type Location, normalizeLocationId } from "./data/locations";
import { locationReadiness } from "./data/schedule";

export interface LocationManagerProps {
  locations: Location[];
  categories: Category[];
  catalog: Exercise[];
  /** The location the saved plan is bound to, or "" when nothing is saved. */
  activeLocationId: string;
  onUpsert: (location: Location) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRegenerate: () => void;
  onClose: () => void;
  /** Onboarding wording and autofocus: true until a plan has been saved. */
  firstRun: boolean;
  error: string | null;
  saving: boolean;
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: 960,
    margin: "0 auto",
    padding: "1rem",
  },
  card: {
    border: "1px solid #262626",
    borderRadius: 10,
    padding: "0.85rem",
    background: "#141414",
    display: "flex",
    flexDirection: "column",
    gap: "0.65rem",
  },
  field: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  input: {
    padding: "0.5rem 0.65rem",
    borderRadius: 6,
    border: "1px solid #2a2a2a",
    background: "#161616",
    color: "#eee",
  },
  checkbox: { display: "flex", gap: "0.5rem", alignItems: "center" },
  checklist: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.4rem 1rem",
    marginTop: "0.75rem",
  },
  fieldset: { border: "1px solid #262626", borderRadius: 10, padding: "0.85rem" },
  actions: { display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" },
  meta: { color: "#9aa0a6", fontSize: "0.82rem" },
  warn: { color: "#fde68a", fontSize: "0.82rem" },
  error: {
    color: "#fecaca",
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "0.75rem",
  },
};

export function LocationManager({
  locations,
  categories,
  catalog,
  activeLocationId,
  onUpsert,
  onDelete,
  onRegenerate,
  onClose,
  firstRun,
  error,
  saving,
}: LocationManagerProps): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError("Type a name for this place.");
      return;
    }
    // The id is computed once, here. A later rename keeps it: the saved profile
    // references the id, and recomputing it would orphan the plan.
    // normalizeLocationId returns "" for any name without ASCII alphanumerics
    // (any non-Latin script), which is a good name and a useless id.
    const id = normalizeLocationId(trimmed) || `location-${crypto.randomUUID().slice(0, 8)}`;
    const clash = locations.find((location) => location.id === id);
    if (clash) {
      setCreateError(`You already have a place called ${clash.name}.`);
      return;
    }
    setCreateError(null);
    await onUpsert({
      id,
      name: trimmed,
      equipment: ["bodyweight"],
      excludedExerciseSlugs: [],
      displayOrder:
        locations.reduce((max, location) => Math.max(max, location.displayOrder), -1) + 1,
    });
    setName("");
  }

  return (
    <section style={styles.wrap}>
      <div>
        <h2 style={{ marginBottom: "0.35rem" }}>
          {firstRun ? "Where do you work out?" : "Your locations"}
        </h2>
        <p style={styles.meta}>
          {firstRun
            ? "Name each place and tick what you have there. You can add more later."
            : "Each place has its own equipment and its own excluded exercises."}
        </p>
      </div>

      {error ? (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      ) : null}

      <form style={styles.card} onSubmit={create}>
        <label style={styles.field}>
          Add a place
          <input
            type="text"
            required
            style={styles.input}
            value={name}
            placeholder="Garage, the park, Nani's house..."
            // biome-ignore lint/a11y/noAutofocus: first-run screen, the only field.
            autoFocus={firstRun}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {createError ? (
          <div role="alert" style={styles.error}>
            {createError}
          </div>
        ) : null}
        <div style={styles.actions}>
          <Button type="submit" disabled={saving}>
            Add location
          </Button>
        </div>
      </form>

      {locations.map((location) => (
        <LocationCard
          key={location.id}
          location={location}
          categories={categories}
          catalog={catalog}
          isActive={location.id === activeLocationId}
          onUpsert={onUpsert}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          saving={saving}
        />
      ))}

      <div style={styles.actions}>
        <Button onClick={onClose} disabled={saving || locations.length === 0}>
          {firstRun ? "Continue" : "Done"}
        </Button>
      </div>
    </section>
  );
}

interface LocationCardProps {
  location: Location;
  categories: Category[];
  catalog: Exercise[];
  isActive: boolean;
  onUpsert: (location: Location) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRegenerate: () => void;
  saving: boolean;
}

function LocationCard({
  location,
  categories,
  catalog,
  isActive,
  onUpsert,
  onDelete,
  onRegenerate,
  saving,
}: LocationCardProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<Location>(location);
  const [search, setSearch] = React.useState("");
  const query = search.trim().toLocaleLowerCase();
  const visibleCatalog = query
    ? catalog.filter(
        (exercise) =>
          exercise.name.toLocaleLowerCase().includes(query) ||
          exercise.slug.toLocaleLowerCase().includes(query),
      )
    : catalog;
  const catalogSlugs = new Set(catalog.map((exercise) => exercise.slug));
  const unknownExclusions = draft.excludedExerciseSlugs.filter((slug) => !catalogSlugs.has(slug));
  // Readiness follows the draft, so ticking a kind updates the counts before saving.
  const readiness = locationReadiness(draft, catalog);

  function toggleEquipment(kind: EquipmentKind, checked: boolean): void {
    setDraft({
      ...draft,
      equipment: checked
        ? EQUIPMENT_KINDS.filter((k) => k === kind || draft.equipment.includes(k))
        : draft.equipment.filter((k) => k !== kind),
    });
  }

  function toggleExclusion(slug: string, checked: boolean): void {
    setDraft({
      ...draft,
      excludedExerciseSlugs: checked
        ? [...draft.excludedExerciseSlugs, slug]
        : draft.excludedExerciseSlugs.filter((excluded) => excluded !== slug),
    });
  }

  return (
    <div style={styles.card}>
      <label style={styles.field}>
        Name
        <input
          type="text"
          required
          style={styles.input}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>

      <div>
        <strong>What is here</strong>
        <div style={styles.checklist}>
          {EQUIPMENT_KINDS.map((kind) => (
            <label key={kind} style={styles.checkbox}>
              <input
                type="checkbox"
                checked={draft.equipment.includes(kind)}
                onChange={(event) => toggleEquipment(kind, event.target.checked)}
              />
              {EQUIPMENT_LABELS[kind]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <strong>What you can train here</strong>
        {readiness.map((focus) => (
          <div key={focus.focus} style={focus.eligible < 2 ? styles.warn : styles.meta}>
            {focus.label}: {focus.eligible} exercises
            {focus.eligible < 2 && focus.missing.length > 0
              ? ` - add ${focus.missing.map((kind) => EQUIPMENT_LABELS[kind]).join(" or ")}`
              : ""}
          </div>
        ))}
      </div>

      <details style={styles.fieldset}>
        <summary>Exclude exercises here (optional)</summary>
        <label style={{ ...styles.field, marginTop: "0.75rem" }}>
          Search exercises
          <input
            type="search"
            style={styles.input}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {categories.map((category) => {
          const exercises = visibleCatalog.filter(
            (exercise) => exercise.categorySlug === category.slug,
          );
          return exercises.length > 0 ? (
            <div key={category.slug}>
              <h3 style={{ marginBottom: "0.35rem", fontSize: "1rem" }}>{category.name}</h3>
              <div style={styles.checklist}>
                {exercises.map((exercise) => (
                  <label key={exercise.slug} style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={draft.excludedExerciseSlugs.includes(exercise.slug)}
                      onChange={(event) => toggleExclusion(exercise.slug, event.target.checked)}
                    />
                    {exercise.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null;
        })}
        {visibleCatalog.length === 0 ? (
          <p style={styles.meta}>No exercises match that search.</p>
        ) : null}
        {unknownExclusions.length > 0 ? (
          <div>
            <h3 style={{ marginBottom: "0.35rem", fontSize: "1rem" }}>No longer in catalog</h3>
            {unknownExclusions.map((slug) => (
              <label key={slug} style={styles.checkbox}>
                <input type="checkbox" checked onChange={() => toggleExclusion(slug, false)} />
                {slug}
              </label>
            ))}
          </div>
        ) : null}
      </details>

      {isLocation(draft) ? null : (
        <div role="alert" style={styles.error}>
          Give this place a name and tick at least one thing you have here.
        </div>
      )}

      <div style={styles.actions}>
        <Button onClick={() => onUpsert(draft)} disabled={saving || !isLocation(draft)}>
          Save location
        </Button>
        <Button
          onClick={() => {
            if (window.confirm("Delete this location?")) void onDelete(location.id);
          }}
          disabled={saving || isActive}
        >
          Delete
        </Button>
        {isActive ? (
          <>
            <span style={styles.meta}>
              Your saved plan uses this place, so it cannot be deleted.
            </span>
            <Button onClick={onRegenerate} disabled={saving}>
              Regenerate plan
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
