---
id: apps-desktop-exercise-browser
source: apps/desktop/src/ExerciseBrowser.tsx
updated: 2026-08-10
depends_on: [apps-desktop-data-exercises, apps-desktop-app]
status: current
---

## Purpose
Renders the Skill Archive as filterable Skill Record panels and expands one record at a time into its demo video, instructions, tips, muscles, and sources.

## Contract

```ts
interface Props {
  categories: Category[];
  exercises: Exercise[];
}

export function ExerciseBrowser({ categories, exercises }: Props): React.JSX.Element;
```

## Behavior
1. Renders every exercise passing the category, equipment, and difficulty filters and preserves the result count.
2. Category controls use System tabs; equipment and difficulty use compact filter chips. Every control exposes selection through `aria-pressed`.
3. Equipment filtering matches records whose `requires` includes the selected `EQUIPMENT_KINDS` value; difficulty uses exact equality.
4. At most one Skill Record is expanded; clicking its toggle again closes it.
5. An expanded record converts a supported YouTube watch URL to `https://www.youtube.com/embed/<id>`.
6. Missing or unsupported video URLs render `No video yet.` and empty `sourceRefs` omit the sources line.
7. Equipment and difficulty remain text badges; difficulty is not mapped to player rank.
8. No database or Tauri calls; all inputs arrive through props.

## Invariants
- Filter state is local and never mutates the supplied catalog.
- The raw video URL is never used as iframe `src`; only the extracted 11-character id is embedded.
- Exercise order follows the `exercises` prop.
- Empty results preserve every filter control.

## Gotchas
- The equipment filter is approximate for the 71 exercises outside the planner pools: their furniture and floor needs are not modelled. See [[apps-desktop-data-exercises]].
- The iframe loads from `youtube.com` on expand. The app works offline except that the player area stays blank.
- Embedding depends on the uploader's settings. A video with embedding disabled renders a YouTube error inside the frame, and the app cannot distinguish that from a working player.
- The `<video>` element for self-hosted files was removed; adding a non-YouTube URL to the catalog makes that record render `No video yet.`

## Related
[[apps-desktop-data-exercises]]
[[apps-desktop-app]]
