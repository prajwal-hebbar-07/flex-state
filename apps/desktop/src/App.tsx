import { Button } from "@flex-state/ui";
import { type ReactNode, useEffect, useState } from "react";
import {
  clearPersonalization,
  ensureReady,
  listCategories,
  listExercises,
  loadPersonalization,
  type PersonalizationLoadResult,
  savePersonalization,
} from "./data/db";
import type { Category, Exercise } from "./data/exercises";
import { generateWeeklyPlan, type PersonalizationProfile } from "./data/schedule";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { PlanView, ProfileForm } from "./PersonalizedPlan";

type Status =
  | { kind: "loading" }
  | {
      kind: "ready";
      categories: Category[];
      exercises: Exercise[];
      personalization: PersonalizationLoadResult;
    }
  | { kind: "error"; message: string };

type Screen = "plan" | "library" | "profile";
type ProfileMode = "save" | "regenerate";

export function App(): ReactNode {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [screen, setScreen] = useState<Screen>("profile");
  const [profileMode, setProfileMode] = useState<ProfileMode>("save");
  const [formRevision, setFormRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureReady();
        const [categories, exercises, personalization] = await Promise.all([
          listCategories(),
          listExercises(),
          loadPersonalization(),
        ]);
        if (!cancelled) {
          setStatus({ kind: "ready", categories, exercises, personalization });
          setScreen(personalization.kind === "ready" ? "plan" : "profile");
          setProfileMode(personalization.kind === "regeneration_required" ? "regenerate" : "save");
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
      <main>
        <h1>Flex State</h1>
        <p>Loading exercise library...</p>
      </main>
    );
  }
  if (status.kind === "error") {
    return (
      <main>
        <h1>Flex State</h1>
        <p style={{ color: "#f87171" }}>DB error: {status.message}</p>
      </main>
    );
  }

  const { categories, exercises, personalization } = status;

  function openProfile(mode: ProfileMode): void {
    setProfileMode(mode);
    setFormRevision((revision) => revision + 1);
    setFormError(null);
    setScreen("profile");
  }

  async function submitProfile(profile: PersonalizationProfile): Promise<void> {
    setSaving(true);
    setFormError(null);
    try {
      const result = generateWeeklyPlan(profile, exercises);
      if (!result.ok) {
        setFormError(result.issues.map((issue) => issue.message).join("\n"));
        return;
      }
      const saved = await savePersonalization(profile, result.plan);
      setStatus((current) =>
        current.kind === "ready"
          ? { ...current, personalization: { kind: "ready", saved } }
          : current,
      );
      setScreen("plan");
      setProfileMode("save");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
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

  return (
    <main>
      <h1>Flex State</h1>

      {personalization.kind === "ready" ? (
        <nav
          aria-label="Main navigation"
          style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}
        >
          <Button onClick={() => setScreen("plan")}>My Plan</Button>
          <Button onClick={() => setScreen("library")}>Exercise Library</Button>
          <Button onClick={() => openProfile("save")}>Edit Profile</Button>
        </nav>
      ) : null}

      {personalization.kind === "invalid_profile" ? (
        <section style={{ maxWidth: 720, margin: "1rem auto", padding: "1rem" }}>
          <p role="alert" style={{ color: "#f87171" }}>
            DB error: {personalization.message}
          </p>
          {resetError ? (
            <p role="alert" style={{ color: "#f87171" }}>
              {resetError}
            </p>
          ) : null}
          <Button onClick={resetProfile} disabled={saving}>
            {saving ? "Resetting..." : "Reset profile"}
          </Button>
        </section>
      ) : personalization.kind === "regeneration_required" ? (
        <>
          <p
            style={{
              maxWidth: 720,
              margin: "1rem auto 0",
              padding: "0 1rem",
              color: "#fde68a",
            }}
          >
            {personalization.reason === "invalid_plan_json"
              ? "Your saved plan could not be read. Regenerate it from the saved profile."
              : "Your saved plan uses an unsupported generator version. Regenerate it to continue."}
          </p>
          <ProfileForm
            key={`recovery-${formRevision}`}
            categories={categories}
            catalog={exercises}
            initialProfile={personalization.profile}
            submitLabel="Regenerate plan"
            saving={saving}
            error={formError}
            onSubmit={submitProfile}
          />
        </>
      ) : personalization.kind === "none" ? (
        <ProfileForm
          key={`new-${formRevision}`}
          categories={categories}
          catalog={exercises}
          submitLabel="Save plan"
          saving={saving}
          error={formError}
          onSubmit={submitProfile}
        />
      ) : screen === "library" ? (
        <ExerciseBrowser categories={categories} exercises={exercises} />
      ) : screen === "profile" ? (
        <ProfileForm
          key={`${profileMode}-${formRevision}`}
          categories={categories}
          catalog={exercises}
          initialProfile={personalization.saved.profile}
          submitLabel={profileMode === "regenerate" ? "Regenerate plan" : "Save plan"}
          saving={saving}
          error={formError}
          onSubmit={submitProfile}
          onCancel={() => setScreen("plan")}
        />
      ) : (
        <PlanView
          saved={personalization.saved}
          catalog={exercises}
          onEdit={() => openProfile("save")}
          onRegenerate={() => openProfile("regenerate")}
        />
      )}
    </main>
  );
}
