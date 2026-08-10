---
title: Multi-Location Equipment Profiles
status: draft (rev 5)
target_repo: /Users/hebbar/chaotic-thoughts/opensource/flex-state
created: 2026-08-10
target_audience: another AI agent implementing the change end to end
---

# Multi-Location Equipment Profiles

## 0a. Rev 5 — one equipment list, ticked per location

Revs 1-4 reused the catalog's `Equipment` union (`bodyweight | dumbbells |
both`) as the per-location kit. Rev 5 replaces it with a **flat list of
equipment kinds** that the user ticks per location:

```ts
export type EquipmentKind = "bodyweight" | "furniture" | "dumbbells" | "floor";
```

| | Label shown to the user |
|---|---|
| `bodyweight` | Bodyweight training |
| `furniture` | A chair, bench, or wall |
| `dumbbells` | Two 5 kg dumbbells |
| `floor` | A proper floor |

An `Exercise` stops carrying one `equipment` value and carries
`requires: EquipmentKind[]` — everything it needs at once. Eligibility becomes
a plain subset check: **you can do an exercise at a place iff that place has
everything it requires.** That deletes the `"both"` special case, and with it
`OwnedEquipment`, `Exclude<Equipment, "both">`, and rev 3's defect §0c.3
entirely.

| Rev 4 | Rev 5 |
|-------|-------|
| `Exercise.equipment: "bodyweight" \| "dumbbells" \| "both"` | `Exercise.requires: EquipmentKind[]` |
| `Location.equipment: OwnedEquipment[]` (2 kinds) | `Location.equipment: EquipmentKind[]` (4 kinds) |
| `equipmentCovers(owned, required)` with a `"both"` branch | `required.every((k) => owned.includes(k))` |
| Catalog untouched (§1.2 non-goal) | All 117 records re-tagged — §4.1a |
| `ExerciseBrowser` untouched | Filter and detail chip follow the new field |

**This reverses a rev 1-4 non-goal.** "Not a new equipment kind in the catalog"
was listed under §1.2 on the grounds that `where` was the only new axis. That
was wrong for the user's actual kit: two of the four things they own
(`furniture`, `floor`) are not represented anywhere in the catalog today, so no
amount of per-location modelling could express "I have a chair here but nowhere
to lie down."

**The cost, stated plainly.** 117 exercise records need a `requires` array, and
the catalog has no furniture/floor information to derive it from. Keyword
matching on the instructions is too noisy to trust — it tags `pull-up` (which
needs a bar nobody owns) as needing nothing, and flags `push-up` as furniture.
So §4.1a splits the job:

- **46 exercises are hand-tagged from a reviewed table.** These are exactly the
  slugs reachable by the planner (`WARMUPS` + every `CANDIDATE_POOLS` entry).
  Nothing else can ever appear in a generated plan, so these 46 are the only
  tags that affect correctness. The table is in §4.1a — **review it before
  approving this plan.**
- **The other 71 are derived mechanically** (`dumbbells` → `[bodyweight,
  dumbbells]`, everything else → `[bodyweight]`) and are library-browse only.
  Their furniture/floor tags are knowingly incomplete; §4.1a says so and the
  doc records it.

**A consequence you should see before approving.** With four kinds, a plausible
location can now starve a focus. Measured against the tags in §4.1a:

| Location kit | `core` pool eligible | Result |
|---|---|---|
| everything | 10 | fine |
| no `floor` | 1 (`wall-crunch`) | **`core` day fails to generate** |
| no `floor`, no `dumbbells` | 1 in `core`, 1 in `upper` | `core` and `upper` both fail |
| no `furniture` | 8 | fine |

The generator needs two eligible exercises per day, so a floorless location
cannot produce a `general_fitness` or `conditioning` plan (both cycles include
`core`). That is arguably correct — you cannot plank without a floor — but it
must not surface as a dead end. §4.5 makes the error name the missing
equipment, and §4.9 reinstates the per-location eligibility summary that rev 3
cut as speculative. It is no longer speculative: it is what stops "the app just
refuses to work at my office".

Everything below is rev 4 plus this change; the rev 3 and rev 4 findings stand
except where this section overrides them.

## 0b. Rev 4 — locations are named by the user, never seeded

Rev 3 shipped two hardcoded locations (`Home`, `Office`) and left renaming to
`LocationManager`. Rev 4 removes the seed entirely: **no location name is ever
invented by the app on a fresh install.**

| Rev 3 | Rev 4 |
|-------|-------|
| `seed()` inserts `Home` and `Office` when the table is empty | Nothing is seeded. The `locations` table starts empty. |
| First run: profile form, location select pre-filled with `Home` | First run: `LocationManager` first, headed "Where do you work out?". The user names their places, then continues to the profile form. |
| `DEFAULT_LOCATIONS`, `DEFAULT_LOCATION_ID` constants | Deleted. |
| Deleting every location resurrects the two defaults next launch | Zero locations routes back to `LocationManager`. No resurrection. |
| v1 migration hangs old equipment/exclusions on the seeded `home` | v1 migration creates one location named `LEGACY_LOCATION_NAME` and routes the user to `LocationManager` to rename it before regenerating. |

This removes a gotcha (§4.3's resurrection floor) and an edge case
(`ProfileForm` rendering a location select with zero options) rather than
adding any. The one place a name is still generated is the v1 migration, which
has real data to preserve and nobody to ask — §3.5 explains why the placeholder
is acceptable there and how the user is immediately walked into renaming it.

Everything below is rev 3 plus this change; the rev 3 findings table stands.

## 0c. Rev 3 — review findings

Rev 2 was checked line by line against the code. Ten defects were found. Each
is listed here with the section that now fixes it. Two were hard blockers: the
feature as specified in rev 2 could not save a single plan, and every v1
install would have landed on the wrong recovery screen.

| # | Severity | Defect in rev 2 | Fixed in |
|---|----------|-----------------|----------|
| 1 | BLOCKER | `savePersonalization` was told to omit `has_dumbbells` and leave it NULL. `schema.sql` declares `has_dumbbells INTEGER NOT NULL` and `excluded_exercise_slugs TEXT NOT NULL`. Every save would fail with a NOT NULL constraint error, on fresh installs too. SQLite cannot drop a NOT NULL constraint with `ALTER TABLE`. | §4.2 |
| 2 | BLOCKER | `loadPersonalization` validates the profile *before* checking `generator_version` (db.ts:196-213). A v1 row has no `locationId`, so the new `isPersonalizationProfile` rejects it and the function returns `invalid_profile`. App.tsx:152 renders that as `DB error` + `Reset profile` — the v1 migration path in rev 2 §3.5 was unreachable. | §4.2, §4.6 |
| 3 | Major | `Location.equipment: Equipment[]` admits `"both"`, which `equipmentCovers` never reads from the location side. `["bodyweight"]` and `["bodyweight","both"]` are behaviourally identical, and the two-checkbox UI in rev 2 §4.9 can never produce `"both"` — so opening and saving a seeded location silently rewrites the stored value. Two encodings per state, one of them unreachable. | §3.2, §4.1 |
| 4 | Major | `activeLocationId` lived in `useState` only, never persisted. Switch location, quit, reopen: the switch is gone. The stale-plan banner, user stories 5-6, and the `LocationPicker` mismatch plumbing all existed only to paper over that dual source of truth. Regeneration is deterministic, offline and sub-millisecond; there is nothing to defer. | §1.1, §3.6, §4.7 |
| 5 | Major | `seedLocations()` used per-row `INSERT OR IGNORE` on every launch, so a deleted location returns on next start. Rev 2's own acceptance checklist said "if the table is empty" — the two contradicted each other. | §4.3 |
| 6 | Major | The test spec was not runnable: `planFor` passed `[homeLocation]` as the only location while three tests referenced `"office"` and `"mobilityLocation"` (which is also an invalid id under rev 2's own `[a-z0-9-]+` rule), so those tests would fail on `location_missing`. Two tests mutated a shared `const` location, making the determinism test order-dependent. | §4.10 |
| 7 | Moderate | `location_missing` was specified three times over (a `PlanGenerationIssue`, a `PersonalizationLoadResult` kind, a `Screen`, a `Status` variant, a bespoke recovery UI) for a state that `deleteLocation`'s own guard makes unreachable. `loadPersonalization` was also told to check the id against "any seeded location" without being given the location list. | §3.4, §4.6, §4.7 |
| 8 | Moderate | `PlanView`'s Constraints tile also renders `· Low impact` (PersonalizedPlan.tsx:430). Replacing the whole line with the location name silently drops it. | §4.8 |
| 9 | Minor | §2.1 claimed the single `equipment: "both"` record is `tactical-jack`. It is `reverse-lunge` (exercises.ts:874); `tactical-jack` is `bodyweight`. The eligibility rule in §3.3 is unaffected and stays as written. | §2.1 |
| 10 | Minor | Speculative scope with no user story behind it: the "n exercises eligible / categories with zero eligible" summary in `LocationManager`; the checklist's "`isPersonalizationProfile` rejects `hasDumbbells` if present" (the current validator ignores extra keys, and v1 detection is by version). Location ids were also never declared immutable, so a rename would orphan the profile. | §4.1, §4.9, §6 |

Net effect of rev 3: two new files instead of three, no new `Screen` values, no
new `PersonalizationLoadResult` kinds, no migration dialog, no stale-plan
banner, and a schema that ends up identical on fresh and upgraded installs.

## 1. Problem statement

Today the desktop app models equipment with one boolean: `hasDumbbells`. That is enough to express "I have one pair of 5 kg dumbbells" or "I have nothing," but it cannot express the real use case the user actually has:

> "I work out in **two places** (e.g. home and a small office, or a gym and a park). Each place has a **different kit of equipment**. When I am in a place, I want to do exercises that are limited to what is available there, without having to rebuild my profile every time I switch."

The current model forces the user to either:

- check `hasDumbbells` for the "full kit" place and then exclude every dumbbell-only exercise when they are in the bodyweight-only place, or
- maintain two separate profiles, which the app does not support (single fixed row `id = 1` in the `personalization` table).

Both paths are wrong: the first is tedious and brittle (a new dumbbell exercise lands in the dumbbell-only place's plan), the second is impossible with the current schema.

### 1.1 User stories (acceptance)

1. **Name your own locations.** On first run the app asks the user where they work out before anything else. **The app never invents a location name.** The user types each name (`Garage`, `Nani's house`, `the park by the station` — whatever they call it), ticks the equipment there, and continues. Names are editable forever after.
1b. **One equipment list, ticked per place.** The four equipment kinds (§0a) are a single fixed list shown identically at every location. The user ticks which of them that place has. The same checkbox set appears for each location; nothing about the list is per-location except the ticks.
2. **Per-location exercise exclusions.** Within a location, the user can exclude individual exercises by name, exactly like the current global exclusion list.
3. **Switch location.** The `My Plan` screen has a location selector. Switching it regenerates and saves the plan against the selected location's equipment and exclusions, in place, without leaving the screen.
4. **Per-location plan.** One plan snapshot is stored at a time, bound to the location it was generated for.
5. **Validation.** A location cannot be deleted while the saved plan references it. The delete button for that location is disabled with the reason shown.
6. **Empty state.** With zero locations — first run, or after deleting them all — the app shows `LocationManager` and nothing else. There is no plan and no profile form until at least one location exists, and no placeholder location is created to fill the gap.
7. **Offline-only.** No network, no accounts, no cloud sync, no AI service. Everything is local SQLite on the same installation. This matches the existing decision in `docs/decisions.md` (2026-08-09).

Story 1 of rev 2 ("on first run the user can create one or more named
locations", alongside two seeded ones) is replaced by rev 4's story 1: the app
seeds nothing and asks. Stories 5-7 of rev 2 ("switch without regenerating",
the stale-plan banner, the missing-location recovery screen) are **removed**. See §0 defects 4 and 7:
switching regenerates immediately, so a plan can never be stale relative to the
selected location, and the delete guard makes the missing-location state
unreachable through the UI. The residual (hand-edited DB) case is handled by a
fallback, not a screen — §4.6.

### 1.2 Non-goals

- Not a multi-user / multi-profile feature. The current product contract is one installation, one user.
- Not a per-day-location feature (e.g. "Monday at home, Tuesday at gym"). A future feature, not this one.
- Not a sync feature. Local-only.
- Not a per-location plan history. One plan snapshot, as today.
- Not a fifth equipment kind. The list is exactly the four things the user owns (§0a). Adding one later is a one-line change to `EQUIPMENT_KINDS` plus re-tagging whatever needs it — deliberately cheap, but not done now. Notably absent: a pull-up bar, which several catalog exercises (`pull-up`, `chin-up`, `inverted-row`, `handstand-hold`) actually need. Those stay tagged `[bodyweight]` and are library-only, never planner-reachable, so no generated plan can prescribe them. Recorded as a known gap in §4.1a.

**Reversed in rev 5** (was a non-goal in revs 1-4): the exercise catalog data
model *does* change. `Exercise.equipment` becomes `Exercise.requires:
EquipmentKind[]`, and all 117 records are re-tagged. See §0a for why the
earlier framing was wrong and §4.1a for the cost.

## 2. Codebase facts the implementer must respect

These are the actual invariants, files, and contracts in the repo, verified
against the source. Every step below has to land inside this shape.

### 2.1 Existing data model

`apps/desktop/src/data/exercises.ts` already defines:

```ts
export type Equipment = "bodyweight" | "dumbbells" | "both";
```

Each `Exercise` has a single `equipment` field. The catalog is 117 records:
`bodyweight: 82`, `dumbbells: 34`, `both: 1`. The single `both` record is
`reverse-lunge` (exercises.ts:874), which appears in the `lower` and
`full_body` candidate pools. `tactical-jack` is `bodyweight`.

Verify with:

```bash
cd apps/desktop/src/data
grep -c 'equipment: "bodyweight"' exercises.ts   # 82
grep -c 'equipment: "dumbbells"' exercises.ts    # 34
grep -B6 'equipment: "both"' exercises.ts | grep 'slug:'  # slug: "reverse-lunge"
```

Under the current `isEligible`, `both` is always eligible (the check is
`profile.hasDumbbells || exercise.equipment !== "dumbbells"`).

**Rev 5 replaces this whole field.** `Equipment` and its three values are
deleted; `Exercise.requires: EquipmentKind[]` takes over (§0a, §4.1a). The
mapping used for the 71 library-only records is:

| old `equipment` | count | derived `requires` |
|---|---|---|
| `"bodyweight"` | 82 | `["bodyweight"]` |
| `"dumbbells"` | 34 | `["bodyweight", "dumbbells"]` |
| `"both"` | 1 | `["bodyweight"]` — `reverse-lunge` is doable unloaded |

`"both"` needs no successor: an exercise doable either way simply does not
require dumbbells. The 46 planner-reachable records override this mapping with
hand-written tags (§4.1a).

There is currently no concept of "needs a chair" or "needs a floor" anywhere in
the catalog — that is precisely the gap rev 5 closes, and why the tags have to
be written rather than derived.

### 2.2 Existing personalization shape

`apps/desktop/src/data/schedule.ts:11-19`:

```ts
export interface PersonalizationProfile {
  primaryGoal: TrainingGoal;
  experience: Difficulty;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
  hasDumbbells: boolean;
  lowImpactOnly: boolean;
  excludedExerciseSlugs: string[];
}
```

`PersonalizationProfile` is the source of truth used by the generator. It is validated by `isPersonalizationProfile()` (schedule.ts:234-257), and the eligibility check in `isEligible()` (schedule.ts:387-396) uses `profile.hasDumbbells` to drop `dumbbells`-only exercises.

`PERSONALIZATION_GENERATOR_VERSION` is `1 as const` (schedule.ts:3). It is
load-bearing in three places, not one:

1. `isPersonalizationProfile` — no, it does not read it.
2. `isWeeklyPlan` (schedule.ts:342) hard-compares `plan.generatorVersion` to it.
3. `savePersonalization` (db.ts:245) throws if the plan's version differs.
4. `WeeklyPlan.generatorVersion` and `SavedPersonalization.generatorVersion` are typed as `typeof PERSONALIZATION_GENERATOR_VERSION`.

Bumping it to `2` therefore also makes every persisted v1 `plan_json` fail
`isWeeklyPlan`. That is intended and harmless — the version check in
`loadPersonalization` fires first (§4.6).

### 2.3 Existing persistence

`apps/desktop/src/data/schema.sql` defines one row in the `personalization` table with `id = 1`. Two of its columns are `NOT NULL` with no default:

```sql
has_dumbbells INTEGER NOT NULL CHECK (has_dumbbells IN (0, 1)),
excluded_exercise_slugs TEXT NOT NULL,
```

This is defect §0c.1. SQLite has no `ALTER TABLE ... DROP CONSTRAINT` and no
`ALTER TABLE ... DROP COLUMN` on a table with a `CHECK` referencing that
column, so the v2 writer cannot simply stop writing them. §4.2 rebuilds the
table once.

`db.ts` reads/writes the row via `loadPersonalization()` and `savePersonalization()`. The current `App` flow:

1. Launch: `ensureReady()` → `Promise.all([listCategories, listExercises, loadPersonalization])`.
2. `personalization.kind === "ready"` opens the `plan` screen.
3. `ProfileForm` collects fields; `submitProfile` regenerates, then saves one row.
4. `clearPersonalization` deletes the one row.

`db.ts` `migrate()` (db.ts:23-31) already uses the `ALTER TABLE … .catch(() => {})` pattern for the `video` column. §4.2 reuses that same idiom to *detect* the legacy schema.

### 2.4 Existing UI

`apps/desktop/src/App.tsx` has three screens: `plan | library | profile`. Navigation: `My Plan`, `Exercise Library`, `Edit Profile`. The nav is rendered only when `personalization.kind === "ready"` (App.tsx:141).

`apps/desktop/src/PersonalizedPlan.tsx`:
- `ProfileForm` is a controlled form for the profile, with a checkbox for `hasDumbbells` (lines 267-274) and a global `excludedExerciseSlugs` fieldset (lines 284-351).
- `PlanView` reads `saved` and renders one card per `WorkoutDay`. The `Constraints` summary tile is `{profile.hasDumbbells ? "Dumbbells available" : "Bodyweight only"}{profile.lowImpactOnly ? " · Low impact" : ""}` (lines 429-430). Both halves matter — see §0c.8.
- `onEdit` is `() => openProfile("save")`, `onRegenerate` is `() => openProfile("regenerate")` (App.tsx:219-220).
- `ProfileForm` already accepts `initialProfile?: PersonalizationProfile` as optional (line 20), and App passes nothing for the `none` case. No signature change is needed there.

`apps/desktop/src/ExerciseBrowser.tsx` supports an equipment filter (matches `equipment === filter || equipment === "both"`) and shows the value in the detail pane.

**Rev 5 changes this file** (revs 1-4 listed it as untouched). The field it
filters on no longer exists. Minimum change: the filter's options become
`EQUIPMENT_KINDS` with `EQUIPMENT_LABELS`, and the predicate becomes
`exercise.requires.includes(filter)`; the detail chip renders
`exercise.requires.map((k) => EQUIPMENT_LABELS[k]).join(" · ")`. Do **not**
extend it into a location-aware view — build `LocationManager` separately.

### 2.5 Existing tests

`apps/desktop/src/data/schedule.test.ts` has five `test(...)` blocks. The test
script is `node --experimental-strip-types --test src/data/*.test.ts`, so any
new `*.test.ts` under `src/data/` is picked up with no config change.

- `identical profiles generate identical plan snapshots` — asserts `deepStrictEqual` across two calls. Any shared mutable fixture breaks it.
- `hard eligibility filters are never relaxed` — overrides `hasDumbbells: false` and `excludedExerciseSlugs: ["push-up"]`, asserts `exercise.equipment !== "dumbbells"`.
- `goals repeat their exact focus cycles` — pure catalog-of-focuses test, shape-independent.
- `generation fails when a focus has fewer than two eligible exercises` — a long `excludedExerciseSlugs` list forces `mobility_balance` under `mobility_balance` to fail.
- `catalog gaps, stale exclusions, prescriptions, and duration are explicit` — `EXERCISES.filter(e => e.slug !== "tactical-jack")` for `missing_catalog_exercise`, then `excludedExerciseSlugs: ["retired-exercise"]` for the unknown-exclusion warning, then `formatPrescription` / `sessionDurationSec`.

`apps/desktop/src/data/exercises.test.ts` is independent of personalization and is unaffected.

### 2.6 Shared `flex-state` package

`packages/flex-state/src/index.ts` exports a tiny `createStore<T>` reactive store (no exercise-related types). The desktop app depends on it as `flex-state: workspace:*` but does not import any value from it. Keep the new types in `apps/desktop/src/data/` — that matches where `PersonalizationProfile` and `WeeklyPlan` already live.

Do **not** introduce a `useStore`/`createStore` global for this feature. There
is no cross-tree state to share: after §4.7 the location lives in
`saved.profile.locationId` and the location list is one `useState` in `App`.

### 2.7 Documentation rules

`CLAUDE.md` codifies: every behavior change ships a doc change in the same commit, doc frontmatter (`id`, `source`, `updated`, `depends_on`) is load-bearing, and a doc whose source is newer than its `updated` is stale and untrusted. §4.11 lists the doc work.

## 3. Design

### 3.1 Conceptual model

Introduce a first-class `Location` entity: a named place with an owned-equipment set and a per-location exclusion list. A `PersonalizationProfile` references exactly one `Location`, and that reference **is** the active location — there is no second copy of it in component state.

```
Location {
  id: string                        // immutable slug derived from the user's first name for it
  name: string                      // user-typed label, renameable, never app-generated
  equipment: EquipmentKind[]        // non-empty subset of EQUIPMENT_KINDS
  excludedExerciseSlugs: string[]   // per-location exclusions
  displayOrder: number
}

PersonalizationProfile {
  primaryGoal: TrainingGoal
  experience: Difficulty
  daysPerWeek: DaysPerWeek
  sessionMinutes: SessionMinutes
  lowImpactOnly: boolean
  locationId: string                // FK to Location.id
  // hasDumbbells REMOVED           -> derived from the location's equipment
  // excludedExerciseSlugs REMOVED  -> moved to Location
}
```

`PersonalizationProfile` keeps only per-week, per-training-shape fields.
Anything that varies by place is on the `Location`.

**`Location.id` is immutable after creation.** It is generated from the name at
create time via `normalizeLocationId` and never recomputed on rename — the
saved profile references it, and recomputing would orphan the plan. A
consequence worth accepting: rename `Garage` to `Shed` and the id stays
`garage`. The id is never shown in the UI, so this is invisible to the user;
it appears only in the DB and in doc examples.

**No name is ever invented.** `locations` starts empty and stays empty until
the user types something. The single exception is the v1 migration, which has
equipment and exclusions to preserve and no user to ask at that moment — §3.5.

### 3.2 One vocabulary for both sides

Revs 1-4 had two vocabularies: a *requirement* union on the exercise
(`bodyweight | dumbbells | both`, where `"both"` meant "either will do") and an
*ownership* array on the location. They needed a translation function with a
special case, and `"both"` was meaningless on the ownership side — two
encodings per state, one unreachable from the UI (defect §0c.3).

Rev 5 uses **one** vocabulary on both sides:

```ts
// apps/desktop/src/data/exercises.ts — catalog vocabulary lives with the catalog
export type EquipmentKind = "bodyweight" | "furniture" | "dumbbells" | "floor";

export const EQUIPMENT_KINDS: EquipmentKind[] = [
  "bodyweight",
  "furniture",
  "dumbbells",
  "floor",
];

export const EQUIPMENT_LABELS: Record<EquipmentKind, string> = {
  bodyweight: "Bodyweight training",
  furniture: "A chair, bench, or wall",
  dumbbells: "Two 5 kg dumbbells",
  floor: "A proper floor",
};
```

An exercise lists what it needs (`requires`); a location lists what it has
(`equipment`). Both are `EquipmentKind[]`, so eligibility is a subset test with
no special cases (§3.3). `EQUIPMENT_KINDS` is the render order for every
checkbox list and filter — never hardcode the four strings a second time.

Three notes on the vocabulary itself:

- **`furniture` covers walls.** `wall-sit` and `wall-crunch` need a wall, which
  is not furniture in plain English, and the user's list has no wall entry.
  Rather than invent a fifth kind they did not ask for, the label reads "A
  chair, bench, or wall". If a place has a wall but no chair, tick it. **Flag
  for review:** if this conflation is wrong, the fix is a fifth kind and a
  re-tag of two exercises.
- **`bodyweight` is effectively always on.** Every exercise requires it and
  every usable location has it, so it never changes an outcome. It is kept
  because the user named it, because the checklist reads wrong without it, and
  because unticking it produces a coherent (empty) location rather than an
  undefined one.
- **`dumbbells` means the specific pair.** The label says "Two 5 kg dumbbells"
  because that is the kit; the planner's existing notes already say "Hold a
  5 kg dumbbell at chest". No weight is modelled as a number.

The v1 equivalences that the migration and tests rely on:

| v1 | v2 |
|----|-----|
| `hasDumbbells: false` | `equipment: ["bodyweight", "furniture", "floor"]` |
| `hasDumbbells: true` | `equipment: ["bodyweight", "furniture", "dumbbells", "floor"]` |

The v1 boolean said nothing about furniture or floor, so the migration assumes
the user had both — the permissive reading, which preserves every exercise that
was eligible before. §4.2 implements it and the user corrects it on the rename
screen they are already routed to.

**Storage note:** SQLite cannot `CHECK`-constrain the contents of a JSON array.
`isLocation` in JS is the only line of defense. Call it from `upsertLocation`
(throwing), from `listLocations` (skipping and logging a malformed row rather
than crashing the app), and from `LocationManager`'s submit handler.

`isLocation` requires `equipment` to be non-empty. A location with no equipment
makes every exercise ineligible, which the generator would only surface as
`insufficient_eligible_exercises` at save time — reject it at the form instead.
This is a strictly weaker rule than rev 2's ("must include `bodyweight`"):
`["dumbbells"]` is legal and merely unusual. With four kinds, partial kits are
now normal rather than degenerate, and some of them genuinely cannot produce a
plan (§0a) — which is why §4.9 shows the eligibility count per location before
the user finds out at generation time.

### 3.3 Eligibility rules

`isEligible(candidate, exercise, profile, location, exclusions)` enforces:

1. **Difficulty**: `difficulty(exercise) <= experience(profile)`. Unchanged.
2. **Equipment**: `equipmentCovers(location.equipment, exercise.requires)` — a
   plain subset test, no special cases:

   ```ts
   export function equipmentCovers(owned: EquipmentKind[], required: EquipmentKind[]): boolean {
     return required.every((kind) => owned.includes(kind));
   }
   ```

3. **Impact**: `!profile.lowImpactOnly || candidate.impact === "low"`. Unchanged.
4. **Exclusion**: `!exclusions.has(candidate.slug)`, where `exclusions` is `new Set(location.excludedExerciseSlugs)`.

Under the §3.2 equivalence table this is a strict generalization of the v1
check: a location with all four kinds reproduces `hasDumbbells: true` exactly,
and one with everything but `dumbbells` reproduces `hasDumbbells: false`
exactly. §4.10 asserts both directions — that is the regression test for the
whole re-tag.

Note the empty-requirement case: `[].every(...)` is `true`, so an exercise
requiring nothing is eligible everywhere. No planner exercise has an empty
`requires` (all 46 list at least `bodyweight`), but the rule is stated because
it is the reason `"both"` needs no successor.

### 3.4 Plan snapshot and the missing-location case

`WeeklyPlan` does not grow. It is already a snapshot of slugs and
prescriptions, and `SavedPersonalization.profile.locationId` binds it to its
location.

`location_missing` is handled at exactly **two** levels, not five:

1. `generateWeeklyPlan` returns a `location_missing` issue when
   `profile.locationId` resolves to nothing in the passed `locations` array.
   This is a cheap total-function guard, not a user-facing flow.
2. `App`, after loading, rewrites an unresolvable `locationId` to
   `locations[0].id` and downgrades the load result to `regeneration_required`
   with a new `reason: "location_missing"`. The **existing**
   `regeneration_required` branch (App.tsx:166-190) then renders the prefilled
   form with "Regenerate plan". No new `Screen`, no new `Status` variant, no
   new `PersonalizationLoadResult` kind, no bespoke recovery component.

`loadPersonalization` itself does **not** check the location: it has no access
to the location list, and giving it one would couple two independent reads
(defect §0c.7).

Through the UI this state is unreachable anyway — `deleteLocation` refuses to
delete the location the saved profile references (§4.6). It exists for a
hand-edited or partially-restored database.

### 3.5 Generator version bump and the v1 migration

`PERSONALIZATION_GENERATOR_VERSION` goes from `1` to `2`. A v1 row is
structurally incompatible with the v2 profile, so it cannot be loaded as-is.

Rev 2 proposed a one-time migration **dialog** in which the user names a
default location. That is dropped: it preserved only equipment and exclusions
while rev 2's own §4.6 discarded the rest of the profile
(`profile: undefined`), so the user re-typed goal, experience, days and minutes
anyway. Net preserved information: near zero, for a whole screen.

The v1 → v2 move is instead done in SQL, once, inside `migrate()` (§4.2). It
carries **everything** across with no dialog and no data loss:

- the four scalar profile fields stay in their columns untouched,
- one `Location` row is created carrying `has_dumbbells` as its `equipment`
  array and `excluded_exercise_slugs` as its exclusion list,
- `location_id` points at that row,
- `generator_version` is left at `1`, so `loadPersonalization` returns
  `regeneration_required` and the user confirms on the existing prefilled form.

**The one generated name in the whole design.** That migrated row needs a
`name` before the user has typed one, because the equipment and exclusions have
nowhere else to live and `name` is `NOT NULL`. It gets
`LEGACY_LOCATION_NAME = "My usual place"`. To keep this from being a name the
user is stuck with, App routes a v1 install to `LocationManager` **before** the
regeneration form (§4.7), exactly like first run, with the row already
selected and its name focused. The placeholder therefore exists on screen for
as long as it takes to type over it, on exactly one launch of one install.

The alternative — preserve nothing from v1, start the user at an empty
`LocationManager` and let them re-tick their exclusions — was considered and
rejected as worse: it trades a five-second placeholder for retyping a list.
If the exclusion list turns out to be empty on the real v1 database, the two
options are equivalent and either is fine.

Append to `docs/decisions.md`:

```
## 2026-08-10 - Multi-location equipment profiles

Decision: Replace the catalog's `Equipment` union
(`bodyweight | dumbbells | both`) with a flat `EquipmentKind` list
(`bodyweight`, `furniture`, `dumbbells`, `floor`) used on both sides:
an exercise carries `requires: EquipmentKind[]`, a location carries
`equipment: EquipmentKind[]`, and eligibility is the subset test
`required.every((k) => owned.includes(k))`. All 117 catalog records are
re-tagged — the 46 planner-reachable slugs by hand, the rest derived
from the old field. Also replace the boolean `hasDumbbells` and the
global `excludedExerciseSlugs` on `PersonalizationProfile` with a
first-class `Location` entity (immutable id, user-typed name,
per-location exclusions). A profile references exactly one `Location`,
and that reference is the only copy of "which place am I in" — no
parallel component state. `isEligible` enforces the location's
equipment instead of the boolean. No location is seeded: zero locations
routes to `LocationManager`, which is therefore also the first-run
screen. Generator version bumps 1 to 2; the `personalization` table is
rebuilt once in `migrate()` to drop the two NOT NULL legacy columns and
carry the v1 values onto a location created by that migration.

Alternative rejected:
- Keep `hasDumbbells` and add a parallel `hasPullUpBar` boolean per
  place. The boolean cartesian product grows linearly with equipment
  kinds and cannot model "I have a chair but no bars."
- Store an equipment array on the profile directly. Hides the "this is
  a place" concept from the user, the form, and the recovery flow.
- `Location.equipment: Equipment[]` reusing the old catalog union whole.
  `"both"` is a requirement value, not an ownership value; admitting it
  gives two encodings per state and one of them is unreachable from the
  checkbox UI. Superseded entirely by the single `EquipmentKind`
  vocabulary, which has no `"both"` to admit.
- Keeping `Exercise.equipment` for display and adding `requires`
  alongside it for eligibility. Two fields describing the same thing
  drift; the browse filter would have kept saying "bodyweight" for an
  exercise the planner knows needs a floor.
- Deriving furniture/floor tags by keyword-matching the instructions.
  Measured on the real catalog it tags `push-up` as needing furniture
  and `pull-up` as needing nothing. The 46 slugs that can reach a plan
  are hand-tagged instead; the other 71 are library-only and their
  tags are documented as approximate.
- A fifth `wall` kind. `wall-sit` and `wall-crunch` are the only
  exercises that would use it, and the user's kit list has four items.
  Folded into `furniture`, labelled "A chair, bench, or wall".
- An in-memory `activeLocationId` separate from the saved profile, with
  a stale-plan banner reconciling the two. The banner exists only to
  describe a divergence the design itself creates; the switch is also
  lost on quit. Generation is deterministic and offline, so switching
  regenerates in place instead.
- A one-time migration dialog for v1 rows. It preserved less than the
  SQL move does, and required a screen the user sees exactly once.
- Seeding `Home` and `Office` and relying on rename. The app does not
  know where the user trains, and a placeholder that is never corrected
  becomes a label the user reads as the app's opinion. The only
  generated name left is the v1 migration's, and that path lands on the
  rename field before anything else.
- Multi-snapshot plans per location. Out of scope; the product
  contract is one plan at a time.
- A nameless pair of `{equipment, exclusions}` on the profile. Half the
  schema, but forces the user to remember "is index 0 home or office?"
  and cannot grow to three places without another redesign.

Why: The user has two distinct places with different equipment. A
boolean cannot represent two places, and a per-place exclusion list
cannot be a global list. The eligibility check is a strict
generalization of the v1 check, so the existing catalog and test
expectations remain valid.
```

### 3.6 UI changes (summary)

- **`LocationManager`** (new file): list, create, rename, delete locations; edit equipment checkboxes and per-location exclusions. The delete button is disabled, with the reason shown, for the location the saved profile references. **It is also the first-run screen**: with zero locations it renders a "Where do you work out?" heading, the create form open and focused, and a `Continue` button that is disabled until one location exists.
- **`ProfileForm`** (changed): drop the `hasDumbbells` checkbox and the global exclusion fieldset. Add a `Location` `<select>` bound to `profile.locationId`, plus a `Manage locations` button.
- **`PlanView`** (changed): add a `Location` `<select>` in the header that switches location and regenerates in place; extend the `Constraints` tile with the location name while **keeping** `· Low impact`.
- **`App`** (changed): add `locations: Location[]` to the ready `Status`, a `Locations` nav button, a `"locations"` screen, and a `switchLocation` action. `locations.length === 0` renders `LocationManager` ahead of every other branch. No `activeLocationId` state, no `"location_missing"` screen, no seeding.
- **No `LocationPicker` component.** A bare `<select>` inside `PlanView` is the whole thing; a two-prop wrapper around one native element is not worth a file (`ProfileForm` already inlines four such selects).
- **`ExerciseBrowser`** (unchanged): its equipment filter is a one-shot browse filter, unrelated.

## 4. Implementation steps

Data layer first (the UI cannot land until the persisted shape is settled),
then generator, then UI, then docs.

### 4.1 Step 1 — Add `Location` types

**File**: `apps/desktop/src/data/locations.ts` (new).

`EquipmentKind`, `EQUIPMENT_KINDS` and `EQUIPMENT_LABELS` live in
`exercises.ts` (§3.2, §4.1a) — they are catalog vocabulary, and putting them
here would make `exercises.ts` import from `locations.ts` to type its own
records.

```ts
import { type EquipmentKind, EQUIPMENT_KINDS } from "./exercises";

export interface Location {
  id: string;                      // immutable slug, [a-z0-9-]+
  name: string;
  equipment: EquipmentKind[];      // non-empty, unique
  excludedExerciseSlugs: string[];
  displayOrder: number;
}

// The only app-generated location name in the codebase. Used once, by the v1
// migration in db.ts, which has equipment and exclusions to preserve and no
// user to ask. Fresh installs seed nothing — the user names every location.
export const LEGACY_LOCATION_NAME = "My usual place";

export function equipmentCovers(owned: EquipmentKind[], required: EquipmentKind[]): boolean {
  return required.every((kind) => owned.includes(kind));
}

export function normalizeLocationId(raw: string): string;
export function isLocation(value: unknown): value is Location;
```

`normalizeLocationId`: lowercase, trim, collapse any run of non-`[a-z0-9]` into
a single `-`, strip leading/trailing `-`. Returns `""` when the input has no
ASCII alphanumerics at all.

That empty return is **not** a form error, and the user must never be told
their name is invalid. `[a-z0-9]` excludes every non-Latin script, so `Дом`,
`家`, and `🏠` all normalize to `""` while being perfectly good names. Ids are
internal and never shown, so the caller falls back to a generated one:

```ts
const id = normalizeLocationId(name) || `location-${crypto.randomUUID().slice(0, 8)}`;
```

`crypto.randomUUID` is available in the Tauri webview. The result still
satisfies the `isLocation` id pattern. The only rejected name is one that is
empty or all whitespace.

`isLocation` enforces:
- `id` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`.
- `name` is a string with non-empty `trim()`.
- `equipment` is a non-empty array of unique `EquipmentKind` values. Membership is `EQUIPMENT_KINDS.includes(v)` — do not hardcode the four strings a second time.
- `excludedExerciseSlugs` is an array of unique strings.
- `displayOrder` is a non-negative integer.

There is no `DEFAULT_LOCATIONS` array and no `DEFAULT_LOCATION_ID`. Rev 3 had
both; rev 4 deletes them along with the seed (§4.3). The v1 migration derives
its one id with `normalizeLocationId(LEGACY_LOCATION_NAME)` rather than
hardcoding a second string that could drift from the name.

### 4.1a Step 1a — Re-tag the exercise catalog

**File**: `apps/desktop/src/data/exercises.ts`.

Add `EquipmentKind`, `EQUIPMENT_KINDS`, `EQUIPMENT_LABELS` (§3.2). Delete
`export type Equipment`. Replace `equipment: Equipment` on the `Exercise`
interface with `requires: EquipmentKind[]`, and update `isExercise` (if
present) plus `exercises.test.ts` to match.

Then tag all 117 records, in two passes.

**Pass 1 — the 46 planner-reachable slugs, by hand.** These are the only tags
that can change a generated plan. Extract the list mechanically to confirm it
has not drifted:

```bash
cd apps/desktop/src/data
node -e 'const s=require("fs").readFileSync("schedule.ts","utf8");
console.log([...new Set([...s.matchAll(/\b(?:low|high)\(\n?\s*"([a-z0-9-]+)"/g)].map(m=>m[1]))].length)'
# 46
```

**Review this table before approving the plan.** `bodyweight` is on every row
and omitted for brevity — read each cell as `["bodyweight", ...listed]`.

| slug | + furniture | + dumbbells | + floor | why |
|---|---|---|---|---|
| `tactical-jack` | | | | standing |
| `high-knees` | | | | standing |
| `tactical-march` | | | | standing |
| `sunrise-flow` | | | | standing |
| `tai-chi-arm-swings` | | | | standing |
| `bodyweight-squat` | | | | standing |
| `reverse-lunge` | | | | standing; was `"both"` |
| `squat-pulse` | | | | standing |
| `military-lunge` | | | | standing |
| `squat-side-step` | | | | standing |
| `tai-chi-chest-opening` | | | | standing |
| `parting-wild-horses-mane` | | | | standing |
| `breath-body-connection` | | | | standing |
| `grasp-sparrows-tail` | | | | standing |
| `embrace-the-moon` | | | | standing |
| `rooted-stance` | | | | standing |
| `wall-sit` | yes | | | back against a wall |
| `wall-crunch` | yes | | | feet on a wall |
| `bench-dip` | yes | | | hands on a chair or bench |
| `seated-cat-cow` | yes | | | seated on a chair |
| `chair-downward-dog` | yes | | | hands on a chair |
| `seated-knee-hug` | yes | | | seated on a chair |
| `chair-assisted-quadriceps-stretch` | yes | | | holds a chair for balance |
| `calf-raise` | | yes | | catalog tags it `dumbbells` today |
| `goblet-squat` | | yes | | |
| `dumbbell-bent-over-row` | | yes | | |
| `dumbbell-overhead-press` | | yes | | |
| `dumbbell-bicep-curl` | | yes | | |
| `lateral-raise` | | yes | | |
| `dumbbell-tricep-extension` | | yes | | |
| `single-arm-dumbbell-row` | yes | yes | | notes say "support hand/knee on a bench" |
| `push-up` | | | yes | prone |
| `diamond-push-up` | | | yes | prone |
| `low-to-high-plank` | | | yes | prone |
| `front-plank` | | | yes | prone |
| `plank-shoulder-tap` | | | yes | prone |
| `plank-knee-to-elbow` | | | yes | prone |
| `side-plank` | | | yes | on one side |
| `mountain-climber` | | | yes | prone |
| `bear-crawl` | | | yes | quadruped, needs floor space |
| `superman` | | | yes | prone |
| `sit-up` | | | yes | supine |
| `bicycle-crunch` | | | yes | supine |
| `oblique-crunch` | | | yes | supine |
| `static-glute-bridge` | | | yes | supine |
| `plyo-single-leg-glute-bridge` | | | yes | supine |

Judgment calls worth a second look:

- `calf-raise` is tagged `dumbbells` in the catalog today, so it is tagged
  `dumbbells` here to preserve behavior exactly. It is doable unloaded; if you
  want it available everywhere, drop `dumbbells` from this row — but that is a
  catalog correction, not part of this change, and it will make the v1
  equivalence test in §4.10 fail until the expected plan is updated.
- `bear-crawl` needs floor *space* more than a floor surface. Tagged `floor`
  because there is no space kind and crawling on a hard bare floor is the same
  requirement in practice.
- Every mobility exercise that is not chair-assisted is standing, so a
  `mobility_balance` goal works at a floorless, furnitureless location. That is
  deliberate: it is the one goal that always generates.

**Pass 2 — the other 71, mechanically.** Apply the §2.1 mapping:
`"dumbbells"` → `["bodyweight", "dumbbells"]`, everything else →
`["bodyweight"]`. These records are library-browse only — `resolvePlan` can
render them if an old saved plan names one, but the generator can never select
one.

Their furniture/floor tags are therefore **knowingly incomplete**: `pull-up`
needs a bar, `decline-push-up` needs both a floor and something to raise the
feet, `dumbbell-bench-press` needs a bench. None of it affects a plan. Record
this in `docs/apps-desktop-data-exercises.md` under `Gotchas` as a stated
limitation, not a TODO — a doc whose content is `TODO` is banned by
`CLAUDE.md` §6. Wording: "The 71 exercises outside the planner pools carry
derived `requires` tags covering bodyweight and dumbbells only; their furniture
and floor needs are not modelled, so the library equipment filter is
approximate for them."

Do not attempt to keyword-match the instructions to fill these in. It was
tried: it tags `push-up` as needing furniture and `pull-up` as needing nothing.

### 4.2 Step 2 — Schema and the one-time table rebuild

**Files**: `apps/desktop/src/data/schema.sql`, `apps/desktop/src/data/db.ts`.

This step closes defects §0c.1 and §0c.2. Read it in full before writing code;
the ordering is load-bearing.

**`schema.sql`** — three changes: the `exercises` table swaps `equipment` for
`requires`, the `locations` table is added, and `personalization` moves to its
v2 shape.

In the `exercises` table:

```sql
  -- was: equipment TEXT NOT NULL CHECK (equipment IN ('bodyweight','dumbbells','both')),
  requires TEXT NOT NULL,           -- JSON array of EquipmentKind
```

and delete `CREATE INDEX ... idx_exercises_equipment`. Nothing queries by
equipment — `listExercises` filters by `category_slug` only — so the index was
already dead and cannot be kept against a JSON column anyway.

**The `exercises` table hits the same NOT NULL trap as `personalization`**
(defect §0c.1): old installs have `equipment TEXT NOT NULL` with a CHECK, and
the new `INSERT OR REPLACE` in `seed()` does not supply it. But unlike
`personalization`, this table holds **zero user data** — `seed()` rewrites all
117 rows from `exercises.ts` on every launch. So it gets the cheap fix, not the
rebuild dance: drop it and let `schema.sql` recreate it. Put this at the very
top of `migrate()`, **before** `db.execute(schemaSql)`:

```ts
export async function migrate(): Promise<void> {
  const db = await getDb();
  // `exercises` is derived data, re-seeded from exercises.ts on every launch.
  // When its shape changes, drop it rather than migrating rows. Detect the old
  // shape by selecting a column that only the old shape has.
  let legacyCatalog = true;
  try {
    await db.select("SELECT equipment FROM exercises LIMIT 1");
  } catch {
    legacyCatalog = false;        // no such column, or no such table
  }
  if (legacyCatalog) await db.execute("DROP TABLE exercises");

  await db.execute(schemaSql);
  await db.execute("ALTER TABLE exercises ADD COLUMN video TEXT").catch(() => {});
}
```

Note the `try`/`catch` with an explicit flag rather than
`.then(drop).catch(() => {})` — the latter swallows a failure of the `DROP`
itself and leaves the old table in place, which fails later and further away.

Nothing references `exercises` by foreign key (the FK points the other way,
`exercises.category_slug -> categories.slug`), so the drop is safe.

Now the rest of `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  equipment TEXT NOT NULL,                  -- JSON array of EquipmentKind
  excluded_exercise_slugs TEXT NOT NULL,    -- JSON array of slugs
  display_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_display_order ON locations(display_order);

CREATE TABLE IF NOT EXISTS personalization (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  primary_goal TEXT NOT NULL
    CHECK (primary_goal IN ('general_fitness', 'strength', 'conditioning', 'mobility_balance')),
  experience TEXT NOT NULL
    CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 7),
  session_minutes INTEGER NOT NULL CHECK (session_minutes IN (15, 30, 45)),
  low_impact_only INTEGER NOT NULL CHECK (low_impact_only IN (0, 1)),
  location_id TEXT NOT NULL,
  generator_version INTEGER NOT NULL,
  plan_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`has_dumbbells` and `excluded_exercise_slugs` are **gone** from the v2 shape.
A fresh install gets this table directly. An install made before this change
keeps its v1 table, because `CREATE TABLE IF NOT EXISTS` is a no-op — that is
what the rebuild below is for. `ALTER TABLE ADD COLUMN location_id` from rev 2
is no longer needed and must not be added; the rebuild supplies the column.

**`db.ts`** — `ensureReady` gains a third phase:

```ts
export async function ensureReady(): Promise<void> {
  await migrate();
  await seed();
  await migrateLegacyPersonalization();
}
```

(Rev 3 required `seed()` before the rebuild because the rebuild updated a
seeded location. Rev 4's migration creates its own row, so the ordering no
longer matters for correctness — keep it anyway, it costs nothing and the
catalog should exist before anything reads it.)

`migrate()` is as written above: the legacy-catalog drop, then `schema.sql`,
then its existing `video` ALTER.

`seed()`'s exercise loop writes `JSON.stringify(ex.requires)` into the
`requires` column instead of `ex.equipment`; `rowToExercise` parses it back
with the same `try`/`catch` fallback `source_refs` already uses (fall back to
`["bodyweight"]`, not `[]` — an unparseable row should stay eligible somewhere
rather than vanish from every location).

```ts
// v1 installs have `has_dumbbells INTEGER NOT NULL` and
// `excluded_exercise_slugs TEXT NOT NULL` on `personalization`. SQLite cannot
// drop a NOT NULL constraint, so the v2 writer (which omits both columns)
// would fail with a constraint error forever. Rebuild the table once, moving
// the two values onto a location created here on the way out.
async function migrateLegacyPersonalization(): Promise<void> {
  const db = await getDb();
  const legacy = await db
    .select<{ has_dumbbells: number; excluded_exercise_slugs: string }[]>(
      "SELECT has_dumbbells, excluded_exercise_slugs FROM personalization WHERE id = 1",
    )
    .catch(() => null);           // null => no such column => already v2
  if (legacy === null) return;

  const legacyId = normalizeLocationId(LEGACY_LOCATION_NAME);
  const row = (legacy as unknown as { has_dumbbells: number; excluded_exercise_slugs: string }[])[0];
  if (row) {
    // The user has never named a place; this row is the only home for their
    // old equipment and exclusions. App routes them to LocationManager to
    // rename it before they can regenerate (§4.7).
    // The v1 boolean said nothing about furniture or floor, so assume both —
    // the permissive reading, which keeps every previously eligible exercise
    // eligible. The user corrects it on the rename screen they land on (§4.7).
    const equipment: EquipmentKind[] = row.has_dumbbells === 1
      ? ["bodyweight", "furniture", "dumbbells", "floor"]
      : ["bodyweight", "furniture", "floor"];
    await db.execute(
      `INSERT OR IGNORE INTO locations
         (id, name, equipment, excluded_exercise_slugs, display_order)
       VALUES ($1, $2, $3, $4, 0)`,
      [legacyId, LEGACY_LOCATION_NAME, JSON.stringify(equipment), row.excluded_exercise_slugs],
    );
  }

  await db.execute(`
    CREATE TABLE personalization_v2 (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      primary_goal TEXT NOT NULL,
      experience TEXT NOT NULL,
      days_per_week INTEGER NOT NULL,
      session_minutes INTEGER NOT NULL,
      low_impact_only INTEGER NOT NULL,
      location_id TEXT NOT NULL,
      generator_version INTEGER NOT NULL,
      plan_json TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO personalization_v2
      SELECT id, primary_goal, experience, days_per_week, session_minutes,
             low_impact_only, '${legacyId}', generator_version,
             plan_json, generated_at, updated_at
      FROM personalization;
    DROP TABLE personalization;
    ALTER TABLE personalization_v2 RENAME TO personalization;
  `);
}
```

Notes the implementer must not get wrong:

- The `CHECK` clauses are deliberately omitted from `personalization_v2` in the
  rebuild body. They are re-established for fresh installs by `schema.sql`;
  reproducing them here would mean two copies of the same constraint text
  drifting apart. If you prefer them identical, copy them — but copy *all* of
  them or none.
- `generator_version` is carried across **unchanged** (still `1`). That is what
  makes `loadPersonalization` return `regeneration_required` and drop the user
  on the prefilled form. Do not set it to `2` here — there is no v2 plan yet.
- The rebuild is guarded by the failing `SELECT`, so it runs at most once. On a
  fresh install the `SELECT` throws (`no such column: has_dumbbells`) and the
  function returns immediately — **no location row is created on a fresh
  install**, which is the whole point of rev 4.
- A v1 install with no saved profile has zero rows; the `SELECT` succeeds
  (the column exists), `row` is `undefined`, no location is created, and the
  rebuild still runs to fix the schema. That install then reaches the first-run
  `LocationManager` with an empty list, exactly like a fresh one. Both branches
  are needed.
- `INSERT OR IGNORE` on the location, not `INSERT`: if the user already has a
  location whose name normalizes to the same id, keep theirs. The
  `personalization.location_id` written below still points at that id, so the
  reference resolves either way.

### 4.3 Step 3 — Do not seed locations

**File**: none. This step is here to be explicit that there is nothing to
write.

`seed()` is **unchanged**: categories and exercises only. There is no
`seedLocations`. The `locations` table starts empty and stays empty until the
user creates a row, because the app has no idea where the user trains and a
guess is a label they did not choose (§0a).

Rev 3 specified a `seedLocations()` here and rev 2 specified a buggier one
(defect §0c.5, resurrecting deleted locations). Both are dropped. If you are
implementing from rev 2 or rev 3 notes, delete that function.

**Consequences, all of them improvements:**

- The empty list is a real, reachable state, so it needs a route: `App` renders
  `LocationManager` whenever `locations.length === 0` (§4.7). That single rule
  covers first run, a v1 install with no saved profile, and "the user deleted
  everything" — three cases, one branch, no resurrection surprise.
- `ProfileForm`'s location `<select>` can never render with zero options,
  because App never reaches `ProfileForm` with an empty list.
- `DEFAULT_LOCATIONS` and `DEFAULT_LOCATION_ID` do not exist (§4.1).

### 4.4 Step 4 — Update `PersonalizationProfile`

**File**: `apps/desktop/src/data/schedule.ts`.

```ts
export interface PersonalizationProfile {
  primaryGoal: TrainingGoal;
  experience: Difficulty;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
  lowImpactOnly: boolean;
  locationId: string;
}
```

In `isPersonalizationProfile()`: drop the `hasDumbbells` and
`excludedExerciseSlugs` checks, add
`typeof profile.locationId === "string" && profile.locationId.length > 0`.

Do **not** add a check that rejects profiles carrying leftover `hasDumbbells`
or `excludedExerciseSlugs` keys (rev 2's checklist asked for this). The
validator ignores extra keys today, nothing constructs such an object after
§4.6, and v1 detection is by `generator_version`.

Bump `PERSONALIZATION_GENERATOR_VERSION` from `1` to `2`. Expect `isWeeklyPlan`
to start rejecting every persisted v1 `plan_json` — see §2.2; that path is
already shadowed by the version check.

### 4.5 Step 5 — Update `isEligible` and `generateWeeklyPlan`

**File**: `apps/desktop/src/data/schedule.ts`.

```ts
import { equipmentCovers, type Location } from "./locations";

const isEligible = (
  candidate: PlanCandidate,
  exercise: Exercise,
  profile: PersonalizationProfile,
  location: Location,
  exclusions: Set<string>,
): boolean =>
  DIFFICULTIES.indexOf(exercise.difficulty) <= DIFFICULTIES.indexOf(profile.experience) &&
  equipmentCovers(location.equipment, exercise.requires) &&
  (!profile.lowImpactOnly || candidate.impact === "low") &&
  !exclusions.has(candidate.slug);
```

**Make the starvation error actionable.** With four kinds, the most likely
reason a focus has fewer than two eligible exercises is missing equipment, not
exclusions (§0a) — a floorless location cannot fill a `core` day. The existing
message ("Change exclusions or profile constraints.") sends the user to the
wrong screen. When the focus's pool has candidates that pass every check
*except* equipment, name what is missing:

```ts
const blockedBy = CANDIDATE_POOLS[focus]
  .filter((c) => !equipmentCovers(location.equipment, bySlug.get(c.slug)!.requires))
  .flatMap((c) => bySlug.get(c.slug)!.requires)
  .filter((kind) => !location.equipment.includes(kind));
const missing = [...new Set(blockedBy)];
```

If `missing` is non-empty, append to the message:
`` ` Add ${missing.map((k) => EQUIPMENT_LABELS[k]).join(" or ")} at ${location.name}, or pick another place.` ``
Keep the existing `code`, `day` and `focus` fields unchanged so the §4.10 test
that asserts the issue object still matches on those; assert the message with
`.includes()` rather than equality if you extend that test.

`generateWeeklyPlan` takes `locations: Location[]` third, resolves the active
location, and bails if it is unknown:

```ts
export function generateWeeklyPlan(
  profile: PersonalizationProfile,
  catalog: Exercise[],
  locations: Location[],
): PlanGenerationResult {
  if (!isPersonalizationProfile(profile)) {
    return { ok: false, issues: [{ code: "invalid_profile", message: "..." }] };
  }
  const location = locations.find((loc) => loc.id === profile.locationId);
  if (!location) {
    return {
      ok: false,
      issues: [{
        code: "location_missing",
        message: `Location "${profile.locationId}" no longer exists. Pick a location and regenerate.`,
        locationId: profile.locationId,
      }],
    };
  }
  // ... existing missing-catalog-exercise check, unchanged
  const exclusions = new Set(location.excludedExerciseSlugs);
  // ... isEligible(..., location, exclusions) at both call sites
  //     (schedule.ts:441-443 warmups, schedule.ts:467-469 per-day pool)
}
```

Extend the issue union:

```ts
export interface PlanGenerationIssue {
  code:
    | "invalid_profile"
    | "missing_catalog_exercise"
    | "insufficient_eligible_exercises"
    | "location_missing";
  message: string;
  day?: number;
  focus?: PlanFocus;
  slug?: string;
  locationId?: string;
}
```

The `unknown_exclusion` warning (schedule.ts:444-446) reads
`profile.excludedExerciseSlugs` today. Repoint it at
`location.excludedExerciseSlugs`; behavior and warning shape are unchanged.

### 4.6 Step 6 — Update DB read/write

**File**: `apps/desktop/src/data/db.ts`.

`DbPersonalizationRow` loses `has_dumbbells` and `excluded_exercise_slugs`,
gains `location_id: unknown`. The `SELECT` in `loadPersonalization` changes to
match. After §4.2 the legacy columns do not exist on any install, so selecting
them would throw.

`loadPersonalization` keeps its existing four result kinds and its existing
order of checks. The only changes to the function body:

- build `profileValue` with `locationId: row.location_id` instead of
  `hasDumbbells` / `excludedExerciseSlugs`,
- drop the `JSON.parse` of the exclusion column and its `invalid_profile`
  early-return.

Because §4.2 fills `location_id` on every migrated row, a v1 row now validates
as a v2 profile, reaches the `generator_version !== 2` check, and returns
`regeneration_required` **with the full profile** — which is exactly what
App.tsx:180-189 already renders. This is the fix for defect §0c.2; no reordering
is needed once the migration supplies `location_id`.

Add `"location_missing"` to the `regeneration_required` reason union:

```ts
| {
    kind: "regeneration_required";
    profile: PersonalizationProfile;
    reason: "invalid_plan_json" | "unsupported_generator_version" | "location_missing";
  }
```

`profile` stays **required**, not optional — rev 2's `profile: undefined` would
have broken the prefill for the other two reasons.

`savePersonalization` writes `location_id` and no longer writes
`has_dumbbells` / `excluded_exercise_slugs` (both columns are gone). Update the
`INSERT ... ON CONFLICT` column list, the `VALUES` placeholders, the
`DO UPDATE SET` list, and the parameter array together — a mismatch here is
silent until runtime.

New exports:

```ts
export async function listLocations(): Promise<Location[]>;
export async function upsertLocation(location: Location): Promise<void>;
export async function deleteLocation(id: string): Promise<void>;
```

- `listLocations` orders by `display_order ASC`, `JSON.parse`s the two array
  columns, and drops any row failing `isLocation` rather than throwing — one
  corrupt row must not make the app unbootable.
- `upsertLocation` throws if `isLocation(location)` is false, then
  `INSERT ... ON CONFLICT(id) DO UPDATE`.
- `deleteLocation` reads `SELECT location_id FROM personalization WHERE id = 1`
  first and throws `new Error('Cannot delete the location your saved plan uses.')`
  if it matches. It is the last line of defense; the UI also disables the
  button (§4.9).

### 4.7 Step 7 — Update `App.tsx`

**File**: `apps/desktop/src/App.tsx`.

- Add `locations: Location[]` to the ready `Status` variant. Do **not** add
  `activeLocationId` — the location is `personalization.saved.profile.locationId`
  (defect §0c.4).
- `Screen` becomes `"plan" | "library" | "profile" | "locations"`. No
  `"location_missing"`.
- First load: `Promise.all([listCategories(), listExercises(), listLocations(), loadPersonalization()])`.
  Then, before `setStatus`, reconcile an unresolvable location:

  ```ts
  const fallback = locations[0]?.id ?? "";
  const reconciled =
    loaded.kind === "ready" && !locations.some((l) => l.id === loaded.saved.profile.locationId)
      ? {
          kind: "regeneration_required" as const,
          profile: { ...loaded.saved.profile, locationId: fallback },
          reason: "location_missing" as const,
        }
      : loaded;
  ```

  Pass `reconciled` into `setStatus`. The existing
  `setProfileMode(kind === "regeneration_required" ? "regenerate" : "save")`
  line already does the right thing.
- App.tsx:176-178 gets a third message branch for `reason === "location_missing"`:
  `"The location this plan was made for no longer exists. Pick a location and regenerate."`
- `submitProfile` calls `generateWeeklyPlan(profile, exercises, locations)` and
  **returns `boolean`** (`true` on save, `false` on generation or save failure).
  It already has both exits; just return from them.
- New `switchLocation`:

  ```ts
  async function switchLocation(locationId: string): Promise<void> {
    if (personalization.kind !== "ready") return;
    const ok = await submitProfile({ ...personalization.saved.profile, locationId });
    if (!ok) {
      // The plan screen has nowhere to show a generation error; hand the user
      // the form, which renders `formError` verbatim.
      setProfileMode("regenerate");
      setScreen("profile");
    }
  }
  ```

  Note `switchLocation` must **not** call `openProfile`, which clears
  `formError`.
- Location CRUD handlers `onUpsert` / `onDelete` call the `db.ts` functions,
  then refresh `locations` via `listLocations()` and merge into `status`.
  Surface thrown errors in a `locationError` state passed to `LocationManager`.
  After a successful upsert that changes the **active** location's equipment or
  exclusions, the saved plan is now stale in a way the user asked for — do not
  auto-regenerate; `LocationManager` shows a `Regenerate plan` button that calls
  `switchLocation(activeId)` when the edited location is the active one.
- New nav button `Locations` next to the other three, rendered under the same
  `personalization.kind === "ready"` condition.
- New screen branch: `screen === "locations"` renders `<LocationManager ... />`.

**First-run routing (rev 4).** Because nothing is seeded, the empty list is a
reachable state and must be handled before every other branch. Add this as the
first case in the render chain, ahead of the `invalid_profile` check at
App.tsx:152:

```tsx
locations.length === 0 ? (
  <LocationManager
    locations={locations}
    /* ...crud props... */
    firstRun
    onClose={() => setScreen(personalization.kind === "ready" ? "plan" : "profile")}
  />
) : personalization.kind === "invalid_profile" ? (
  /* ...unchanged... */
```

The nav is already hidden unless `personalization.kind === "ready"`, so a first
run shows `LocationManager` alone. `onClose` is the `Continue` button; once a
location exists the same render chain falls through to the profile form.

**v1 migration routing (rev 4).** A v1 install arrives with exactly one
location carrying the app-generated `LEGACY_LOCATION_NAME` (§3.5). Send the
user to rename it before they regenerate: in the first-load effect, when
`loaded.kind === "regeneration_required"` and some location's `name` equals
`LEGACY_LOCATION_NAME`, `setScreen("locations")`. The nav is hidden in that
state, so `LocationManager`'s `Continue` is the only way forward and it lands
on the prefilled regeneration form. One extra condition, no new component, no
new screen value.

This is the *only* consumer of `LEGACY_LOCATION_NAME` outside `db.ts`. If you
find yourself comparing names anywhere else, something has gone wrong — names
are user data, not identifiers.

### 4.8 Step 8 — Update `ProfileForm` and `PlanView`

**File**: `apps/desktop/src/PersonalizedPlan.tsx`.

`ProfileForm`:
- Remove the `hasDumbbells` checkbox (lines 267-274) and the entire
  `<details>` exclusion fieldset (lines 284-351), along with `search`,
  `visibleCatalog`, `catalogSlugs` and `unknownExclusions`. The `categories`
  and `catalog` props become unused here — remove them from `ProfileFormProps`
  and from both call sites in `App.tsx`, and move them to `LocationManager`.
- The `useState` initializer (line 153-156) currently spreads
  `excludedExerciseSlugs`; replace with a plain `{ ...(initialProfile ?? DEFAULT_PROFILE) }`.
- Add a `locations: Location[]` prop and a `Location` `<select>` in the form
  grid, bound to `profile.locationId`, plus an `onManageLocations: () => void`
  prop rendering a `Manage locations` button.
- `DEFAULT_PROFILE` (lines 35-43) drops `hasDumbbells` and
  `excludedExerciseSlugs`. It gains **no** `locationId` — there is no default
  location to name any more (§4.3). Type it
  `Omit<PersonalizationProfile, "locationId">` and have the `useState`
  initializer supply `locationId: initialProfile?.locationId ?? locations[0].id`.
  `locations[0]` is safe: App never renders `ProfileForm` with an empty list.

`PlanView`:
- New props `locations: Location[]` and `onSwitchLocation: (id: string) => void`.
- Header gets a `<select>` bound to `saved.profile.locationId` whose `onChange`
  calls `onSwitchLocation`. Disable it while `saving`.
- The `Constraints` tile keeps low impact and gains the location name
  (defect §0c.8):

  ```tsx
  <div>
    {locations.find((l) => l.id === profile.locationId)?.name ?? profile.locationId}
    {profile.lowImpactOnly ? " · Low impact" : ""}
  </div>
  ```

  Add a `Location` tile of its own if the combined line reads badly; either way
  `lowImpactOnly` must remain visible.
- No stale-plan banner. Switching regenerates, so the rendered plan always
  matches the selected location.

### 4.9 Step 9 — Add `LocationManager`

**File**: `apps/desktop/src/LocationManager.tsx` (new). This is the **only**
new component; there is no `LocationPicker` (§3.6).

```ts
interface LocationManagerProps {
  locations: Location[];
  categories: Category[];
  catalog: Exercise[];
  activeLocationId: string;          // = saved.profile.locationId
  onUpsert: (location: Location) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRegenerate: () => void;          // shown after editing the active location
  onClose: () => void;               // the Continue / Done button
  firstRun: boolean;                 // true when locations.length === 0
  error: string | null;
  saving: boolean;
}
```

Supports:
- **First run** (`firstRun === true`, i.e. no locations exist): heading
  `Where do you work out?`, sub-line
  `Name each place and tick what you have there. You can add more later.`, the
  create form rendered open with the name input `autoFocus`, and `Continue`
  disabled while the list is empty. No nav is visible in this state, so
  `Continue` is the only exit — do not render a Cancel.
- **Create**: id is `normalizeLocationId(name)`, computed once at create time.
  Report `""` (name with no alphanumerics) and a collision with an existing id
  as form errors — the collision message must name the clash in user terms
  (`"You already have a place called Garage."`), never show the slug.
  `displayOrder` is `max(existing) + 1`. The name input is a plain
  `<input type="text" required>`; accept anything the user types, including
  spaces, punctuation and non-ASCII. `normalizeLocationId` may reduce two
  distinct names to the same id (`Nani's house` and `nanis house`); that is the
  collision error above, not a rename of their input. A name that normalizes to
  `""` (any non-Latin script) gets a generated id and is accepted — see §4.1.
- **Edit**: name, equipment checkboxes generated by mapping `EQUIPMENT_KINDS`
  to `EQUIPMENT_LABELS` (not four hardcoded inputs — a fifth kind added to the
  union then appears with no further change), and excluded exercises. The exclusion fieldset is the
  searchable per-category checklist lifted from `ProfileForm` lines 284-351,
  reading and writing `location.excludedExerciseSlugs`. Move that block; do not
  leave a copy behind in `ProfileForm`.
- **Rename does not change the id.** State this in a comment at the id
  computation site; the saved profile references the id.
- **Delete**: `window.confirm("Delete this location?")`. The button is
  `disabled` when `location.id === activeLocationId`, with the reason rendered
  next to it. `deleteLocation` re-checks server-side.

- **Per-location readiness line (reinstated in rev 5).** Under each location,
  render one line per `PlanFocus`: the focus label and how many of its pool
  candidates pass `equipmentCovers` and the exclusion set. Any focus with fewer
  than two is shown in the warning colour with the missing kinds named, using
  the same `missing` computation as §4.5.

  Rev 3 cut this as speculative, and it was — with two equipment kinds every
  plausible location could fill every focus. Rev 5 earns it back: a location
  without `floor` leaves `core` with exactly one eligible exercise, so
  `general_fitness` and `conditioning` cannot generate at all (§0a). Without
  this line the user discovers that only by hitting Save on the profile form,
  one screen away from the checkbox that would fix it.

  Keep it to a computed list — no memoisation, no separate component. The pools
  total ~47 candidates and this runs on render of a screen the user opens
  occasionally.

### 4.10 Step 10 — Tests

**Files**: `apps/desktop/src/data/schedule.test.ts` (rewrite),
`apps/desktop/src/data/locations.test.ts` (new).

Rev 2's test spec was not runnable — see defect §0c.6. The rules for the rewrite:

1. **Every location a test names must be in the array passed to
   `generateWeeklyPlan`.** The helper takes the list:

   ```ts
   const homeLocation: Location = {
     id: "home", name: "Home",
     // == v1 hasDumbbells: true, per the §3.2 equivalence table
     equipment: ["bodyweight", "furniture", "dumbbells", "floor"],
     excludedExerciseSlugs: [], displayOrder: 0,
   };
   const officeLocation: Location = {
     id: "office", name: "Office",
     // == v1 hasDumbbells: false
     equipment: ["bodyweight", "furniture", "floor"],
     excludedExerciseSlugs: [], displayOrder: 1,
   };

   const baseProfile: PersonalizationProfile = {
     primaryGoal: "general_fitness",
     experience: "advanced",
     daysPerWeek: 3,
     sessionMinutes: 15,
     lowImpactOnly: false,
     locationId: "home",
   };

   function planFor(
     overrides: Partial<PersonalizationProfile> = {},
     locations: Location[] = [homeLocation, officeLocation],
   ) {
     const result = generateWeeklyPlan({ ...baseProfile, ...overrides }, EXERCISES, locations);
     if (!result.ok) assert.fail(result.issues.map((i) => i.message).join("\n"));
     return result.plan;
   }
   ```

2. **Never mutate a shared location.** A test that needs exclusions builds its
   own object literal — `{ ...officeLocation, excludedExerciseSlugs: [...] }`.
   The `identical profiles generate identical plan snapshots` test asserts
   `deepStrictEqual` across two calls and will catch cross-test leakage, but
   only by failing somewhere confusing.

3. **Every id must satisfy `/^[a-z0-9]+(-[a-z0-9]+)*$/`.** Rev 2's
   `"mobilityLocation"` is invalid; use `"mobility-test"`.

4. **`homeLocation` / `officeLocation` are test fixtures, not defaults.**
   Nothing seeds them (§4.3) and no production code references those ids. They
   are named that way only because the two rows of the §3.2 equivalence table
   need labels. Do not let them creep back into `locations.ts`.

Per-test changes:

- `identical profiles generate identical plan snapshots` — move
  `excludedExerciseSlugs: ["push-up"]` onto a local location; pass the same
  array object to both calls.
- `hard eligibility filters are never relaxed` — use
  `{ locationId: "office" }` with a local
  `{ ...officeLocation, excludedExerciseSlugs: ["push-up"] }`. Keep all four
  existing assertions, with the equipment one rewritten as
  `assert.equal(exercise.requires.includes("dumbbells"), false)`.
- `goals repeat their exact focus cycles` — only the helper signature changes.
- `generation fails when a focus has fewer than two eligible exercises` — put
  the long exclusion list on a local `mobility-test` location, pass
  `[mobilityLocation]`, use `locationId: "mobility-test"`. The expected issue
  object is unchanged.
- `catalog gaps, stale exclusions, prescriptions, and duration are explicit` —
  the `EXERCISES.filter(...)` call gains the locations array as its third
  argument; the stale-exclusion assertion moves `["retired-exercise"]` onto a
  local location. `formatPrescription` and `sessionDurationSec` assertions are
  untouched.

New in `schedule.test.ts` — the regression test for the "strict generalization"
claim in §3.3, asserting both rows of the §3.2 equivalence table:

```ts
test("location equipment reproduces the v1 hasDumbbells behaviour", () => {
  const withDumbbells = planFor({ locationId: "home" });
  const withoutDumbbells = planFor({ locationId: "office" });
  const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
  const slugs = (plan: WeeklyPlan) =>
    plan.days.flatMap((d) => [...d.session.warmup, ...d.session.main].map((i) => i.slug));

  // hasDumbbells: true -> dumbbell exercises are reachable
  assert.ok(slugs(withDumbbells).some((s) => bySlug.get(s)?.requires.includes("dumbbells")));
  // hasDumbbells: false -> none, and reverse-lunge (was "both") is still allowed
  assert.ok(slugs(withoutDumbbells).every((s) => !bySlug.get(s)?.requires.includes("dumbbells")));
});
```

And the test that guards the re-tag itself — the four kinds are only worth
anything if they actually partition the pools:

```ts
test("equipment kinds gate the pools they are supposed to gate", () => {
  const kit = (equipment: EquipmentKind[]): Location => ({
    id: "test", name: "Test", equipment, excludedExerciseSlugs: [], displayOrder: 0,
  });
  const generate = (equipment: EquipmentKind[], primaryGoal: TrainingGoal) =>
    generateWeeklyPlan(
      { ...baseProfile, primaryGoal, locationId: "test" },
      EXERCISES,
      [kit(equipment)],
    );

  // A floorless place cannot fill a core day: general_fitness and conditioning fail.
  const floorless = generate(["bodyweight", "furniture", "dumbbells"], "conditioning");
  assert.equal(floorless.ok, false);
  assert.ok(floorless.issues.some((i) => i.code === "insufficient_eligible_exercises"));
  assert.match(floorless.issues[0].message, /proper floor/);

  // Mobility is all standing or chair-assisted, so it generates on bodyweight alone.
  assert.equal(generate(["bodyweight"], "mobility_balance").ok, true);

  // The full kit generates every goal.
  for (const goal of ["general_fitness", "strength", "conditioning", "mobility_balance"] as const) {
    assert.equal(generate(["bodyweight", "furniture", "dumbbells", "floor"], goal).ok, true);
  }
});
```

This test is the reason the §4.1a table has to be right. If it fails after a
re-tag, the tag is wrong, not the test — check the table before changing the
assertion.

New file `locations.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { equipmentCovers, isLocation, normalizeLocationId } from "./locations.ts";

test("equipmentCovers is a subset test", () => {
  assert.equal(equipmentCovers(["bodyweight"], ["bodyweight"]), true);
  assert.equal(equipmentCovers(["bodyweight", "floor"], ["bodyweight"]), true);
  assert.equal(equipmentCovers(["bodyweight"], ["bodyweight", "floor"]), false);
  assert.equal(equipmentCovers(["bodyweight", "dumbbells"], ["dumbbells"]), true);
  assert.equal(equipmentCovers([], ["bodyweight"]), false);
});

test("equipmentCovers accepts an empty requirement anywhere", () => {
  assert.equal(equipmentCovers([], []), true);
  assert.equal(equipmentCovers(["floor"], []), true);
});

test("equipmentCovers ignores extra kit the exercise does not need", () => {
  const everything = ["bodyweight", "furniture", "dumbbells", "floor"] as const;
  assert.equal(equipmentCovers([...everything], ["floor"]), true);
  assert.equal(equipmentCovers([...everything], [...everything]), true);
});

test("isLocation accepts a valid location and rejects bad shapes", () => {
  const valid = {
    id: "home", name: "Home",
    equipment: ["bodyweight"], excludedExerciseSlugs: [], displayOrder: 0,
  };
  assert.equal(isLocation(valid), true);
  assert.equal(isLocation(null), false);
  assert.equal(isLocation({ ...valid, equipment: [] }), false);            // empty kit
  assert.equal(isLocation({ ...valid, equipment: ["barbell"] }), false);   // not a known kind
  assert.equal(isLocation({ ...valid, equipment: ["bodyweight", "bodyweight"] }), false);
  assert.equal(isLocation({ ...valid, id: "Home" }), false);               // uppercase
  assert.equal(isLocation({ ...valid, id: "my office" }), false);          // space
  assert.equal(isLocation({ ...valid, name: "  " }), false);               // blank
  assert.equal(isLocation({ ...valid, displayOrder: -1 }), false);
  assert.equal(isLocation({ ...valid, excludedExerciseSlugs: ["a", "a"] }), false);
});

test("normalizeLocationId lowercases and hyphenates", () => {
  assert.equal(normalizeLocationId("My Office"), "my-office");
  assert.equal(normalizeLocationId("gym 1"), "gym-1");
  assert.equal(normalizeLocationId("home"), "home");
  assert.equal(normalizeLocationId("  The Park!  "), "the-park");
  assert.equal(normalizeLocationId("!!!"), "");
});
```

Note `isLocation({ ...valid, equipment: ["barbell"] })` — TypeScript rejects it
at compile time, which is the point; cast with `as unknown` in the test so the
runtime guard is still exercised.

`exercises.test.ts` also needs a pass: it asserts on the catalog shape, so any
`equipment` reference becomes `requires`. Add one assertion there that every
record has a non-empty `requires` whose every member is in `EQUIPMENT_KINDS` —
that is the cheapest guard against a typo in a 117-record hand edit.

**Not covered by automated tests** (no DB harness exists in this repo, and
adding one is out of scope): `migrateLegacyPersonalization`, `listLocations`,
`upsertLocation`, `deleteLocation`. §4.12's manual smoke test is the only check
on the migration path — run it against a **copy** of a real v1 database before
declaring the step done.

### 4.11 Step 11 — Doc updates

`CLAUDE.md` is strict: every behavior change ships its doc change in the same
commit.

- **`docs/apps-desktop-data-exercises.md`** (update, bump `updated`; revs 1-4
  listed it as unchanged): `EquipmentKind`, `EQUIPMENT_KINDS`,
  `EQUIPMENT_LABELS` in `Contract`; `Exercise.requires` replacing
  `Exercise.equipment`; the §2.1 mapping table in `Behavior`; and in `Gotchas`
  the stated limitation from §4.1a about the 71 derived tags, plus the fact
  that no catalog exercise models a pull-up bar so bar exercises are tagged
  `["bodyweight"]` and are library-only.
- **`docs/apps-desktop-exercise-browser.md`** (update, bump `updated`): the
  filter now matches `requires.includes(kind)` over `EQUIPMENT_KINDS`, and the
  detail pane renders the full label list.
- **`docs/apps-desktop-data-locations.md`** (new): the §3 skeleton —
  `Purpose`, `Contract`, `Behavior`, `Invariants`, `Gotchas`, `Related`.
  Frontmatter `id: apps-desktop-data-locations`,
  `source: apps/desktop/src/data/locations.ts, apps/desktop/src/data/locations.test.ts`,
  `depends_on: [apps-desktop-data-exercises]`. `Gotchas` must state: SQLite
  cannot CHECK-validate a JSON array, so `isLocation` is the only defense;
  `Location.id` is immutable after creation because the saved profile
  references it, so a rename leaves the old slug in the DB; no location is ever
  seeded, so the table is legitimately empty on a fresh install; and
  `normalizeLocationId` returns `""` for any name without ASCII alphanumerics,
  which the caller must replace with a generated id rather than reject.
- **`docs/apps-desktop-data-schedule.md`** (update, `updated: 2026-08-10`):
  new `PersonalizationProfile` block; `generateWeeklyPlan`'s third parameter;
  the `location_missing` issue code; `PERSONALIZATION_GENERATOR_VERSION` is 2;
  the §3.2 equivalence table replacing the `hasDumbbells` gotcha; the subset
  eligibility rule; and in `Gotchas` the §0a starvation table — a location
  without `floor` cannot generate `general_fitness` or `conditioning`.
  `depends_on` gains `apps-desktop-data-locations`.
- **`docs/apps-desktop-data-db.md`** (update, bump `updated`): the `locations`
  table; the v2 `personalization` shape and the one-time rebuild in
  `migrateLegacyPersonalization` (with the "runs at most once, guarded by a
  failing SELECT" note in `Gotchas`, plus "creates the only app-generated
  location name in the codebase, and only on a v1 install that had a saved
  profile"); the fact that `seed()` does **not** touch `locations`; the new
  `location_missing` reason on `regeneration_required`;
  `listLocations` / `upsertLocation` / `deleteLocation` in `Contract`;
  `depends_on` gains `apps-desktop-data-locations`.
- **`docs/apps-desktop-app.md`** (update, bump `updated`): the `Locations` nav
  button and screen; the `locations.length === 0` first-run route ahead of
  every other branch; the v1 rename route; `switchLocation` regenerating in
  place; the load-time location reconciliation; `depends_on` gains
  `apps-desktop-data-locations`.
- **`docs/apps-desktop-personalized-plan.md`** (update, bump `updated`): drop
  `hasDumbbells` and the profile-level exclusion fieldset; add the location
  select in both `ProfileForm` and `PlanView`; note the exclusion fieldset
  moved to `LocationManager`; record that `ProfileForm` no longer takes
  `categories` / `catalog`.
- **`docs/apps-desktop-location-manager.md`** (new): doc for
  `apps/desktop/src/LocationManager.tsx`, same skeleton. Required by
  `CLAUDE.md` §1 — every source module gets a doc, and
  `apps-desktop-exercise-browser` sets the precedent for component docs.
  `Behavior` must cover the `firstRun` mode; `Invariants` must state that the
  component never writes a name the user did not type.
- **`docs/index.md`**: add both new lines, alphabetically:
  - `- [apps-desktop-data-locations](apps-desktop-data-locations.md) — Named places with their own equipment and exclusions.`
  - `- [apps-desktop-location-manager](apps-desktop-location-manager.md) — Create, edit, and delete locations.`
- **`docs/decisions.md`**: append the §3.5 entry. Append only; never edit an existing one.

### 4.12 Step 12 — Verification

Run in order before claiming the change is done:

1. `pnpm --filter @flex-state/desktop check` (TypeScript).
2. `pnpm --filter @flex-state/desktop test` (Node test runner).
3. `pnpm lint` (Biome).
4. Stale-doc check — run the `for f in docs/*.md` snippet from `CLAUDE.md` §8
   and confirm no `STALE` or `DEAD SOURCE` output.
5. Manual smoke test. The implementer does **not** run `pnpm tauri:dev`; the
   desktop app needs a graphical runtime, so per the runtime contract the user
   runs it and reports back. State that plainly and hand over this list:
   - **v1 migration (do this first, on a copy of a real pre-change DB).**
     Launch. Expect `LocationManager`, not the profile form, with one location
     called `My usual place` — dumbbells ticked iff the old profile had them,
     and carrying the old exclusion list. Rename it to a real name. Hit
     `Continue`. Expect the "unsupported generator version" notice and a
     **prefilled** profile form: goal, experience, days and minutes all
     preserved. Hit `Regenerate plan`.
   - **Fresh install.** Delete the DB. Launch. Expect `LocationManager` headed
     `Where do you work out?` with an **empty** list — no `Home`, no `Office`,
     no location of any name. `Continue` is disabled.
   - Add a location with your own name for it. The equipment checklist shows
     exactly four items: `Bodyweight training`, `A chair, bench, or wall`,
     `Two 5 kg dumbbells`, `A proper floor`. Tick everything.
     `Continue` is now enabled. Add a second one with `A proper floor`
     **unticked** and one exercise excluded. Continue.
   - On the second location, check the readiness line: `Core` should be flagged
     with fewer than two eligible exercises and name the missing floor. This is
     the §0a starvation case — confirm you see it here, before generating.
   - The profile form appears with no dumbbell checkbox and no exclusion
     fieldset; the location select lists exactly the two names you typed.
   - Save a plan with the dumbbell location selected. Verify no exercise in the
     plan is the one you excluded.
   - With the floorless location selected and goal `General fitness`, hit Save.
     Expect a failure naming `A proper floor` and the location by name — not
     the old "Change exclusions or profile constraints." Tick the floor, save
     again, and it succeeds.
   - Switch the goal to `Mobility & balance` at a location with only
     `Bodyweight training` ticked: it must still generate (§4.1a).
   - On `My Plan`, switch the select to the location without dumbbells. The
     plan regenerates in place; verify no dumbbell exercise remains, the
     Constraints tile shows that location's name, and `· Low impact` is still
     there if you ticked it.
   - In `Exercise Library`, filter by `A proper floor`: expect planks, sit-ups
     and crawls. Filter by `A chair, bench, or wall`: expect the chair-assisted
     mobility work, `bench-dip`, `wall-sit`, `wall-crunch`. Both filters are
     approximate for exercises outside the planner pools (§4.1a).
   - Rename a location while a plan references it: the plan keeps working and
     the new name shows on `My Plan` (the id did not change).
   - Try to delete the location the plan uses: the button is disabled with a
     reason. Switch away, then delete it successfully. Relaunch: it does
     **not** come back.
   - Delete every location, relaunch: expect the empty `LocationManager`
     again — **not** a pair of invented defaults (§4.3).
   - Try a name in a non-Latin script if you use one, and a name that is only
     punctuation: both are accepted (§4.1). Only blank is rejected.

## 5. Open questions for the implementer

Rev 3 resolved questions 2 and 4 from rev 2; rev 4 resolved question 1. They
are recorded here as decided, not open.

**Open:**

2. **Does `furniture` really cover walls?** §3.2 folds "a wall" into the
   furniture kind and labels it "A chair, bench, or wall", because the kit list
   has four items and only `wall-sit` / `wall-crunch` would use a fifth. If a
   place with a wall but no chair is a real case for you, say so — the fix is
   one entry in `EQUIPMENT_KINDS` and two rows in the §4.1a table.
3. **Is the §4.1a tagging table right?** It is 46 judgment calls about your own
   equipment. The ones most likely to be wrong: `calf-raise` (tagged
   `dumbbells` only because the catalog already says so — it is doable
   unloaded), `bear-crawl` (tagged `floor` for space rather than surface), and
   whether the chair-assisted mobility work should also require `floor`.

**Decided in rev 4:**

1. ~~Default location names~~ — **there are none.** Nothing is seeded; the
   first-run screen is `LocationManager` and the user types every name (§0a,
   §4.3). The single app-generated name left is `LEGACY_LOCATION_NAME` on the
   v1 migration path, which the user is routed to rename before they can
   regenerate (§3.5, §4.7).

**Decided in rev 5:**

4. ~~Equipment checkboxes fixed or derived~~ — **derived** from
   `EQUIPMENT_KINDS` everywhere (§3.2, §4.9), so the list is defined once and a
   fifth kind needs no UI change.

**Decided in rev 3:**

5. ~~Minimum equipment~~ — a location must have **at least one** equipment
   kind, not specifically `bodyweight` (§3.2). `["dumbbells"]` is legal and
   fails loudly at generation if it starves a focus.
6. ~~Active location in the profile or separate~~ — **in the profile, and only
   there** (§3.1, defect §0c.4). The alternative created a second source of
   truth that was lost on quit and needed a banner to explain itself.

## 6. Acceptance checklist (copy-paste for the implementer)

Catalog:
- [ ] `exercises.ts` exports `EquipmentKind`, `EQUIPMENT_KINDS`, `EQUIPMENT_LABELS`; `export type Equipment` is deleted.
- [ ] `Exercise.requires: EquipmentKind[]` replaces `Exercise.equipment`. `grep -rn '"both"' apps/desktop/src` returns **nothing**.
- [ ] All 46 planner slugs match the §4.1a table exactly. All 117 records have a non-empty `requires`, asserted in `exercises.test.ts`.
- [ ] `ExerciseBrowser` filters on `requires.includes(kind)` over `EQUIPMENT_KINDS` and shows labels, not raw kind strings.
- [ ] No component hardcodes the four kind strings; every checklist and filter maps `EQUIPMENT_KINDS`.

Data layer:
- [ ] `locations.ts` exports `Location`, `LEGACY_LOCATION_NAME`, `equipmentCovers`, `isLocation`, `normalizeLocationId` — and **no** `DEFAULT_LOCATIONS` / `DEFAULT_LOCATION_ID` / `OwnedEquipment`.
- [ ] `equipmentCovers(owned, required)` is the one-line subset test; it has no branch on any specific kind.
- [ ] `migrate()` drops a legacy `exercises` table before running `schema.sql`, using try/catch with an explicit flag rather than a swallowed `.catch()`.
- [ ] `schema.sql`'s `exercises` table has `requires TEXT NOT NULL` and no `idx_exercises_equipment` index.
- [ ] `schema.sql` has the `locations` table and the **v2** `personalization` table with `location_id TEXT NOT NULL` and no `has_dumbbells` / `excluded_exercise_slugs`.
- [ ] No `ALTER TABLE personalization ADD COLUMN location_id` anywhere — the rebuild supplies it.
- [ ] `migrateLegacyPersonalization()` is guarded by a failing `SELECT has_dumbbells`, creates one location from `LEGACY_LOCATION_NAME` **only when a v1 profile row exists**, moves equipment + exclusions onto it, rebuilds the table, and leaves `generator_version` at its old value.
- [ ] `seed()` does not touch the `locations` table. There is no `seedLocations` function anywhere.
- [ ] A fresh install ends up with **zero** rows in `locations`. Verify directly: delete the DB, launch, quit, and check the table is empty apart from anything you typed.
- [ ] `grep -rn 'Home\|Office' apps/desktop/src` returns no location name. The only string literal naming a place in the whole app is `LEGACY_LOCATION_NAME`.

Generator:
- [ ] `PERSONALIZATION_GENERATOR_VERSION` is `2`.
- [ ] `PersonalizationProfile` has `locationId` and neither `hasDumbbells` nor `excludedExerciseSlugs`.
- [ ] `isPersonalizationProfile` validates `locationId` as a non-empty string and does **not** reject extra keys.
- [ ] `isEligible` uses `equipmentCovers(location.equipment, exercise.requires)`.
- [ ] `insufficient_eligible_exercises` names the missing equipment kinds and the location when equipment is what blocked the focus.
- [ ] `generateWeeklyPlan(profile, catalog, locations)` returns a `location_missing` issue for an unknown id.
- [ ] The `unknown_exclusion` warning reads `location.excludedExerciseSlugs`.

Persistence:
- [ ] `loadPersonalization` keeps four kinds; `regeneration_required.profile` stays required; its `reason` union gains `"location_missing"`.
- [ ] `savePersonalization`'s column list, placeholders, `DO UPDATE SET` list and parameter array all agree.
- [ ] `listLocations` skips rows failing `isLocation` instead of throwing; `upsertLocation` throws on invalid; `deleteLocation` refuses the profile's location.

UI:
- [ ] `App` has no `activeLocationId` state.
- [ ] `App` reconciles an unresolvable `locationId` at load into `regeneration_required` with `reason: "location_missing"`; there is no `"location_missing"` screen.
- [ ] `submitProfile` returns `boolean`; `switchLocation` falls back to the profile form on failure without clearing `formError`.
- [ ] `Locations` nav button and `"locations"` screen exist; `LocationManager` is the only new component (no `LocationPicker` file).
- [ ] `locations.length === 0` renders `LocationManager` ahead of every other branch, with `firstRun`, an empty list, and `Continue` disabled.
- [ ] A v1 install with a saved profile lands on `LocationManager` to rename `LEGACY_LOCATION_NAME` before reaching the regeneration form.
- [ ] `LocationManager` accepts any non-blank name, including non-Latin scripts and punctuation-only, falling back to a generated id when `normalizeLocationId` returns `""`.
- [ ] `LocationManager` shows the per-focus readiness line and flags any focus with fewer than two eligible exercises, naming the missing kinds.
- [ ] Renaming a location does not change its id and does not orphan the saved plan.
- [ ] `ProfileForm` has no dumbbell checkbox, no exclusion fieldset, and no `categories` / `catalog` props; it has a location select listing only user-created names.
- [ ] The exclusion fieldset exists in exactly one place (`LocationManager`).
- [ ] `PlanView` has a location select that regenerates in place, shows the location name, and **still shows `· Low impact`**.
- [ ] Delete is disabled for the active location, with the reason visible.

Tests and docs:
- [ ] `schedule.test.ts` passes every location it names into `generateWeeklyPlan`, mutates no shared location object, and uses only `[a-z0-9-]+` ids.
- [ ] `schedule.test.ts` has the v1-equivalence regression test **and** the "equipment kinds gate the pools" test from §4.10; the floorless-conditioning case fails and the mobility-on-bodyweight case succeeds.
- [ ] `locations.test.ts` exists and covers `equipmentCovers`, `isLocation`, `normalizeLocationId`.
- [ ] `pnpm --filter @flex-state/desktop check` passes.
- [ ] `pnpm --filter @flex-state/desktop test` passes.
- [ ] `pnpm lint` passes.
- [ ] `docs/apps-desktop-data-locations.md` and `docs/apps-desktop-location-manager.md` exist and are listed in `docs/index.md`.
- [ ] All touched docs have `updated: 2026-08-10`.
- [ ] `docs/decisions.md` has the §3.5 entry appended.
- [ ] The `CLAUDE.md` §8 stale-doc snippet prints nothing.
