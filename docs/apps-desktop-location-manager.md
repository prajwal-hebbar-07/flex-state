---
id: apps-desktop-location-manager
source: apps/desktop/src/LocationManager.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-locations, apps-desktop-data-exercises, apps-desktop-data-schedule, apps-desktop-app]
status: current
---

## Purpose
Renders first-run training-ground registration and later Loadout management while preserving per-location equipment, readiness, restrictions, rename, save, regeneration, and delete behavior.

## Contract

```ts
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

export function LocationManager(props: LocationManagerProps): React.JSX.Element;
```

## Behavior
1. `firstRun` renders `AWAKENING 01 / 02`, `Register your training grounds`, and autofocuses the name field. Later use renders `Loadouts`.
2. The exit button remains `Continue` during first run and `Done` later, and cannot continue with zero locations.
3. Creation computes the immutable id once, starts with bodyweight equipment and no restrictions, and preserves the existing duplicate/blank-name validation.
4. Each loadout retains its local draft until `Save location`.
5. Equipment is labelled `Available equipment`; readiness is labelled `Quest availability`; exclusions use `Restricted exercises (optional)`.
6. `locationReadiness()` runs against the draft so counts and missing-equipment guidance update before save.
7. The restriction search, category groups, unknown-slug cleanup, and no-match state are unchanged.
8. Delete still confirms with `Delete this location?`, is disabled for the active location, and keeps the exact reason visible.
9. The active loadout offers explicit regeneration; edits do not regenerate automatically.
10. No database or Tauri calls; every write goes through the supplied callbacks.

## Invariants
- Location ids are created once and never change on rename.
- The component never invents a display name.
- Equipment options and labels come from the shared catalog constants.
- The active loadout cannot be deleted in either the UI or database layer.
- Exercise restrictions remain owned by locations, not the player profile.

## Gotchas
- Two different names can collide on one id (`Nani's house` and `nanis house`). That is reported as an existing place, which is accurate but reads oddly when the names look different.
- `Save location` writes the whole draft. Opening a card and saving without edits is a no-op write, not a corruption.
- The readiness counts ignore difficulty and impact, so a beginner profile can still hit `insufficient_eligible_exercises` on a focus this screen showed as healthy.
- The delete guard here is a convenience. `deleteLocation()` re-checks and throws, and that error surfaces through the `error` prop.

## Related
[[apps-desktop-data-locations]]
[[apps-desktop-data-exercises]]
[[apps-desktop-data-schedule]]
[[apps-desktop-app]]
[[apps-desktop-personalized-plan]]
