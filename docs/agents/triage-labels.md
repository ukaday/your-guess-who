# Triage Labels

The skills speak in terms of canonical triage roles. This file maps those roles
to the label strings used in this repo's tracker.

This repo tracks work in todo.txt format, where tags are `@contexts`. Triage
state is therefore an `@context` on the task line, and is mirrored on the
`Contexts:` line of the ticket's note file.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `@needs-triage`      | Maintainer needs to evaluate this issue  |
| `needs-info`               | `@needs-info`        | Waiting on reporter for more information |
| `ready-for-agent`          | `@ready-for-agent`   | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `@ready-for-human`   | Requires human implementation            |

Exactly one triage `@context` per task line. These are orthogonal to topic tags
like `@security`, `@blocker`, and `@cicd`, which may appear alongside them.

## No `wontfix`

The fifth canonical role, `wontfix`, has no label here. This is a local,
single-owner tracker with no external reporters, so there is nobody to signal
the decision to — a task that will not be actioned is simply deleted from
`todo.txt`.

When a skill would apply `wontfix`, do not invent a label. Say the task should
be dropped and let the repo owner delete it. Deleting tasks is their call, the
same as completing them — see "Never mark tasks complete" in
`issue-tracker.md`.

Edit the right-hand column to match whatever vocabulary you actually use.
