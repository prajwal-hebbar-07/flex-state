# Flex State

A single-user, offline, gamified home-workout desktop app. Trainers (re-)defined as "Hunters" pick a goal, a few days a week, and a training ground; the app generates a deterministic weekly plan, tracks completions, and turns sessions into an XP / level / rank / streak progression. No accounts, no cloud, no telemetry — one SQLite file in the app's local data directory.

The repo is a pnpm + Turborepo monorepo with one published library (`flex-state`), one React UI library (`@flex-state/ui`), one shared TS config (`@flex-state/tsconfig`), and one Tauri 2 desktop app (`@flex-state/desktop`) that consumes them.

## Highlights

- **One plan at a time.** A single SQLite row (`id = 1`) holds the profile plus its versioned plan snapshot. Profile and plan move together or not at all.
- **Personalization by location, not by checkbox.** Each "training ground" (a place you actually train) carries its own equipment set and per-place exercise exclusions. The planner runs against the active location, not against a global boolean.
- **Deterministic offline plan generation.** Same profile + same catalog + same locations ⇒ identical plan. The generator version is stamped on every saved plan; older snapshots force a regeneration flow rather than a silent replay.
- **Gamified progression.** Total XP, level, rank (`E` → `S`), current streak, and weekly count are derived from the full ordered history of one row per local completion date. No parallel mutable summary row to drift.
- **Strict runtime guards.** Every persisted value has an `isX` shape guard; one corrupt row never blocks boot.
- **Tauri 2, React 19, TypeScript 7, Vite 8, pnpm 11, Biome 2, Rust 2021.**

## Repository layout

```
.
├── apps/
│   └── desktop/                @flex-state/desktop - Tauri 2 + React 19 desktop app
│       ├── src/                React + TypeScript frontend
│       │   ├── App.tsx         Boot, screen routing, status state machine
│       │   ├── PersonalizedPlan.tsx   Profile form + Quest Board
│       │   ├── ExerciseBrowser.tsx    Catalog filter + detail
│       │   ├── LocationManager.tsx    Create / edit / delete training grounds
│       │   ├── main.tsx
│       │   ├── app.css
│       │   └── data/
│       │       ├── schema.sql        SQLite schema (idempotent on every launch)
│       │       ├── db.ts             Migration, seed, CRUD, completion claims
│       │       ├── exercises.ts      Static exercise + category catalog
│       │       ├── locations.ts      Location type, id normalization, isLocation
│       │       ├── schedule.ts       Deterministic plan generator
│       │       ├── progress.ts       XP, level, rank, streak, week summary
│       │       └── *.test.ts         node:test + assert/strict, run via node --experimental-strip-types
│       ├── src-tauri/          Tauri shell (Rust)
│       │   ├── Cargo.toml      tauri 2.11, tauri-plugin-sql 2 (sqlite), tauri-plugin-log 2
│       │   ├── src/lib.rs      Plugins + one demo `greet` command
│       │   ├── capabilities/default.json   core:default, sql:default, load/execute/select/close
│       │   ├── tauri.conf.json Window 800x600 resizable, identifier dev.flexstate.desktop
│       │   └── icons/
│       ├── index.html
│       ├── vite.config.ts      Port 1420 (Tauri-fixed), es2022, react plugin
│       ├── tsconfig.json       Extends @flex-state/tsconfig/base.json, noEmit
│       └── package.json
├── packages/
│   ├── flex-state/             `flex-state` - framework-agnostic reactive store
│   │   ├── src/index.ts        `createStore<T>(initial)` -> Store<T>
│   │   ├── src/index.test.ts   vitest
│   │   └── package.json        ESM, types: ./dist/index.d.ts
│   ├── ui/                     @flex-state/ui - React 19 primitives over flex-state
│   │   ├── src/index.ts        `Button`, `useStore`
│   │   ├── src/Button.tsx
│   │   ├── src/useStore.ts     `useSyncExternalStore(store.subscribe, store.get, store.get)`
│   │   └── package.json
│   └── tsconfig/               @flex-state/tsconfig - shared base tsconfig
│       ├── base.json           ES2022, bundler resolution, react-jsx, strict, noUncheckedIndexedAccess
│       └── package.json
├── docs/                       Machine-first module docs (one per source file)
│   ├── index.md                Doc manifest
│   ├── decisions.md            Append-only design log
│   └── apps-desktop-*.md       One per frontend module
├── plans/                      Living design notes
├── biome.json                  2-space, 100-col, recommended preset, ignore src-tauri
├── turbo.json                  build/check/test + persistent tauri:dev + tauri:build
├── pnpm-workspace.yaml         apps/*, packages/*; onlyBuiltDependencies: esbuild
├── package.json                name: flex-state-monorepo, packageManager: pnpm@11.20.0, node>=22.12
└── CLAUDE.md                   Repo doc contract (machines-first, fixed skeletons, staleness loop)
```

## Requirements

| Tool    | Version  |
| ------- | -------- |
| Node    | `>=22.12` |
| pnpm    | `11.20.0` |
| Rust    | `>=1.77.2` (Tauri 2 requires it) |
| Tauri   | OS prereqs per https://tauri.app/start/prerequisites/ |

`turbo` and `@biomejs/biome` are dev deps at the root. The `pnpm-workspace.yaml` `minimumReleaseAgeExclude` allows `turbo` to install before its release age elapses; the lockfile already pins the platform-specific tarballs.

## Install

```bash
pnpm install
```

This links the workspace packages. `packages/flex-state/dist/` does not ship in the repo — it is built on demand by Turborepo (`build` task with `dependsOn: ["^build"]`).

## Run the desktop app (dev)

```bash
pnpm dev
```

Equivalent to `turbo run tauri:dev --filter=@flex-state/desktop`. It:

1. Builds `flex-state` and `@flex-state/ui` first (Turbo `^build`).
2. Starts Vite on `http://localhost:1420` (strict port; `server.watch` ignores `src-tauri/`).
3. Invokes `tauri dev`, which spawns the Rust shell that loads the webview against the Vite dev URL.

A first launch seeds the SQLite catalog and creates the schema idempotently. See `apps/desktop/src/data/db.ts:ensureReady()` and `apps/desktop/src/data/schema.sql`.

## Build the desktop app (release bundle)

```bash
pnpm desktop:build
```

Equivalent to `turbo run tauri:build --filter=@flex-state/desktop`. Output goes to `apps/desktop/src-tauri/target/release/bundle/` (Tauri's default layout). `tauri.conf.json`'s `beforeBuildCommand` runs `pnpm build` first so `dist/` is fresh for Tauri's `frontendDist`.

## Run the test suite

```bash
pnpm test
```

Per package:

```bash
pnpm --filter flex-state test
# vitest, runs packages/flex-state/src/index.test.ts

pnpm --filter @flex-state/desktop test
# node --experimental-strip-types --test src/data/*.test.ts
# covers schedule, locations, exercises, progress
```

What is covered:

- `flex-state` — `createStore` notifies, dedupes via `Object.is`, and survives method-detach.
- `schedule` — identical profiles produce equal plans; generator rejects insufficient eligibility.
- `locations` — id normalization and `isLocation` shape guard.
- `progress` — local-date key, XP-per-minute, validation, `summarizeProgress`.
- `exercises` — catalog contract.

## Type check

```bash
pnpm check
```

`@flex-state/ui` and `@flex-state/desktop` run `tsc --noEmit`. `flex-state` only emits on `build`.

## Lint and format

Biome v2 with the recommended rule preset. `src-tauri/` is excluded.

```bash
pnpm lint        # biome check .
pnpm format      # biome check --write .
```

## Architecture

### `packages/flex-state`

A 34-line framework-agnostic reactive store. One module, no React, no DOM.

```ts
import { createStore, type Store } from "flex-state";

const count: Store<number> = createStore(0);
const stop = count.subscribe((value) => console.log(value));
count.set(1);              // logs 1
count.update((v) => v + 1); // logs 2
count.set(2);              // skipped: Object.is equality
stop();
```

Contract:

- `set(next)` is a no-op when `Object.is(next, value)` is true; subscribers are not called.
- `subscribe(run)` returns an unsubscribe function. Detaching methods (`const { get, subscribe } = store`) keeps them usable; the internal `value` is closed over a module-scope `let`, so destructuring does not lose identity.
- Iteration of subscribers is over insertion order; a subscriber that re-subscribes mid-emit is not called twice for the same emission.

### `packages/ui`

Two exports. `Button` is a thin wrapper around `<button type="button" className="fs-button …" />` that passes all `ButtonHTMLAttributes` through. `useStore` is a one-liner over `useSyncExternalStore`:

```ts
import { useStore } from "@flex-state/ui";
import { createStore } from "flex-state";

const counter = createStore(0);
const View = () => {
  const n = useStore(counter);
  return <button onClick={() => counter.set(n + 1)}>{n}</button>;
};
```

The desktop app imports `Button` from `@flex-state/ui` but currently does not use `flex-state` or `useStore` for its own state — state lives in the `App` component and flows down through props. The library exists to be a separable, reusable primitive.

### `apps/desktop` — data layer

The persistence story is five tables, one fixed `id = 1` row for the profile, and one row per local completion date.

`schema.sql` (run idempotently on every launch):

| Table | Purpose | Key |
| --- | --- | --- |
| `categories` | 8 fixed categories (chest, back, shoulders, arms, legs, core, cardio, mobility) | `slug` |
| `exercises` | 117 records re-seeded on every launch from `exercises.ts` (`INSERT OR REPLACE`) | `slug` |
| `locations` | User-created training grounds with their equipment and exclusions | `id` |
| `personalization` | One row, `id = 1`: profile + versioned `plan_json` snapshot | `id = 1` |
| `workout_completions` | One row per local completion date, idempotent claim | `completed_on` |

Seed behavior: `categories` and `exercises` are derived from `data/exercises.ts`; `locations`, `personalization`, and `workout_completions` are user data and are not seeded. Fresh installs start with zero locations; `App` routes the empty state to `LocationManager`, which is also the first-run screen. `migrateLegacyPersonalization` rebuilds the v1 `personalization` table once to drop the v1-only `has_dumbbells` / `excluded_exercise_slugs` columns and seed a single `"My usual place"` location carrying the v1 values; that name is the only app-generated location in the codebase. See `docs/decisions.md` (2026-08-10 — Multi-location equipment profiles).

The `migrate()` step first drops the `exercises` table if a legacy `equipment` column is detected (the column name was repurposed in the v2 split between `requires` and per-location equipment), then re-runs the schema, then attempts `ALTER TABLE … ADD COLUMN` for `video` and `body_focuses` (errors are swallowed because the column already exists post-add). Catalog seed follows.

### `apps/desktop` — personalization planner

`data/schedule.ts` exports `generateWeeklyPlan(profile, catalog, locations)` which returns a discriminated `PlanGenerationResult`. The plan is a `WeeklyPlan` of `WorkoutDay[]` where each day carries a `WorkoutSession` of warmup + main `PrescribedExercise`s. Generator contract:

- `PERSONALIZATION_GENERATOR_VERSION = 3` is stamped on every plan; `loadPersonalization` returns `regeneration_required` when the stored version differs.
- Each `PlanFocus` (`lower | upper | core | full_body | mobility_balance`) draws from a hand-curated candidate pool with `impact: "low" | "high"` and a `prescription`. Each `TrainingGoal` has a focus cycle the planner walks per `daysPerWeek`.
- Eligibility is `equipmentCovers(location.equipment, exercise.requires) && !location.excludedExerciseSlugs.includes(slug)`. Excluded slugs that no longer exist in the catalog surface as `unknown_exclusion` warnings, not hard failures.
- `lowImpactOnly: true` filters the pool to `impact: "low"`. `bodyFocuses` is collected from the form and persisted on the profile but does not yet reorder the focus cycle.
- Durations target `sessionMinutes` (15 / 30 / 45). If the eligible pool is too small to fill the target, the planner surfaces a `duration_target_unmet` or `duration_target_exceeded` warning rather than fabricating exercises.

`resolvePlan(plan, catalog)` joins a `WeeklyPlan` against the live catalog into a `Map<slug, Exercise>` plus a `missing: string[]`. The plan board renders the missing list as a hard "Regenerate" prompt.

### `apps/desktop` — progression

`data/progress.ts` exports pure functions; the desktop UI calls them with the current `WorkoutCompletion[]` and `new Date()`. The unit of progression:

- One local completion date = one row in `workout_completions`. The local date key is `YYYY-MM-DD` from the user's calendar; `localDateKey` builds it, `isLocalDateKey` round-trips it.
- `INSERT OR IGNORE` on the date primary key makes a re-claim a no-op — completing the same day twice grants the same XP once.
- `questXp(targetDurationMin) = targetDurationMin * 10`. Total XP, level, rank, current streak, and weekly count are all recomputed from the ordered history. No second row, no cursor.

Rank ladder (`rankForLevel`): `E` (level 1-9), `D` (10-19), `C` (20-29), `B` (30-39), `A` (40-49), `S` (≥50). Each level needs `levelXpTarget = 1000` XP; `level = floor(totalXp / 1000) + 1`; `levelXp = totalXp % 1000`.

### `apps/desktop` — screen flow

`App` boots in one of three statuses: `loading`, `ready`, or `error`. `ready` carries the initial snapshot of `categories`, `exercises`, `locations`, `personalization`, and `completions`. Screens are: `plan` (the Quest Board), `library` (Skill Archive), `profile` (Player Profile form), `locations` (Loadouts).

The first run has no nav, no plan, and zero locations; the empty state is `LocationManager` itself with the `AWAKENING 01 / 02` header. Saving the first location does not auto-route to the profile; the user clicks `Continue` explicitly. The plan screen picks the next day via `completions.length % plan.days.length`; today's completion, if present, switches the card to a "Quest Cleared" pane.

Saving the profile regenerates and persists in one statement. Switching the location via the plan screen's dropdown re-runs the same flow; the screen is rerouted to the profile form only if generation fails. A saved plan whose `generator_version` is older than the current one, whose `plan_json` fails to parse or fails `isWeeklyPlan`, or whose location was deleted, is recovered by `loadPersonalization` returning `regeneration_required` with the prefilled profile — the same form, relabelled `Regenerate plan`.

### Tauri shell

`src-tauri/src/lib.rs` registers `tauri-plugin-sql` (SQLite) and `tauri-plugin-log` (debug only). The default capability grants `core:default` plus the four `sql:allow-*` permissions used by the JS side (`load`, `execute`, `select`, `close`). One stub `greet` command is registered and not called by the React app. All real persistence goes through `@tauri-apps/plugin-sql`'s `Database.load("sqlite:flex_state.db")`, which writes to the platform's per-app data directory.

## Data contracts at a glance

| Type | Guard | Source |
| --- | --- | --- |
| `Location` | `isLocation` | `apps/desktop/src/data/locations.ts` |
| `PersonalizationProfile` | `isPersonalizationProfile` | `apps/desktop/src/data/schedule.ts` |
| `WeeklyPlan` | `isWeeklyPlan` | `apps/desktop/src/data/schedule.ts` |
| `WorkoutCompletion` | `isWorkoutCompletion` | `apps/desktop/src/data/progress.ts` |

Each guard fails closed: one malformed row is skipped with `console.warn` and never blocks boot.

## Documentation

`docs/` is the canonical reference. The contract (see `CLAUDE.md`) is fixed-skeleton, machine-first, with frontmatter `id` / `source` / `updated` / `depends_on` / `status` and sections in this order: Purpose, Contract, Behavior, Invariants, Gotchas, Related. Every behavior change ships its doc change in the same commit.

Entry point: [`docs/index.md`](docs/index.md). One line per doc, source files derivable from frontmatter, `[id]`-based cross-links.

Staleness check (treat its output as a failing test — see `CLAUDE.md` §8):

```bash
for f in docs/*.md; do
  d=$(grep -m1 '^updated:' "$f" | cut -d' ' -f2)
  for s in $(grep -m1 '^source:' "$f" | cut -d' ' -f2- | tr -d ',' ); do
    [ -f "$s" ] || { echo "DEAD SOURCE $f -> $s"; continue; }
    c=$(git log -1 --format=%ad --date=short -- "$s")
    [ "${c//-/}" -gt "${d//-/}" ] && echo "STALE $f (src $c > doc $d)"
  done
done
```

## Scripts cheat sheet

| Command | What it does |
| --- | --- |
| `pnpm dev` | `turbo run tauri:dev --filter=@flex-state/desktop` |
| `pnpm build` | `turbo run build` (workspace-wide) |
| `pnpm desktop:build` | `turbo run tauri:build --filter=@flex-state/desktop` |
| `pnpm test` | `turbo run test` |
| `pnpm check` | `turbo run check` |
| `pnpm lint` | `biome check .` |
| `pnpm format` | `biome check --write .` |
| `pnpm --filter flex-state build` | `tsc -p tsconfig.json` for the library |
| `pnpm --filter @flex-state/desktop test` | `node --experimental-strip-types --test src/data/*.test.ts` |

## Conventions

- TypeScript `strict` + `noUncheckedIndexedAccess`; `verbatimModuleSyntax`; ES2022; `moduleResolution: "bundler"`.
- The desktop app sets `allowImportingTsExtensions` because the data modules cross-import each other and the test runner is `node --experimental-strip-types`. Vite and `tsc` both accept the `.ts` extension in the source.
- React 19. Tauri 2 webview is a recent Chromium.
- Biome 2 for formatting and lint; the recommended preset; the Rust crate is excluded.
- Decisions are append-only. New ones are appended to `docs/decisions.md` with date, decision, alternatives rejected, and the reason; older entries are never rewritten.
- Every behavior change ships its doc change in the same commit (`CLAUDE.md` §0).

## Known quirks

- `flex-state` (the store) is not used by the desktop app. It is a separable primitive; the desktop app holds its state in the `App` component and threads it through props. The desktop app does use `@flex-state/ui`'s `Button`. Wiring `useStore` into the desktop app is a deliberate future change, not a bug.
- The Rust `greet` command is a Tauri scaffold leftover; it is registered but never called from the frontend. Removal is one line in `lib.rs` plus its `invoke_handler` entry.
- `personalization.body_focuses` is persisted and loaded but the planner does not yet reorder the focus cycle by it; the field is reserved.
- A v1 install migrates in place once. After the first successful launch, the `personalization` table no longer has the legacy columns and the migration guard returns immediately.
- `Location.id` is computed once from the first name given, then never recomputed. Renaming a location does not change its id, and the saved profile keeps referencing it. A name without ASCII alphanumerics (any non-Latin script) gets a random `location-<8 hex>` id; the user-typed name is preserved verbatim.
- The 71 exercises outside the planner's curated pools carry `requires` tags derived from a retired `equipment` field, covering only `bodyweight` and `dumbbells`. The library's equipment filter is approximate for them; the planner never prescribes them.

## License

No license file is present in the repository. Add one before publishing or accepting external contributions.
