---
id: apps-desktop-personalized-plan
source: apps/desktop/src/PersonalizedPlan.tsx
updated: 2026-08-09
depends_on: [apps-desktop-data-db, apps-desktop-data-exercises, apps-desktop-data-schedule]
status: current
---

## Purpose
Renders the controlled offline personalization questionnaire and a saved plan snapshot resolved against the shared exercise catalog.

## Contract

```ts
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

export function ProfileForm(props: ProfileFormProps): React.JSX.Element;
export function PlanView(props: PlanViewProps): React.JSX.Element;
```

## Behavior
1. `ProfileForm` defaults to general fitness, beginner, three 15-minute days, bodyweight, unrestricted impact, and no exclusions.
2. Every profile field is controlled locally, including searchable catalog exclusions grouped by category.
3. Submission validates the complete profile, awaits `onSubmit()`, disables actions while saving, and preserves entered values after errors.
4. `PlanView` displays profile constraints, generation timestamp, exact warning messages, and one card per saved day.
5. Exercise names, equipment, difficulty, and muscles are resolved from the supplied catalog; the snapshot supplies slugs, prescriptions, and planner notes.
6. Any missing referenced slug blocks all workout cards and displays `Saved plan references missing exercises` with a regeneration action.
7. Regeneration and editing use the saved profile as form input; cancellation leaves the saved snapshot unchanged.

## Invariants
- The form stores only exercise slugs in `excludedExerciseSlugs`.
- The form does not collect accounts, age, weight, injury, diagnosis, or pain data.
- Failed validation, generation, or persistence does not replace the displayed saved snapshot.
- Missing plan exercises are never omitted silently.

## Gotchas
- Unknown saved exclusions remain visible under `No longer in catalog` so the user can remove them.
- The plan timestamp is formatted in the installation's local locale while the persisted value remains ISO text.

## Related
[[apps-desktop-app]]
[[apps-desktop-data-db]]
[[apps-desktop-data-exercises]]
[[apps-desktop-data-schedule]]
