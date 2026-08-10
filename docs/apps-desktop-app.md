---
id: apps-desktop-app
source: apps/desktop/src/App.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-db, apps-desktop-data-schedule, apps-desktop-data-locations, apps-desktop-personalized-plan, apps-desktop-location-manager, apps-desktop-exercise-browser]
status: current
---

## Purpose
Coordinates desktop database readiness, first-run profile setup, saved-plan navigation, explicit regeneration, library access, and corrupt-row recovery without a router or global application state.

## Contract

```ts
export function App(): ReactNode;
```

## Behavior
1. Launch runs `ensureReady()`, then loads categories, exercises, locations, and personalization in parallel.
2. `locations.length === 0` renders `LocationManager` in `firstRun` mode ahead of every other branch, so a fresh install asks where the user works out before anything else. No location is ever created by the app on that path.
3. A ready snapshot whose `profile.locationId` matches no loaded location is rewritten at load into `regeneration_required` with `reason: "location_missing"` and `locationId` pointing at the first location. There is no location-missing screen.
4. A `regeneration_required` load with some location named `LEGACY_LOCATION_NAME` opens the `locations` screen first, so a v1 install renames its migrated location before regenerating.
5. No saved row opens the profile form with no cancel action.
6. A ready snapshot opens `My Plan` and enables `My Plan`, `Exercise Library`, `Locations`, and `Edit Profile` navigation.
7. A stale generator version, invalid plan JSON, or missing location opens a prefilled regeneration form and does not display or overwrite the old plan.
8. An invalid persisted profile displays the database error and requires confirmation text `Delete the saved profile and plan?` before reset.
9. Profile submission generates a plan before persistence, saves only successful generation, replaces ready state with the returned snapshot, navigates to the plan, and returns whether it succeeded.
10. `switchLocation()` submits the saved profile with a new `locationId`, which regenerates and saves in place. On failure it opens the profile form without clearing `formError`, so the generation message stays visible.
11. Location create, edit, and delete call `upsertLocation()` / `deleteLocation()` and then reload the list; a thrown error renders inside `LocationManager` instead of replacing the screen. A successful write sets the screen to `locations`, so creating the first location does not eject the user from the manager.
12. Editing the active location does not auto-regenerate. `LocationManager` offers a `Regenerate plan` action that runs `switchLocation()` on the active id.
13. Generation and database failures remain on the form and preserve both entered inputs and any prior snapshot.
14. Ordinary launch and screen navigation never regenerate a plan. Switching the location on `My Plan` does, deliberately.

## Invariants
- The screen state is exactly `plan`, `library`, `locations`, or `profile`.
- There is no `activeLocationId` state. The active location is `personalization.saved.profile.locationId` and nothing else.
- The app never invents a location name. The only generated one, `LEGACY_LOCATION_NAME`, is written by the database migration and is compared here solely to route the user to rename it.
- `ProfileForm` is never rendered with an empty location list.
- A saved snapshot changes only after successful explicit profile submission or confirmed reset.
- First-run setup and recovery do not expose library or plan navigation before a valid snapshot exists.
- The exercise library receives the unchanged loaded catalog component contract.

## Gotchas
- Deleting every location routes back to the first-run `LocationManager` on the next render. Nothing is resurrected.
- End-to-end verification requires the Tauri desktop runtime; a Vite browser page does not exercise the SQL plugin boundary.
- Reset deletes the only local profile and plan for the installation.

## Related
[[apps-desktop-exercise-browser]]
[[apps-desktop-location-manager]]
[[apps-desktop-data-locations]]
[[apps-desktop-data-db]]
[[apps-desktop-data-schedule]]
[[apps-desktop-personalized-plan]]
