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
