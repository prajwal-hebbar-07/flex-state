import { Button } from "@flex-state/ui";
import type { FormEvent } from "react";
import * as React from "react";
import type { SavedPersonalization } from "./data/db";
import { EQUIPMENT_LABELS, type Exercise } from "./data/exercises";
import type { Location } from "./data/locations";
import type { PlayerProgress, WorkoutCompletion } from "./data/progress";
import {
  type DaysPerWeek,
  formatPrescription,
  isPersonalizationProfile,
  type PersonalizationProfile,
  type PrescribedExercise,
  resolvePlan,
  type SessionMinutes,
  type TrainingGoal,
  type WorkoutDay,
} from "./data/schedule";

export interface ProfileFormProps {
  locations: Location[];
  initialProfile?: PersonalizationProfile;
  submitLabel: "Save plan" | "Regenerate plan";
  saving: boolean;
  error: string | null;
  onSubmit: (profile: PersonalizationProfile) => Promise<unknown>;
  onManageLocations: () => void;
  onCancel?: () => void;
}

export interface PlanViewProps {
  saved: SavedPersonalization;
  catalog: Exercise[];
  locations: Location[];
  progress: PlayerProgress;
  completions: WorkoutCompletion[];
  todayCompletion?: WorkoutCompletion;
  completing: boolean;
  completionError: string | null;
  onComplete: (day: WorkoutDay) => Promise<void>;
  onEdit: () => void;
  onRegenerate: () => void;
  onSwitchLocation: (locationId: string) => void;
  saving: boolean;
}

// No `locationId`: there is no default location to name. The form takes the
// first user-created one, and App never renders it with an empty list.
const DEFAULT_PROFILE: Omit<PersonalizationProfile, "locationId"> = {
  primaryGoal: "general_fitness",
  experience: "beginner",
  daysPerWeek: 3,
  sessionMinutes: 15,
  lowImpactOnly: false,
};

const GOAL_LABELS: Record<TrainingGoal, string> = {
  general_fitness: "General fitness",
  strength: "Strength",
  conditioning: "Conditioning",
  mobility_balance: "Mobility & balance",
};

export function ProfileForm({
  locations,
  initialProfile,
  submitLabel,
  saving,
  error,
  onSubmit,
  onManageLocations,
  onCancel,
}: ProfileFormProps): React.JSX.Element {
  const [profile, setProfile] = React.useState<PersonalizationProfile>(() => ({
    ...(initialProfile ?? DEFAULT_PROFILE),
    locationId: initialProfile?.locationId ?? (locations[0] as Location).id,
  }));
  const [validationError, setValidationError] = React.useState<string | null>(null);

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
    <section className="screen-section content-narrow">
      <header className="section-heading">
        <p className="system-label">
          {initialProfile ? "STATUS CONFIGURATION" : "AWAKENING 02 / 02"}
        </p>
        <h2>{initialProfile ? "Player Profile" : "Configure your player profile"}</h2>
        <p>
          Choose your fitness goal and training constraints. Your plan is generated offline and
          saved on this installation.
        </p>
      </header>
      <form className="system-panel form-stack" onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Primary goal</span>
            <small>Sets the main emphasis of each workout.</small>
            <select
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
          <label className="form-field">
            <span>Experience</span>
            <small>Keeps exercise selection appropriate.</small>
            <select
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
          <label className="form-field">
            <span>Days/week</span>
            <small>Your weekly quest target.</small>
            <select
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
          <label className="form-field">
            <span>Session length</span>
            <small>Controls each quest's duration and XP.</small>
            <select
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
          <label className="form-field">
            <span>Location</span>
            <small>Selects the equipment used for generation.</small>
            <select
              value={profile.locationId}
              onChange={(event) => setProfile({ ...profile, locationId: event.target.value })}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={profile.lowImpactOnly}
            onChange={(event) => setProfile({ ...profile, lowImpactOnly: event.target.checked })}
          />
          Low impact only
        </label>

        {validationError || error ? (
          <div role="alert" className="system-alert system-fault">
            {validationError ?? error}
          </div>
        ) : null}
        <div className="button-row">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : submitLabel}
          </Button>
          <Button
            type="button"
            className="secondary-button"
            onClick={onManageLocations}
            disabled={saving}
          >
            Manage loadouts
          </Button>
          {onCancel ? (
            <Button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>
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
    <div className="plan-exercise">
      <strong>{exercise.name}</strong>
      <div>{formatPrescription(item.prescription)}</div>
      <div className="meta-text">
        {exercise.requires.map((kind) => EQUIPMENT_LABELS[kind]).join(" · ")} ·{" "}
        {exercise.difficulty} · {exercise.primaryMuscles.join(", ")}
      </div>
      {item.notes ? <div className="exercise-note">{item.notes}</div> : null}
    </div>
  );
}

export function PlanView({
  saved,
  catalog,
  locations,
  progress,
  completions,
  todayCompletion,
  completing,
  completionError,
  onComplete,
  onEdit,
  onRegenerate,
  onSwitchLocation,
  saving,
}: PlanViewProps): React.JSX.Element {
  const resolved = resolvePlan(saved.plan, catalog);
  const profile = saved.profile;
  const locationName =
    locations.find((location) => location.id === profile.locationId)?.name ?? profile.locationId;
  const questDay = saved.plan.days[completions.length % saved.plan.days.length] as WorkoutDay;
  const checklist = [
    ...questDay.session.warmup.map((item, index) => ({
      item,
      section: "warmup",
      key: `warmup-${index}-${item.slug}`,
    })),
    ...questDay.session.main.map((item, index) => ({
      item,
      section: "main",
      key: `main-${index}-${item.slug}`,
    })),
  ];
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set());
  const allChecked = checklist.length > 0 && checklist.every((entry) => checked.has(entry.key));

  return (
    <section className="screen-section">
      <header className="quest-board-header">
        <div>
          <p className="system-label">QUEST BOARD</p>
          <h2>{saved.plan.name}</h2>
          <p className="meta-text">Generated {new Date(saved.generatedAt).toLocaleString()}</p>
        </div>
        <div className="quest-board-actions">
          <label className="form-field compact-field">
            <span>Active location</span>
            <select
              value={profile.locationId}
              disabled={saving}
              onChange={(event) => onSwitchLocation(event.target.value)}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <Button className="secondary-button" onClick={onEdit}>
            Edit profile
          </Button>
        </div>
      </header>

      {saved.plan.warnings.map((warning) => (
        <div
          key={
            warning.code === "unknown_exclusion" ? warning.slug : `${warning.code}-${warning.day}`
          }
          className="system-panel system-warning"
        >
          <p className="system-label">SYSTEM NOTICE</p>
          {warning.code === "unknown_exclusion"
            ? `Excluded exercise "${warning.slug}" is no longer in the catalog.`
            : warning.code === "duration_target_unmet"
              ? `Day ${warning.day} is shorter than the requested duration because no additional eligible exercises fit.`
              : `Day ${warning.day} exceeds the requested duration because every session requires at least two exercises.`}
        </div>
      ))}

      {resolved.missing.length > 0 ? (
        <div role="alert" className="system-panel system-fault">
          <p className="system-label">SYSTEM FAULT</p>
          <strong>Saved plan references missing exercises</strong>
          <div className="button-row">
            <Button onClick={onRegenerate}>Regenerate plan</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="quest-dashboard">
            <aside className="system-panel player-status">
              <p className="system-label">PLAYER STATUS</p>
              <div className="rank-level">
                <strong>Rank {progress.rank}</strong>
                <strong>Level {progress.level}</strong>
              </div>
              <label>
                <span className="progress-label">
                  <span>Level progress</span>
                  <span>
                    {progress.levelXp} / {progress.levelXpTarget} XP
                  </span>
                </span>
                <progress value={progress.levelXp} max={progress.levelXpTarget} />
              </label>
              <dl className="status-list">
                <div>
                  <dt>Streak</dt>
                  <dd>
                    {progress.currentStreak > 0
                      ? `${progress.currentStreak} days`
                      : "Begin a new streak today"}
                  </dd>
                </div>
                <div>
                  <dt>This week</dt>
                  <dd>
                    {progress.weeklyCompleted} / {profile.daysPerWeek} cleared
                  </dd>
                </div>
                <div>
                  <dt>Goal</dt>
                  <dd>{GOAL_LABELS[profile.primaryGoal]}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd className="capitalize">{profile.experience}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{locationName}</dd>
                </div>
              </dl>
              <label>
                <span className="progress-label">
                  <span>Weekly progress</span>
                  <span>
                    {progress.weeklyCompleted} / {profile.daysPerWeek}
                  </span>
                </span>
                <progress
                  value={Math.min(progress.weeklyCompleted, profile.daysPerWeek)}
                  max={profile.daysPerWeek}
                />
              </label>
            </aside>

            <article className="system-panel quest-card active-panel">
              <div className="quest-title-row">
                <div>
                  <p className="system-label">TODAY&apos;S QUEST</p>
                  <h3>{todayCompletion?.sessionTitle ?? questDay.session.title}</h3>
                </div>
                <strong className="xp-reward">
                  +{todayCompletion?.xp ?? questDay.session.targetDurationMin * 10} XP
                </strong>
              </div>
              {todayCompletion ? (
                <div className="quest-cleared" aria-live="polite">
                  <p className="system-label">QUEST CLEARED</p>
                  <p>Completed {new Date(todayCompletion.completedAt).toLocaleString()}</p>
                  <p>Recovery is part of progression. Return when you are ready.</p>
                </div>
              ) : (
                <>
                  <p className="meta-text">
                    Day {questDay.day} · About{" "}
                    {Math.round(questDay.session.estimatedDurationSec / 60)} min · {locationName}
                  </p>
                  <div className="quest-checklist">
                    {checklist.map(({ item, section, key }) => (
                      <label className="quest-check" key={key}>
                        <input
                          type="checkbox"
                          checked={checked.has(key)}
                          onChange={(event) =>
                            setChecked((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            })
                          }
                        />
                        <span>
                          <span className="system-label">
                            {section === "warmup" ? "WARMUP" : "MAIN WORKOUT"}
                          </span>
                          <PlanExercise
                            item={item}
                            exercise={resolved.bySlug.get(item.slug) as Exercise}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                  {completionError ? (
                    <div role="alert" className="system-alert system-fault">
                      {completionError} Check your local database and retry.
                    </div>
                  ) : null}
                  <Button
                    className="clear-quest-button"
                    disabled={!allChecked || completing}
                    onClick={() => void onComplete(questDay)}
                  >
                    {completing
                      ? "Clearing quest..."
                      : `Clear Quest +${questDay.session.targetDurationMin * 10} XP`}
                  </Button>
                </>
              )}
            </article>
          </div>

          <section className="quest-chain">
            <div className="section-heading">
              <p className="system-label">QUEST CHAIN</p>
              <h3>Generated workout sequence</h3>
            </div>
            <div className="card-grid">
              {saved.plan.days.map(({ day, session }) => {
                const isCurrent = !todayCompletion && day === questDay.day;
                const isClearedToday = todayCompletion?.planDay === day;
                return (
                  <article
                    key={day}
                    className={`system-panel quest-chain-card${isCurrent ? " current-quest" : ""}${
                      isClearedToday ? " cleared-today" : ""
                    }`}
                  >
                    <p className="system-label">
                      DAY {day}
                      {isCurrent ? " · CURRENT QUEST" : ""}
                      {isClearedToday ? " · CLEARED TODAY" : ""}
                    </p>
                    <h3>{session.title}</h3>
                    <p className="meta-text">
                      About {Math.round(session.estimatedDurationSec / 60)} min · Target{" "}
                      {session.targetDurationMin} min
                    </p>
                    <h4>Warmup</h4>
                    {session.warmup.map((item) => (
                      <PlanExercise
                        key={`day-${day}-warmup-${item.slug}`}
                        item={item}
                        exercise={resolved.bySlug.get(item.slug) as Exercise}
                      />
                    ))}
                    <h4>Main workout</h4>
                    {session.main.map((item) => (
                      <PlanExercise
                        key={`day-${day}-main-${item.slug}`}
                        item={item}
                        exercise={resolved.bySlug.get(item.slug) as Exercise}
                      />
                    ))}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
