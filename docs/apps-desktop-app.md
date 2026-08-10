---
id: apps-desktop-app
source: apps/desktop/src/App.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-db, apps-desktop-data-schedule, apps-desktop-personalized-plan, apps-desktop-exercise-browser]
status: current
---

## Purpose
Coordinates desktop database readiness, first-run profile setup, saved-plan navigation, explicit regeneration, library access, and corrupt-row recovery without a router or global application state.

## Contract

```ts
export function App(): ReactNode;
```

## Behavior
1. Launch runs `ensureReady()`, then loads categories, exercises, and personalization in parallel.
2. No saved row opens the profile form with no cancel action.
3. A ready snapshot opens `My Plan` and enables `My Plan`, `Exercise Library`, and `Edit Profile` navigation.
4. A stale generator version or invalid plan JSON opens a prefilled regeneration form and does not display or overwrite the old plan.
5. An invalid persisted profile displays the database error and requires confirmation text `Delete the saved profile and plan?` before reset.
6. Profile submission generates a plan before persistence, saves only successful generation, replaces ready state with the returned snapshot, and navigates to the plan.
7. Generation and database failures remain on the form and preserve both entered inputs and any prior snapshot.
8. Ordinary launch and screen navigation never regenerate a plan.

## Invariants
- The screen state is exactly `plan`, `library`, or `profile`.
- A saved snapshot changes only after successful explicit profile submission or confirmed reset.
- First-run setup and recovery do not expose library or plan navigation before a valid snapshot exists.
- The exercise library receives the unchanged loaded catalog component contract.

## Gotchas
- End-to-end verification requires the Tauri desktop runtime; a Vite browser page does not exercise the SQL plugin boundary.
- Reset deletes the only local profile and plan for the installation.

## Related
[[apps-desktop-exercise-browser]]
[[apps-desktop-data-db]]
[[apps-desktop-data-schedule]]
[[apps-desktop-personalized-plan]]
