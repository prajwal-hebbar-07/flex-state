# Documentation Rules

Docs in this repo are written **for machines first, humans second**. An LLM
with `grep`, `cat`, and no browser must be able to answer any question about
this codebase from `docs/` alone. Optimize for that reader.

## 0. The rule that outranks all others

**Every change to behavior ships with its doc change in the same commit.**
Not the next commit, not "a docs pass later". A PR that changes behavior and
leaves `docs/` untouched is incomplete. If the change is genuinely
doc-invisible (rename of a private local, formatting), say so in one line in
the commit body.

Deletion counts as a doc change. Code dies → its doc dies in the same commit.

## 1. Format

- **Markdown or plaintext only.** No HTML docs, no PDF, no diagram-only
  explanations, no wiki, no screenshots carrying information that isn't also
  in text. If it can't be `cat`'d, it doesn't exist.
- **Flat over nested.** `docs/` is one level deep. Filenames mirror source
  paths with `/` → `-`: `src/core/store.ts` → `docs/core-store.md`.
  Given a source file, the doc path is derivable without a search.
- **No "click here", no "see the UI".** Give the command, the file path, the
  function name, the exact string to grep for. Instructions must be
  executable by something with a shell and no eyes.
- **ASCII by default.** No smart quotes, no em-dash art, no box-drawing
  diagrams. Tables and lists over paragraphs. One fact per line.
- **Stable anchors.** Section headings are fixed vocabulary (see §3) so a
  retrieval step can jump straight to `## Contract` in any file.

## 2. Layout

```
docs/
  index.md          # manifest. every doc listed, one line each. entry point.
  <module>.md       # one per source module, name derived per §1
  decisions.md      # append-only log of why. never edited, only appended.
```

`docs/index.md` is the map. It is the only file allowed to be a list of
links, and it must be complete — a doc not listed in `index.md` is a bug.
Each line: `- [id](file.md) — one-line hook, <=100 chars.`

## 3. Every module doc has this exact skeleton

```markdown
---
id: core-store
source: src/core/store.ts, src/core/store.test.ts
updated: 2026-08-02
depends_on: [core-types, core-subscribe]
status: current | deprecated
---

## Purpose
One paragraph, max 3 sentences. What problem this exists to solve.

## Contract
The public surface. Signature, params, returns, throws. One entry per export.
Copy the real signature — never paraphrase types.

## Behavior
Numbered, declarative statements of what happens. Order matters: state the
happy path first, then each edge case as its own numbered line.

## Invariants
Things that are always true. Anything a caller may rely on. Anything a future
change must not break.

## Gotchas
Non-obvious behavior, footguns, deliberate compromises. Each line names the
consequence, not just the fact.

## Related
[[id]] links to other docs. No prose, just the list.
```

Sections are mandatory and in this order. Empty section → write `None.`
Never delete the heading; the fixed shape is what makes the corpus
traversable.

## 4. Frontmatter is load-bearing

- `source` lets a reader grep from doc → code. Keep it exact and complete.
- `depends_on` is the edge list of the doc graph. Keep it accurate; this is
  how an agent decides what else to read.
- `updated` is bumped on every content change. A doc whose `updated` predates
  its `source` files' last commit is **stale** and must be treated as
  untrusted until reconciled.
- `[[id]]` links use the frontmatter `id`, never a file path or a URL.

## 5. Writing style

- Declarative present tense. "Returns null when the key is absent." Not
  "This function will return null if you pass a key that isn't there."
- No marketing, no hedging, no "simply", no "just", no "note that".
- Define a term once, then reuse that exact token everywhere. Never introduce
  a synonym for something already named — synonyms break retrieval.
- Prefer a code block over a description of code.
- Examples must be runnable verbatim. No `...`, no pseudo-code, no elided
  imports.
- Say the negative explicitly. "Does not retry" is information; silence is not.

## 6. Anti-goals

Do not write: tutorials, onboarding narratives, changelogs (git has them),
architecture essays, restatements of what the code obviously does, or a doc
whose content is `TODO`. A doc that adds no fact beyond the source is worse
than no doc — it's a second thing to keep in sync.

## 7. Maintenance loop

Before finishing any task:

1. `git diff --name-only` → for each changed source file, resolve its doc
   path per §1 and open it.
2. Update `Contract`, `Behavior`, `Invariants` if the change touched them.
   Bump `updated`.
3. New module → new doc + a line in `docs/index.md` + `depends_on` edges
   added on both sides.
4. Deleted module → delete the doc, remove its `index.md` line, and remove
   it from every `depends_on` that named it. Dangling `[[id]]` is a bug.
5. Non-obvious decision made → append one entry to `docs/decisions.md`:
   date, the decision, the alternative rejected, why. Never rewrite an
   existing entry; append a superseding one and link back.

## 8. Stale detection

Anyone (human or agent) may run this and must fix what it prints:

```bash
# docs whose source changed after the doc did
for f in docs/*.md; do
  d=$(grep -m1 '^updated:' "$f" | cut -d' ' -f2)
  for s in $(grep -m1 '^source:' "$f" | cut -d' ' -f2- | tr -d ',' ); do
    [ -f "$s" ] || { echo "DEAD SOURCE $f -> $s"; continue; }
    c=$(git log -1 --format=%ad --date=short -- "$s")
    [ "${c//-/}" -gt "${d//-/}" ] && echo "STALE $f (src $c > doc $d)"
  done
done
```

Treat its output as a failing test.
