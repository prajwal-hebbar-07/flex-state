import { Button } from "@flex-state/ui";
import { type ReactNode, useEffect, useState } from "react";
import {
  claimWorkoutCompletion,
  clearPersonalization,
  deleteLocation,
  ensureReady,
  listCategories,
  listExercises,
  listLocations,
  listWorkoutCompletions,
  loadPersonalization,
  type PersonalizationLoadResult,
  savePersonalization,
  upsertLocation,
} from "./data/db";
import type { Category, Exercise } from "./data/exercises";
import { LEGACY_LOCATION_NAME, type Location } from "./data/locations";
import { localDateKey, questXp, summarizeProgress, type WorkoutCompletion } from "./data/progress";
import { generateWeeklyPlan, type PersonalizationProfile, type WorkoutDay } from "./data/schedule";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { LocationManager } from "./LocationManager";
import { PlanView, ProfileForm } from "./PersonalizedPlan";

type Status =
  | { kind: "loading" }
  | {
      kind: "ready";
      categories: Category[];
      exercises: Exercise[];
      locations: Location[];
      personalization: PersonalizationLoadResult;
      completions: WorkoutCompletion[];
    }
  | { kind: "error"; message: string };

type Screen = "plan" | "library" | "profile" | "locations";
type ProfileMode = "save" | "regenerate";

export function App(): ReactNode {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [screen, setScreen] = useState<Screen>("profile");
  const [profileMode, setProfileMode] = useState<ProfileMode>("save");
  const [formRevision, setFormRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureReady();
        const [categories, exercises, locations, completions, loaded] = await Promise.all([
          listCategories(),
          listExercises(),
          listLocations(),
          listWorkoutCompletions(),
          loadPersonalization(),
        ]);
        // A saved plan can only point at a missing location through a hand-edited
        // DB: deleteLocation refuses the referenced one. Recover on the existing
        // regeneration form rather than with a screen of its own.
        const reconciled: PersonalizationLoadResult =
          loaded.kind === "ready" &&
          !locations.some((location) => location.id === loaded.saved.profile.locationId)
            ? {
                kind: "regeneration_required",
                profile: { ...loaded.saved.profile, locationId: locations[0]?.id ?? "" },
                reason: "location_missing",
              }
            : loaded;
        if (!cancelled) {
          setStatus({
            kind: "ready",
            categories,
            exercises,
            locations,
            personalization: reconciled,
            completions,
          });
          setScreen(reconciled.kind === "ready" ? "plan" : "profile");
          setProfileMode(reconciled.kind === "regeneration_required" ? "regenerate" : "save");
          // A v1 install arrives with one location carrying the only
          // app-generated name in the codebase. Send the user to rename it
          // before they regenerate.
          if (
            reconciled.kind === "regeneration_required" &&
            locations.some((location) => location.name === LEGACY_LOCATION_NAME)
          ) {
            setScreen("locations");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.kind === "loading") {
    return (
      <main className="system-state">
        <section className="system-panel system-state-panel">
          <p className="system-label">SYSTEM BOOTING</p>
          <h1>Flex State</h1>
          <p>Loading local exercise data...</p>
        </section>
      </main>
    );
  }
  if (status.kind === "error") {
    return (
      <main className="system-state">
        <section className="system-panel system-state-panel system-fault">
          <p className="system-label">SYSTEM FAULT</p>
          <h1>Flex State</h1>
          <p role="alert">DB error: {status.message}</p>
        </section>
      </main>
    );
  }

  const { categories, exercises, locations, personalization, completions } = status;
  const progress = summarizeProgress(completions, new Date());
  const todayCompletion = completions.find(
    (completion) => completion.completedOn === localDateKey(new Date()),
  );
  const activeLocationId =
    personalization.kind === "ready" ? personalization.saved.profile.locationId : "";

  function openProfile(mode: ProfileMode): void {
    setProfileMode(mode);
    setFormRevision((revision) => revision + 1);
    setFormError(null);
    setScreen("profile");
  }

  async function submitProfile(profile: PersonalizationProfile): Promise<boolean> {
    setSaving(true);
    setFormError(null);
    try {
      const result = generateWeeklyPlan(profile, exercises, locations);
      if (!result.ok) {
        setFormError(result.issues.map((issue) => issue.message).join("\n"));
        return false;
      }
      const saved = await savePersonalization(profile, result.plan);
      setStatus((current) =>
        current.kind === "ready"
          ? { ...current, personalization: { kind: "ready", saved } }
          : current,
      );
      setScreen("plan");
      setProfileMode("save");
      return true;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function switchLocation(locationId: string): Promise<void> {
    if (personalization.kind !== "ready") return;
    const ok = await submitProfile({ ...personalization.saved.profile, locationId });
    if (!ok) {
      // The plan screen has nowhere to show a generation error; hand the user the
      // form, which renders formError verbatim. Not openProfile: that clears it.
      setProfileMode("regenerate");
      setScreen("profile");
    }
  }

  async function refreshLocations(): Promise<void> {
    const next = await listLocations();
    setStatus((current) => (current.kind === "ready" ? { ...current, locations: next } : current));
  }

  async function saveLocation(location: Location): Promise<void> {
    setSaving(true);
    setLocationError(null);
    try {
      await upsertLocation(location);
      await refreshLocations();
      // Creating the first location makes the empty-list branch stop matching;
      // without this the user is thrown onto the profile form mid-onboarding.
      setScreen("locations");
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function removeLocation(id: string): Promise<void> {
    setSaving(true);
    setLocationError(null);
    try {
      await deleteLocation(id);
      await refreshLocations();
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function resetProfile(): Promise<void> {
    if (!window.confirm("Delete the saved profile and plan?")) return;
    setSaving(true);
    setResetError(null);
    try {
      await clearPersonalization();
      setStatus((current) =>
        current.kind === "ready" ? { ...current, personalization: { kind: "none" } } : current,
      );
      setProfileMode("save");
      setFormRevision((revision) => revision + 1);
      setScreen("profile");
    } catch (error) {
      setResetError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function completeQuest(day: WorkoutDay): Promise<void> {
    if (personalization.kind !== "ready") return;
    const now = new Date();
    const completion: WorkoutCompletion = {
      completedOn: localDateKey(now),
      completedAt: now.toISOString(),
      planDay: day.day,
      sessionTitle: day.session.title,
      planName: personalization.saved.plan.name,
      locationId: personalization.saved.profile.locationId,
      durationMinutes: day.session.targetDurationMin,
      xp: questXp(day.session.targetDurationMin),
    };
    setCompleting(true);
    setCompletionError(null);
    try {
      await claimWorkoutCompletion(completion);
      const next = await listWorkoutCompletions();
      setStatus((current) =>
        current.kind === "ready" ? { ...current, completions: next } : current,
      );
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : String(error));
    } finally {
      setCompleting(false);
    }
  }

  // Onboarding lasts until a plan exists, not until the first location does:
  // the user keeps adding places and ticking equipment after location one.
  const locationManager = (): ReactNode => (
    <LocationManager
      locations={locations}
      categories={categories}
      catalog={exercises}
      activeLocationId={activeLocationId}
      onUpsert={saveLocation}
      onDelete={removeLocation}
      onRegenerate={() => void switchLocation(activeLocationId)}
      onClose={() => setScreen(personalization.kind === "ready" ? "plan" : "profile")}
      firstRun={personalization.kind !== "ready"}
      error={locationError}
      saving={saving}
    />
  );

  return (
    <main className="system-shell">
      <header className="system-header">
        <div className="system-header-top">
          <div className="system-brand">
            <h1>Flex State</h1>
            <span className="system-label">SYSTEM ONLINE</span>
          </div>
          <section className="system-hud" aria-label="Player progress">
            <span>
              <b>Rank {progress.rank}</b>
            </span>
            <span>
              <b>Lv. {String(progress.level).padStart(2, "0")}</b>
            </span>
            <span>
              {progress.levelXp} / {progress.levelXpTarget} XP
            </span>
            <span>{progress.currentStreak} day streak</span>
          </section>
        </div>

        {personalization.kind === "ready" ? (
          <nav aria-label="Main navigation" className="system-nav">
            <Button
              className="system-nav-button"
              aria-current={screen === "plan" ? "page" : undefined}
              onClick={() => setScreen("plan")}
            >
              Quest Board
            </Button>
            <Button
              className="system-nav-button"
              aria-current={screen === "library" ? "page" : undefined}
              onClick={() => setScreen("library")}
            >
              Skill Archive
            </Button>
            <Button
              className="system-nav-button"
              aria-current={screen === "locations" ? "page" : undefined}
              onClick={() => setScreen("locations")}
            >
              Loadouts
            </Button>
            <Button
              className="system-nav-button"
              aria-current={screen === "profile" ? "page" : undefined}
              onClick={() => openProfile("save")}
            >
              Player Profile
            </Button>
          </nav>
        ) : null}
      </header>

      <div className="screen-content">
        {locations.length === 0 ? (
          locationManager()
        ) : personalization.kind === "invalid_profile" ? (
          <section className="system-panel system-fault content-narrow">
            <p className="system-label">SYSTEM FAULT</p>
            <p role="alert">DB error: {personalization.message}</p>
            {resetError ? <p role="alert">{resetError}</p> : null}
            <Button className="danger-button" onClick={resetProfile} disabled={saving}>
              {saving ? "Resetting..." : "Reset profile"}
            </Button>
          </section>
        ) : screen === "locations" ? (
          locationManager()
        ) : personalization.kind === "regeneration_required" ? (
          <>
            <div className="system-panel system-warning content-narrow">
              <p className="system-label">REGENERATION REQUIRED</p>
              {personalization.reason === "invalid_plan_json"
                ? "Your saved plan could not be read. Regenerate it from the saved profile."
                : personalization.reason === "location_missing"
                  ? "The location this plan was made for no longer exists. Pick a location and regenerate."
                  : "Your saved plan uses an unsupported generator version. Regenerate it to continue."}
            </div>
            <ProfileForm
              key={`recovery-${formRevision}`}
              locations={locations}
              initialProfile={personalization.profile}
              submitLabel="Regenerate plan"
              saving={saving}
              error={formError}
              onSubmit={submitProfile}
              onManageLocations={() => setScreen("locations")}
            />
          </>
        ) : personalization.kind === "none" ? (
          <ProfileForm
            key={`new-${formRevision}`}
            locations={locations}
            submitLabel="Save plan"
            saving={saving}
            error={formError}
            onSubmit={submitProfile}
            onManageLocations={() => setScreen("locations")}
          />
        ) : screen === "library" ? (
          <ExerciseBrowser categories={categories} exercises={exercises} />
        ) : screen === "profile" ? (
          <ProfileForm
            key={`${profileMode}-${formRevision}`}
            locations={locations}
            initialProfile={personalization.saved.profile}
            submitLabel={profileMode === "regenerate" ? "Regenerate plan" : "Save plan"}
            saving={saving}
            error={formError}
            onSubmit={submitProfile}
            onManageLocations={() => setScreen("locations")}
            onCancel={() => setScreen("plan")}
          />
        ) : (
          <PlanView
            key={`${personalization.saved.generatedAt}-${completions.length}`}
            saved={personalization.saved}
            catalog={exercises}
            locations={locations}
            progress={progress}
            completions={completions}
            todayCompletion={todayCompletion}
            completing={completing}
            completionError={completionError}
            onComplete={completeQuest}
            onEdit={() => openProfile("save")}
            onRegenerate={() => openProfile("regenerate")}
            onSwitchLocation={(locationId) => void switchLocation(locationId)}
            saving={saving}
          />
        )}
      </div>
    </main>
  );
}
