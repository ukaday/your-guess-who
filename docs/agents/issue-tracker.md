# Issue tracker: todo.txt + tuxedo

Work for this repo is tracked in `todo.txt` at the repo root, in todo.txt
format, managed with [tuxedo](https://github.com/). Completed tasks are
archived to `done.txt`.

## Anatomy of a task line

    (B) 2026-08-02 Port backend to ECS Express Mode +infra @ready-for-agent
    due:2026-08-09 note:projects/tuxedo-tasks/port-backend-to-ecs-express-mode.md

- `(A)`–`(D)` — priority. Criteria are defined in `CLAUDE.md`; they encode the
  current phase of the project, not generic urgency.
- Bare date after the priority — creation date.
- `+project` — `+backend`, `+frontend`, `+infra`, `+cicd`.
- `@context` — topic tags (`@security`, `@blocker`) and triage state
  (see `triage-labels.md`).
- `due:YYYY-MM-DD` — the backlog is worked in due-date order.
- `note:<path>` — relative paths resolve under tuxedo's `notes_dir`.

## Where notes live

Relative `note:` paths resolve under tuxedo's `notes_dir`, which is configured
in `~/.config/tuxedo/config.toml` — **machine-local, not checked into this
repo**. For this repo it points at `docs/tasks/`, so:

    note:projects/tuxedo-tasks/<slug>.md
      → docs/tasks/projects/tuxedo-tasks/<slug>.md

`projects/tuxedo-tasks` is tuxedo's built-in default subdirectory for
generated notes. Because `notes_dir` is absolute and machine-local, an agent
cannot discover it by reading the repo — assume the path above.

## Ticket detail files

tuxedo generates the note file from the task line.

**A `note:` token on the line always wins.** tuxedo checks for one first and
uses that path verbatim. Only when the line has no `note:` does tuxedo derive a
filename itself, by stripping the priority, created date, `+projects`,
`@contexts`, and every `key:value` token, then lowercasing what remains and
collapsing each run of non-alphanumeric characters to a single `-`:

    (A) 2026-07-30 Reject imageKey values outside caller's own
    cards/<userId>/ prefix on card create +backend @security due:2026-08-23

    → reject-imagekey-values-outside-caller-s-own-cards-userid-prefix-on-card-create.md

That derivation is why existing filenames are long and verbose. When adding a
task, write the `note:` token explicitly so the path is known and stable —
otherwise tuxedo will generate its own on first use and you may end up with two
files for one task.

Generated shape:

    # <task body>

    ## Metadata

    - Priority: B
    - Created: 2026-08-02
    - Due: 2026-08-09
    - Projects: +infra
    - Contexts: @ready-for-agent

    ## Task

    ```todo.txt
    <the exact todo.txt line>
    ```

    ## My notes

Every `## Metadata` field is conditional — emitted only when the task line
carries it, always in the order above. Two further fields appear when relevant:
`ClickUp` / `ClickUp status` from `clickup:` / `clickup_status:` tokens, and
`URL` from the first bare `http://` or `https://` token on the line.

The file ends at `## My notes`, which is empty on generation. All long-form
ticket content goes there.

Keep `## Metadata` and `## Task` in sync with the `todo.txt` line — the line is
authoritative, the note is derived.

## Specs

A spec (PRD) covering multiple tickets goes in `docs/specs/<feature-slug>.md`.
Each ticket it spawns gets a `todo.txt` line plus a note file whose
`## My notes` section links back to the spec.

## When a skill says "publish to the issue tracker"

Append the task line to `todo.txt`, then create the matching note file under
`docs/tasks/projects/tuxedo-tasks/` and add the `note:` attribute to the line.

## When a skill says "fetch the relevant ticket"

Read the `todo.txt` line, then the file its `note:` attribute points at.

## Never mark tasks complete

Do not prefix lines with `x`, do not set a completion date, and do not move
entries to `done.txt`. Closing a task is the repo owner's call, always — even
when the work is finished and verified. Report that it's done and leave the
line alone.

## Wayfinding operations

Used by `/wayfinder`. tuxedo has no concept of these fields — they are added by
hand to a note's `## Metadata` and are never generated.

- **Map**: `docs/specs/<effort>/map.md` — the Notes / Decisions-so-far / Fog
  body.
- **Child ticket**: a `todo.txt` line with a note file, plus `Type:`
  (`research` / `prototype` / `grilling` / `task`) and `Status:`
  (`claimed` / `resolved`) added to the note's `## Metadata`.
- **Blocking**: a `Blocked by:` line in `## Metadata` listing note slugs. A
  ticket is unblocked when every note it lists is `resolved`.
- **Frontier**: open, unblocked, unclaimed tickets; earliest `due:` wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set
  `Status: resolved`, then append a context pointer (gist + link) to the map's
  Decisions-so-far in `map.md`.
