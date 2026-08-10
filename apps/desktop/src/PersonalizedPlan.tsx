import { Button } from "@flex-state/ui";
import type { CSSProperties, FormEvent } from "react";
import * as React from "react";
import type { SavedPersonalization } from "./data/db";
import type { Category, Exercise } from "./data/exercises";
import {
  type DaysPerWeek,
  formatPrescription,
  isPersonalizationProfile,
  type PersonalizationProfile,
  type PrescribedExercise,
  resolvePlan,
  type SessionMinutes,
  type TrainingGoal,
} from "./data/schedule";

export interface ProfileFormProps {
  categories: Category[];
  catalog: Exercise[];
  initialProfile?: PersonalizationProfile;
  submitLabel: "Save plan" | "Regenerate plan";
  saving: boolean;
  error: string | null;
  onSubmit: (profile: PersonalizationProfile) => Promise<void>;
  onCancel?: () => void;
}

export interface PlanViewProps {
  saved: SavedPersonalization;
  catalog: Exercise[];
  onEdit: () => void;
  onRegenerate: () => void;
}

const DEFAULT_PROFILE: PersonalizationProfile = {
  primaryGoal: "general_fitness",
  experience: "beginner",
  daysPerWeek: 3,
  sessionMinutes: 15,
  hasDumbbells: false,
  lowImpactOnly: false,
  excludedExerciseSlugs: [],
};

const GOAL_LABELS: Record<TrainingGoal, string> = {
  general_fitness: "General fitness",
  strength: "Strength",
  conditioning: "Conditioning",
  mobility_balance: "Mobility & balance",
};

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: 960,
    margin: "0 auto",
    padding: "1rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: 720,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "0.85rem",
  },
  field: { display: "flex", flexDirection: "column", gap: "0.35rem" },
  select: {
    padding: "0.5rem 0.65rem",
    borderRadius: 6,
    border: "1px solid #2a2a2a",
    background: "#161616",
    color: "#eee",
  },
  input: {
    padding: "0.5rem 0.65rem",
    borderRadius: 6,
    border: "1px solid #2a2a2a",
    background: "#161616",
    color: "#eee",
  },
  checkbox: { display: "flex", gap: "0.5rem", alignItems: "center" },
  fieldset: {
    border: "1px solid #262626",
    borderRadius: 10,
    padding: "0.85rem",
  },
  checklist: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.4rem 1rem",
    marginTop: "0.75rem",
  },
  actions: { display: "flex", gap: "0.65rem", flexWrap: "wrap" },
  error: {
    color: "#fecaca",
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: "0.75rem",
  },
  warning: {
    color: "#fde68a",
    background: "#422006",
    border: "1px solid #854d0e",
    borderRadius: 8,
    padding: "0.75rem",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "0.75rem",
  },
  summaryItem: {
    border: "1px solid #262626",
    borderRadius: 8,
    padding: "0.65rem",
    background: "#141414",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "0.75rem",
  },
  card: {
    border: "1px solid #262626",
    borderRadius: 10,
    padding: "0.85rem",
    background: "#141414",
  },
  meta: { color: "#9aa0a6", fontSize: "0.82rem" },
  exercise: {
    borderTop: "1px solid #262626",
    padding: "0.55rem 0",
  },
};

export function ProfileForm({
  categories,
  catalog,
  initialProfile,
  submitLabel,
  saving,
  error,
  onSubmit,
  onCancel,
}: ProfileFormProps): React.JSX.Element {
  const [profile, setProfile] = React.useState<PersonalizationProfile>(() => {
    const source = initialProfile ?? DEFAULT_PROFILE;
    return { ...source, excludedExerciseSlugs: [...source.excludedExerciseSlugs] };
  });
  const [search, setSearch] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const query = search.trim().toLocaleLowerCase();
  const visibleCatalog = query
    ? catalog.filter(
        (exercise) =>
          exercise.name.toLocaleLowerCase().includes(query) ||
          exercise.slug.toLocaleLowerCase().includes(query),
      )
    : catalog;
  const catalogSlugs = new Set(catalog.map((exercise) => exercise.slug));
  const unknownExclusions = profile.excludedExerciseSlugs.filter((slug) => !catalogSlugs.has(slug));

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setValidationError(null);
    if (!isPersonalizationProfile(profile)) {
      setValidationError("Profile contains invalid personalization values.");
      return;
    }
    await onSubmit(profile);
  }

  return (
    <section style={styles.wrap}>
      <div>
        <h2 style={{ marginBottom: "0.35rem" }}>Personalize your plan</h2>
        <p style={styles.meta}>
          Choose your goal and constraints. Your plan is generated offline and saved on this
          installation.
        </p>
      </div>
      <form style={styles.form} onSubmit={submit}>
        <div style={styles.formGrid}>
          <label style={styles.field}>
            Primary goal
            <select
              style={styles.select}
              value={profile.primaryGoal}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  primaryGoal: event.target.value as TrainingGoal,
                })
              }
            >
              {Object.entries(GOAL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            Experience
            <select
              style={styles.select}
              value={profile.experience}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  experience: event.target.value as PersonalizationProfile["experience"],
                })
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label style={styles.field}>
            Days/week
            <select
              style={styles.select}
              value={profile.daysPerWeek}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  daysPerWeek: Number(event.target.value) as DaysPerWeek,
                })
              }
            >
              {[2, 3, 4, 5, 6, 7].map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.field}>
            Session length
            <select
              style={styles.select}
              value={profile.sessionMinutes}
              onChange={(event) =>
                setProfile({
                  ...profile,
                  sessionMinutes: Number(event.target.value) as SessionMinutes,
                })
              }
            >
              {[15, 30, 45].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={profile.hasDumbbells}
            onChange={(event) => setProfile({ ...profile, hasDumbbells: event.target.checked })}
          />
          I have 5 kg dumbbells
        </label>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={profile.lowImpactOnly}
            onChange={(event) => setProfile({ ...profile, lowImpactOnly: event.target.checked })}
          />
          Low impact only
        </label>

        <details style={styles.fieldset}>
          <summary>Exclude exercises (optional)</summary>
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
                        checked={profile.excludedExerciseSlugs.includes(exercise.slug)}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            excludedExerciseSlugs: event.target.checked
                              ? [...profile.excludedExerciseSlugs, exercise.slug]
                              : profile.excludedExerciseSlugs.filter(
                                  (slug) => slug !== exercise.slug,
                                ),
                          })
                        }
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
                  <input
                    type="checkbox"
                    checked
                    onChange={() =>
                      setProfile({
                        ...profile,
                        excludedExerciseSlugs: profile.excludedExerciseSlugs.filter(
                          (excluded) => excluded !== slug,
                        ),
                      })
                    }
                  />
                  {slug}
                </label>
              ))}
            </div>
          ) : null}
        </details>

        {validationError || error ? (
          <div role="alert" style={styles.error}>
            {validationError ?? error}
          </div>
        ) : null}
        <div style={styles.actions}>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function PlanExercise({
  item,
  exercise,
}: {
  item: PrescribedExercise;
  exercise: Exercise;
}): React.JSX.Element {
  return (
    <div style={styles.exercise}>
      <strong>{exercise.name}</strong>
      <div>{formatPrescription(item.prescription)}</div>
      <div style={styles.meta}>
        {exercise.equipment} · {exercise.difficulty} · {exercise.primaryMuscles.join(", ")}
      </div>
      {item.notes ? <div style={{ marginTop: "0.25rem" }}>{item.notes}</div> : null}
    </div>
  );
}

export function PlanView({
  saved,
  catalog,
  onEdit,
  onRegenerate,
}: PlanViewProps): React.JSX.Element {
  const resolved = resolvePlan(saved.plan, catalog);
  const profile = saved.profile;

  return (
    <section style={styles.wrap}>
      <div style={styles.actions}>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: "0.25rem" }}>{saved.plan.name}</h2>
          <div style={styles.meta}>Generated {new Date(saved.generatedAt).toLocaleString()}</div>
        </div>
        <Button onClick={onEdit}>Edit profile</Button>
      </div>

      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <strong>Goal</strong>
          <div>{GOAL_LABELS[profile.primaryGoal]}</div>
        </div>
        <div style={styles.summaryItem}>
          <strong>Experience</strong>
          <div style={{ textTransform: "capitalize" }}>{profile.experience}</div>
        </div>
        <div style={styles.summaryItem}>
          <strong>Schedule</strong>
          <div>
            {profile.daysPerWeek} days · {profile.sessionMinutes} min
          </div>
        </div>
        <div style={styles.summaryItem}>
          <strong>Constraints</strong>
          <div>
            {profile.hasDumbbells ? "Dumbbells available" : "Bodyweight only"}
            {profile.lowImpactOnly ? " · Low impact" : ""}
          </div>
        </div>
      </div>

      {saved.plan.warnings.map((warning) => (
        <div
          key={
            warning.code === "unknown_exclusion" ? warning.slug : `${warning.code}-${warning.day}`
          }
          style={styles.warning}
        >
          {warning.code === "unknown_exclusion"
            ? `Excluded exercise "${warning.slug}" is no longer in the catalog.`
            : warning.code === "duration_target_unmet"
              ? `Day ${warning.day} is shorter than the requested duration because no additional eligible exercises fit.`
              : `Day ${warning.day} exceeds the requested duration because every session requires at least two exercises.`}
        </div>
      ))}

      {resolved.missing.length > 0 ? (
        <div role="alert" style={styles.error}>
          <strong>Saved plan references missing exercises</strong>
          <div style={{ marginTop: "0.65rem" }}>
            <Button onClick={onRegenerate}>Regenerate plan</Button>
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {saved.plan.days.map(({ day, session }) => (
            <article key={day} style={styles.card}>
              <h3 style={{ marginTop: 0 }}>{session.title}</h3>
              <div style={styles.meta}>
                About {Math.round(session.estimatedDurationSec / 60)} min · Target{" "}
                {session.targetDurationMin}
                min
              </div>
              <h4>Warmup</h4>
              {session.warmup.map((item) => (
                <PlanExercise
                  key={item.slug}
                  item={item}
                  exercise={resolved.bySlug.get(item.slug) as Exercise}
                />
              ))}
              <h4>Main workout</h4>
              {session.main.map((item) => (
                <PlanExercise
                  key={item.slug}
                  item={item}
                  exercise={resolved.bySlug.get(item.slug) as Exercise}
                />
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
