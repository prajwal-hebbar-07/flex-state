---
id: apps-desktop-personalized-plan
source: apps/desktop/src/PersonalizedPlan.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-db, apps-desktop-data-progress, apps-desktop-data-exercises, apps-desktop-data-schedule, apps-desktop-data-locations]
status: current
---

## Purpose
Renders the Awakening/player-profile form and the Quest Board, including derived player status, Today's Quest checklist, completion feedback, and the informational Quest Chain.

## Contract

```ts
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

export function ProfileForm(props: ProfileFormProps): React.JSX.Element;
export function PlanView(props: PlanViewProps): React.JSX.Element;
```

## Behavior
1. `ProfileForm` keeps the existing controlled goal, experience, days, duration, location, and low-impact fields. No profile fields were added.
2. No initial profile renders `AWAKENING 02 / 02`; later edits render `Player Profile`.
3. Submission validates the complete profile, awaits `onSubmit()`, disables actions while saving, and preserves values after errors.
4. `PlanView` resolves the saved plan once through `resolvePlan()`. Any missing slug blocks completion and offers regeneration.
5. Today's uncompleted quest is `saved.plan.days[completions.length % saved.plan.days.length]`.
6. Warmup and main exercises render in execution order with checkbox keys containing section, index, and slug.
7. Checklist state is local and resets when the selected day or generated snapshot changes. A failed completion preserves all checked keys.
8. `Clear Quest +{xp} XP` remains disabled until every exercise is checked or while completion is being saved.
9. A completion for the current local date replaces the action area with its stored title, time, XP, `QUEST CLEARED`, and recovery copy in a polite live region.
10. Player Status shows rank, level XP, streak, weekly count/target, goal, experience, and location. The weekly progress bar caps visually while text can exceed the target.
11. Quest Chain renders every generated day; the pending day and today's cleared day have distinct text labels and styles.
12. Existing generation warnings, generated time, location switching, prescriptions, and regeneration behavior remain intact.

## Invariants
- `PlanView` never writes SQLite and never manufactures completion rows.
- Quest Chain cards are informational; only Today's Quest can call `onComplete`.
- Missing plan exercises are never omitted and always block completion.
- `ProfileForm` takes no catalog or category prop and collects no medical or body data.
- Location switching still regenerates and saves immediately.

## Gotchas
- Half-finished checklist state is intentionally not persisted across unmount or app restart.
- The completion count selects the next current-plan day; historical `planDay` is display metadata, not a cursor.
- Timestamps render in the installation's local locale while persistence uses ISO text.

## Related
[[apps-desktop-app]]
[[apps-desktop-data-progress]]
[[apps-desktop-data-db]]
[[apps-desktop-data-schedule]]
[[apps-desktop-location-manager]]

