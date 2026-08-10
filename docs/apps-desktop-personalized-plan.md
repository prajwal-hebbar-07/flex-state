---
id: apps-desktop-personalized-plan
source: apps/desktop/src/PersonalizedPlan.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-db, apps-desktop-data-exercises, apps-desktop-data-schedule, apps-desktop-data-locations]
status: current
---

## Purpose
Renders the controlled offline personalization questionnaire and a saved plan snapshot resolved against the shared exercise catalog.

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
  onEdit: () => void;
  onRegenerate: () => void;
  onSwitchLocation: (locationId: string) => void;
  saving: boolean;
}

export function ProfileForm(props: ProfileFormProps): React.JSX.Element;
export function PlanView(props: PlanViewProps): React.JSX.Element;
```

## Behavior
1. `ProfileForm` defaults to general fitness, beginner, three 15-minute days, unrestricted impact, and the first location in `locations`.
2. Every profile field is controlled locally. The form collects no equipment and no exclusions; both live on the location and are edited in `LocationManager`, reached through the form's `Manage locations` button.
3. The form has a `Location` select listing every location by name and bound to `profile.locationId`.
4. Submission validates the complete profile, awaits `onSubmit()`, disables actions while saving, and preserves entered values after errors.
5. `PlanView` displays profile constraints, generation timestamp, exact warning messages, and one card per saved day. The `Constraints` tile shows the location's name and still appends ` · Low impact` when set.
6. `PlanView`'s header holds a `Location` select. Changing it calls `onSwitchLocation`, which regenerates and saves in place; the select is disabled while `saving`. There is no stale-plan banner, because the rendered plan always matches the selection.
7. Exercise names, equipment labels, difficulty, and muscles are resolved from the supplied catalog; the snapshot supplies slugs, prescriptions, and planner notes. An exercise line renders every `EQUIPMENT_LABELS` value for its `requires`.
8. Any missing referenced slug blocks all workout cards and displays `Saved plan references missing exercises` with a regeneration action.
9. Regeneration and editing use the saved profile as form input; cancellation leaves the saved snapshot unchanged.

## Invariants
- `ProfileForm` takes no `categories` or `catalog` prop. The exclusion fieldset exists in exactly one place, `LocationManager`.
- The form does not collect accounts, age, weight, injury, diagnosis, or pain data.
- A location's name is only ever read here; neither component writes one.
- Failed validation, generation, or persistence does not replace the displayed saved snapshot.
- Missing plan exercises are never omitted silently.

## Gotchas
- `ProfileForm` reads `locations[0]` when `initialProfile` is absent. `App` never renders it with an empty list, and that is the only thing keeping the read safe.
- Switching the location on `PlanView` writes to the database immediately. It is not a preview.
- The plan timestamp is formatted in the installation's local locale while the persisted value remains ISO text.

## Related
[[apps-desktop-app]]
[[apps-desktop-location-manager]]
[[apps-desktop-data-locations]]
[[apps-desktop-data-db]]
[[apps-desktop-data-exercises]]
[[apps-desktop-data-schedule]]
