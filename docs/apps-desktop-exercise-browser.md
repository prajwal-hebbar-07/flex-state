---
id: apps-desktop-exercise-browser
source: apps/desktop/src/ExerciseBrowser.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-exercises, apps-desktop-app]
status: current
---

## Purpose
Renders the full exercise catalog as a filterable card grid and expands one card at a time into a detail pane holding the demo video, instructions, tips, and sources.

## Contract

```ts
interface Props {
  categories: Category[];
  exercises: Exercise[];
}

export function ExerciseBrowser({ categories, exercises }: Props): React.JSX.Element;
```

## Behavior
1. Renders every exercise in `exercises` that passes the category, equipment, and difficulty filters.
2. The category filter defaults to `null`, meaning all categories.
3. The equipment filter offers `Any` plus one pill per `EQUIPMENT_KINDS` entry, labelled with `EQUIPMENT_LABELS`, and matches an exercise whose `requires` includes the selected kind.
4. The difficulty filter matches on exact equality.
5. At most one card is expanded; clicking the open card's toggle closes it.
6. An expanded card renders a `https://www.youtube.com/embed/<id>` iframe built from the record's `video` URL.
7. A record whose `video` is absent or is not a YouTube watch or `youtu.be` URL renders the text `No video yet.` instead of a player.
8. The sources line is omitted entirely when `sourceRefs` is empty.
9. A card's equipment badge renders every `EQUIPMENT_LABELS` value for that record's `requires`, joined with ` · `.
10. No network, database, or Tauri calls; every input arrives through props.

## Invariants
- The video URL is never rendered as-is in the `src`; only the 11-character id extracted by `YOUTUBE_ID` reaches the iframe.
- Filtering never mutates `exercises`.
- Exercise order is the order of the `exercises` prop.

## Gotchas
- The equipment filter is approximate for the 71 exercises outside the planner pools: their furniture and floor needs are not modelled. See [[apps-desktop-data-exercises]].
- The iframe loads from `youtube.com` on expand. The app works offline except that the player area stays blank.
- Embedding depends on the uploader's settings. A video with embedding disabled renders a YouTube error inside the frame, and the app cannot distinguish that from a working player.
- The `<video>` element for self-hosted files was removed; adding a non-YouTube URL to the catalog makes that record render `No video yet.`

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-app]]
