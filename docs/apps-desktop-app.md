---
id: apps-desktop-app
source: apps/desktop/src/App.tsx, apps/desktop/src/app.css
updated: 2026-08-11
depends_on: [apps-desktop-data-db, apps-desktop-data-progress, apps-desktop-data-schedule, apps-desktop-data-locations, apps-desktop-personalized-plan, apps-desktop-location-manager, apps-desktop-exercise-browser]
status: current
---

## Purpose
Coordinates desktop database readiness, restrained game-inspired shell styling, navigation, first-run setup, saved-plan recovery, and durable workout completion without a router or global store.

## Contract

```ts
export function App(): ReactNode;
```

## Behavior
1. Launch runs `ensureReady()`, then loads categories, exercises, locations, workout completions, and personalization in parallel.
2. The loading and startup-error branches render `SYSTEM BOOTING` and `SYSTEM FAULT` treatments without fake progress or navigation.
3. Ready state derives one `PlayerProgress` with `summarizeProgress(completions, new Date())` and uses it in both the shell HUD and `PlanView`.
4. `locations.length === 0` renders `LocationManager` in `firstRun` mode ahead of every other content branch. No location is created automatically.
5. A ready snapshot whose `profile.locationId` matches no loaded location becomes `regeneration_required` with `reason: "location_missing"` and the first available location.
6. A migrated legacy location routes to `locations` before regeneration so the generated name can be replaced.
7. A ready snapshot exposes `Quest Board`, `Skill Archive`, `Loadouts`, and `Player Profile`; the current button carries `aria-current=\"page\"`.
8. Invalid profile, invalid plan JSON, unsupported generator version, and missing-location recovery preserve their previous routing and reset behavior.
9. Profile submission generates before persistence and replaces the snapshot only after a successful save.
10. Location switching regenerates and saves in place. Location writes reload the location list and surface errors inside `LocationManager`.
11. `completeQuest()` captures one `Date`, builds trusted completion metadata from the saved plan day/profile, calls `claimWorkoutCompletion()`, then reloads completion rows from SQLite.
12. Completion errors update only `completionError`; the saved plan and `PlanView` checklist remain intact.

13. The shell uses a low-contrast charcoal palette, hairline translucent borders, muted blue accents, and restrained state colors. It does not use a grid backdrop, luminous borders, corner brackets, or glow shadows.

## Invariants
- The screen state is exactly `plan`, `library`, `locations`, or `profile`.
- `App` remains the only screen coordinator and completion persistence owner.
- Progress is derived from loaded completion rows and is never stored separately.
- There is no independent active-location or quest-cursor state.
- `ProfileForm` is never rendered with an empty location list.
- Game hierarchy comes from quest, rank, level, XP, and loadout language rather than neon decoration.
- First-run setup and recovery do not expose navigation before a valid snapshot exists.

## Gotchas
- `todayCompletion` uses a local date key while `completedAt` remains an ISO timestamp.
- A duplicate claim still reloads SQLite, so the existing daily row becomes the displayed source of truth.
- Reset deletes the profile and plan only; completion history and earned XP remain.
- End-to-end SQLite verification requires the Tauri desktop runtime.

## Related
[[apps-desktop-data-progress]]
[[apps-desktop-data-db]]
[[apps-desktop-personalized-plan]]
[[apps-desktop-location-manager]]
[[apps-desktop-exercise-browser]]

