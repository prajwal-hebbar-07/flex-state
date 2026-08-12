# Decisions

## 2026-08-08 - Keep mobility variants distinct

Decision: Add a `mobility` category and preserve Tai Chi and chair-assisted movements as distinct exercise records.

Alternative rejected: Fold the movements into existing strength categories or cite the PDFs only on similar floor exercises.

Why: The balance, breathing, support, and movement contracts differ from the existing strength exercises. Distinct records preserve searchable names and instructions from every supplied PDF without changing existing exercise mechanics.


## 2026-08-09 - Persist one versioned personalization snapshot

Decision: Generate plans deterministically offline and atomically persist one profile with its versioned plan snapshot in fixed SQLite row `id = 1`.

Alternative rejected: Regenerate on launch, store profile and plan in separate writes, or add accounts, cloud sync, and AI generation.

Why: One statement prevents profile-plan mismatches, explicit regeneration preserves a stable saved plan, and one installation-local profile satisfies the product contract without network state.


## 2026-08-10 - Store one YouTube watch URL per exercise, drop local PDF citations

Decision: Give `Exercise` a single `video?: string` holding a `youtube.com/watch?v=<id>` URL, persist it in one `video TEXT` column, and swap it to `youtube.com/embed/<id>` at render time. Remove the eight `file://` PDF source constants and every reference to them.

Alternative rejected: A `{url, thumbnail, source}` object in a JSON column, or `video_url` plus `video_thumbnail` columns. Also rejected: keeping the `file://` rows as a citation trail.

Why: Nothing queries by video, and the YouTube thumbnail is derivable from the id (`img.youtube.com/vi/<id>/hqdefault.jpg`), so the extra fields carried no information. The `source` discriminator had exactly one value. The `file://` URLs resolve only on one workstation, so they were dead links in the shipped app; nine records now have an empty `sourceRefs` and the detail pane omits the line.


## 2026-08-10 - Multi-location equipment profiles

Decision: Replace the catalog's `Equipment` union
(`bodyweight | dumbbells | both`) with a flat `EquipmentKind` list
(`bodyweight`, `furniture`, `dumbbells`, `floor`) used on both sides:
an exercise carries `requires: EquipmentKind[]`, a location carries
`equipment: EquipmentKind[]`, and eligibility is the subset test
`required.every((k) => owned.includes(k))`. All 117 catalog records are
re-tagged - the 46 planner-reachable slugs by hand, the rest derived
from the old field. Also replace the boolean `hasDumbbells` and the
global `excludedExerciseSlugs` on `PersonalizationProfile` with a
first-class `Location` entity (immutable id, user-typed name,
per-location exclusions). A profile references exactly one `Location`,
and that reference is the only copy of "which place am I in" - no
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



## 2026-08-10 - Derive player progression from completion history

Decision: Persist one validated `workout_completions` row per local completion date and derive total XP, level, rank, current streak, weekly count, and the next plan-day index from the full ordered history.

Alternative rejected: Store a separate mutable progress summary or quest-cursor row beside completion history.

Why: A second row could drift from the claims that produced it and would require transactional repair paths. The local-date primary key plus `INSERT OR IGNORE` makes rewards idempotent, while recomputing the small local history keeps SQLite as the single source of truth.