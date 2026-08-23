# Contributing to the Docs

This guide explains **when** and **how** to keep `docs/` accurate so the
documentation never silently drifts from the code.

## Why this exists

The docs exist so anyone, including a future AI agent, can answer "what is
this code and why is it shaped this way?" without re-reading 30k lines. That
only works if docs are updated **in the same changeset** as the code they
describe. A stale doc is worse than no doc.

## The docs map

| File | Keep updated when... |
| :--- | :--- |
| `README.md` (this folder) | Adding/removing a doc file; the index table changes |
| `architecture.md` | The stack, layers, request flows, deployment, or invariants change (new service, new layer, new infra) |
| `server-layer.md` | Adding/renaming/removing a server fn, Nitro route/task, auth/RBAC logic, AI behavior |
| `client-layer.md` | Adding/renaming/removing hooks, stores, the repository layer, routing, key components/libraries |
| `data-model.md` | Any schema change (table, column, index, constraint) or new migration |
| `architecture-decisions.md` | A significant decision is made (see "Writing an ADR" below) |
| `file-reference.md` | **Any** file is added, renamed, moved, or deleted |

`file-reference.md` is the safety net: it should always match the repository
exactly, so a change that touches code always touches at least that one doc.

## When to update (checklist by change type)

- **New or changed server function** → `server-layer.md` §6 (add a row to the
  relevant module table or the per-fn bullet list) + `file-reference.md`.
- **Schema / migration change** → `data-model.md` (table/column/index row +
  the migration table) + `file-reference.md` (if a migration file was added).
- **New hook, store, or query key** → `client-layer.md` (stores table,
  hooks list, or query section) + `file-reference.md`.
- **New route or component** → `file-reference.md` (route table / component
  section). Only touch `client-layer.md` if the route adds a new *pattern*.
- **New dependency or infra change** → `architecture.md` (stack table,
  diagram, deployment section).
- **Behavioral decision** → fold it into the narrative of the relevant layer
  doc (see "Documenting decisions" below); add an ADR only for truly
  foundational, hard-to-reverse choices.

## Documenting decisions

Prefer **cohesive narratives over decision stubs**: when a change introduces
a new pattern (say, a shared pipeline or a new deployment flow), explain it
in the layer doc where the code lives — with a short "why" so the next reader
understands the intent without archaeology. Keep the story in one place
rather than scattering it across numbered records.

The exception is `architecture-decisions.md`: it stays as the historical
record of *foundational* decisions (backend choice, auth model, optimistic
journal design). Add a new entry there only when a decision is:
- architectural (changes how layers interact), and
- expensive or risky to reverse.

For anything smaller, one or two sentences of "why" inside the relevant
layer doc is enough.

If you do write an ADR, keep the numbering and use the same four-part format
as existing entries:

```markdown
## ADR-0XX: <short imperative title>

**Status:** Accepted | Superseded

**Context:** What problem or tension motivated this? (2–4 sentences, include
the option that was rejected and why.)

**Decision:** What was decided, concretely. Name the files/modules involved.

**Consequences:** What it costs or enables. Include tradeoffs and anything a
future reader must know before reversing it.
```

Rules:
- One decision per ADR. Small implementation details do **not** warrant one.
- Reference the code (file paths, function names) so the ADR is verifiable.
- When an ADR is superseded, mark the old one `**Status:** Superseded` and
  link to the new one instead of rewriting history.
- When in doubt: narrative in the layer doc beats a new ADR.

## Conventions

- **Line counts are approximate** (as of a date). When a file's size changes
  materially (a refactor, a split), update its figure, or drop the number if
  it's churn-prone. Never treat them as authoritative.
- **Mark generated files.** Anything produced by a tool
  (`src/routeTree.gen.ts`, `.output/`, `drizzle/meta/`, `pnpm-lock.yaml`) is
  listed so people don't edit it, but never documented in depth.
- **Note legacy leftovers.** Stale/unused artifacts get a short "Legacy
  leftovers" mention (see `file-reference.md`) so nobody assumes they're live.
- **Be concise.** One or two sentences per file/table row. If a row needs a
  paragraph, the code probably needs a comment instead.
- **Prefer "why" over "what".** The file-reference tells you what a file is;
  the ADRs and inline code comments tell you why it exists.
- **Keep relative links valid.** Every `[text](./file.md)` must resolve; run a
  quick check after renaming a doc file.

## Verification

- Docs-only changes don't need `pnpm typecheck` / `pnpm lint`, but if your
  changeset also touches code, run them as usual.
- Before finishing, re-read the section of `file-reference.md` you touched and
  confirm it matches what you actually changed.
- Confirm the docs folder is **not** gitignored (`.gitignore` must not contain
  a `docs` entry), if it is, the documentation will silently never ship.

## Process reminder

Update the docs **in the same commit** as the code change. Docs written a week
later are written from memory and are usually wrong.
