import { Button } from "@flex-state/ui";
import type { FormEvent } from "react";
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
    <section className="screen-section content-narrow">
      <header className="section-heading">
        <p className="system-label">{firstRun ? "AWAKENING 01 / 02" : "LOADOUTS"}</p>
        <h2>{firstRun ? "Register your training grounds" : "Loadouts"}</h2>
        <p>
          {firstRun
            ? "Name each training ground and select the equipment available there. You can add more later."
            : "Each training ground has its own equipment and exercise restrictions."}
        </p>
      </header>

      {error ? (
        <div role="alert" className="system-alert system-fault">
          {error}
        </div>
      ) : null}

      <form className="system-panel form-stack" onSubmit={create}>
        <label className="form-field">
          <span>Add a training ground</span>
          <input
            type="text"
            required
            value={name}
            placeholder="Garage, the park, Nani's house..."
            // biome-ignore lint/a11y/noAutofocus: first-run screen, the only field.
            autoFocus={firstRun}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {createError ? (
          <div role="alert" className="system-alert system-fault">
            {createError}
          </div>
        ) : null}
        <div className="button-row">
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

      <div className="button-row">
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
    <article className={`system-panel loadout-card${isActive ? " active-loadout" : ""}`}>
      <p className="system-label">{isActive ? "ACTIVE LOADOUT" : "LOADOUT"}</p>
      <label className="form-field">
        <span>Name</span>
        <input
          type="text"
          required
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>

      <fieldset>
        <legend>Available equipment</legend>
        <div className="checkbox-grid">
          {EQUIPMENT_KINDS.map((kind) => (
            <label key={kind} className="checkbox-row">
              <input
                type="checkbox"
                checked={draft.equipment.includes(kind)}
                onChange={(event) => toggleEquipment(kind, event.target.checked)}
              />
              {EQUIPMENT_LABELS[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="readiness-panel" aria-label="Quest availability">
        <h3>Quest availability</h3>
        {readiness.map((focus) => (
          <div key={focus.focus} className={focus.eligible < 2 ? "readiness-warning" : "meta-text"}>
            {focus.label}: {focus.eligible} exercises
            {focus.eligible < 2 && focus.missing.length > 0
              ? ` - add ${focus.missing.map((kind) => EQUIPMENT_LABELS[kind]).join(" or ")}`
              : ""}
          </div>
        ))}
      </section>

      <details className="restriction-panel">
        <summary>Restricted exercises (optional)</summary>
        <label className="form-field restriction-search">
          <span>Search exercises</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {categories.map((category) => {
          const exercises = visibleCatalog.filter(
            (exercise) => exercise.categorySlug === category.slug,
          );
          return exercises.length > 0 ? (
            <section key={category.slug}>
              <h3>{category.name}</h3>
              <div className="checkbox-grid">
                {exercises.map((exercise) => (
                  <label key={exercise.slug} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={draft.excludedExerciseSlugs.includes(exercise.slug)}
                      onChange={(event) => toggleExclusion(exercise.slug, event.target.checked)}
                    />
                    {exercise.name}
                  </label>
                ))}
              </div>
            </section>
          ) : null;
        })}
        {visibleCatalog.length === 0 ? (
          <p className="meta-text">No exercises match that search.</p>
        ) : null}
        {unknownExclusions.length > 0 ? (
          <section>
            <h3>No longer in catalog</h3>
            {unknownExclusions.map((slug) => (
              <label key={slug} className="checkbox-row">
                <input type="checkbox" checked onChange={() => toggleExclusion(slug, false)} />
                {slug}
              </label>
            ))}
          </section>
        ) : null}
      </details>

      {isLocation(draft) ? null : (
        <div role="alert" className="system-alert system-fault">
          Give this place a name and tick at least one thing you have here.
        </div>
      )}

      <div className="button-row">
        <Button onClick={() => onUpsert(draft)} disabled={saving || !isLocation(draft)}>
          Save location
        </Button>
        <Button
          className="danger-button"
          onClick={() => {
            if (window.confirm("Delete this location?")) void onDelete(location.id);
          }}
          disabled={saving || isActive}
        >
          Delete
        </Button>
        {isActive ? (
          <>
            <span className="meta-text">
              Your saved plan uses this place, so it cannot be deleted.
            </span>
            <Button className="secondary-button" onClick={onRegenerate} disabled={saving}>
              Regenerate plan
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
