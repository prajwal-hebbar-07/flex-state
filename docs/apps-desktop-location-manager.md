---
id: apps-desktop-location-manager
source: apps/desktop/src/LocationManager.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-locations, apps-desktop-data-exercises, apps-desktop-data-schedule, apps-desktop-app]
status: current
---

## Purpose
Creates, renames, re-equips, and deletes the places the user trains in, and holds the per-location exercise exclusion list. It is also the first-run screen: with zero locations it is the only thing the app renders.

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
1. `firstRun` renders the heading `Where do you work out?`, the sub-line `Name each place and tick what you have there. You can add more later.`, and autofocuses the name input. Otherwise the heading is `Your locations`. It stays true for the whole of onboarding, not only while the list is empty.
2. The exit button reads `Continue` under `firstRun` and `Done` otherwise. It is disabled while `locations` is empty, so first run cannot be skipped.
3. Creating a location computes its id once as `normalizeLocationId(name)`, falling back to `` `location-${crypto.randomUUID().slice(0, 8)}` `` when that is `""`. `displayOrder` is `max(existing) + 1`. A new location starts with `equipment: ["bodyweight"]` and no exclusions.
4. A blank or whitespace-only name reports `Type a name for this place.` Any other name is accepted, including punctuation-only and non-Latin scripts.
5. An id that already exists reports `You already have a place called <existing name>.` The slug is never shown and the typed name is never rewritten.
6. Each location renders as a card holding its name input, one equipment checkbox per `EQUIPMENT_KINDS` entry labelled from `EQUIPMENT_LABELS`, a readiness list, and a collapsed searchable exclusion checklist grouped by category.
7. Card edits are local until `Save location`, which calls `onUpsert` with the draft.
8. The readiness list runs `locationReadiness()` over the draft, so counts update as equipment is ticked. A focus with fewer than two eligible exercises renders in the warning colour and names the missing kinds.
9. `Save location` is disabled while the draft fails `isLocation`, with the reason `Give this place a name and tick at least one thing you have here.` rendered above it.
10. `Delete` confirms with `Delete this location?` and is disabled when the card is the active location, with the reason rendered beside it.
11. The active location's card also offers `Regenerate plan`, which calls `onRegenerate`. Editing a location never regenerates on its own.
12. Slugs excluded but absent from the catalog stay visible under `No longer in catalog` so the user can clear them.
13. No database, network, or Tauri calls; every write goes through `onUpsert` / `onDelete`.

## Invariants
- The component never writes a name the user did not type. It has no default and no placeholder name.
- A location's id is computed once at create time and is never recomputed on rename.
- The equipment checklist and every equipment label come from `EQUIPMENT_KINDS` and `EQUIPMENT_LABELS`; no kind string is hardcoded here.
- The exclusion fieldset exists only in this component. `ProfileForm` does not have one.

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
