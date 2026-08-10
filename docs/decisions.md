# Decisions

## 2026-08-08 - Keep mobility variants distinct

Decision: Add a `mobility` category and preserve Tai Chi and chair-assisted movements as distinct exercise records.

Alternative rejected: Fold the movements into existing strength categories or cite the PDFs only on similar floor exercises.

Why: The balance, breathing, support, and movement contracts differ from the existing strength exercises. Distinct records preserve searchable names and instructions from every supplied PDF without changing existing exercise mechanics.


## 2026-08-09 - Persist one versioned personalization snapshot

Decision: Generate plans deterministically offline and atomically persist one profile with its versioned plan snapshot in fixed SQLite row `id = 1`.

Alternative rejected: Regenerate on launch, store profile and plan in separate writes, or add accounts, cloud sync, and AI generation.

Why: One statement prevents profile-plan mismatches, explicit regeneration preserves a stable saved plan, and one installation-local profile satisfies the product contract without network state.