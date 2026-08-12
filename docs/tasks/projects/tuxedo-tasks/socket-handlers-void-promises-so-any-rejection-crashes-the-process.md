# Socket handlers void their promises with no catch so any rejection becomes an unhandled rejection and kills the single ECS task

## Metadata

- Priority: A
- Created: 2026-08-04
- Due: 2026-08-15
- Projects: +backend
- Contexts: @sev1, @bug

## Task

```todo.txt
(A) 2026-08-04 Socket handlers void their promises with no catch so any rejection becomes an unhandled rejection and kills the single ECS task +backend @sev1 @bug due:2026-08-15 note:projects/tuxedo-tasks/socket-handlers-void-promises-so-any-rejection-crashes-the-process.md
```

## My notes

### The defect

All three registrations in `socket/game-handler.ts` discard the promise without
attaching a rejection handler:

```
void onGameJoin(io, socket, prisma, payload).then(() => ack?.())
void onGameEliminate(io, socket, prisma)
void onGameGuess(io, socket, prisma, payload)
```

`void` suppresses the lint complaint about a floating promise; it does not
handle the rejection. On `game:join` the `.then()` makes it worse — it returns a
*new* promise that also rejects, and that one is discarded too.

Node 22 defaults to `--unhandled-rejections=throw`. An unhandled rejection
raises an uncaught exception, and with no `process.on('uncaughtException')`
handler anywhere in `src/`, the process exits.

The service runs `minTaskCount: 1, maxTaskCount: 1`. One rejection anywhere in a
socket handler takes the whole backend down until ECS replaces the task, and
every in-progress game dies with it because rooms are in process memory.

### Reachable today

`selectSecretCards` in `services/game-logic.ts` throws when the deck has fewer
than two cards, and nothing validates deck size at game creation or at start.
So: create a deck, add one card, create a game on it, have a second account
join. Both sockets enter the room, `decideJoinOutcome` returns `START`,
`startGame` calls `selectSecretCards`, it throws, the process dies.

Registration is open and unrate-limited, so obtaining the second account is not
a barrier.

That is the cheapest trigger, not the only one. Every `await prisma.*` call in
the three handlers is a transient-database-error away from the same outcome — a
connection blip during `game:guess` is indistinguishable, from the process's
point of view, from the crash above.

### What to build

Attach rejection handling at the registration boundary so no handler can escape
it. Handling means: log the error, emit `game:error` to the originating socket,
and leave the process running. A failed guess should cost the player a request,
not the service.

Prefer one wrapper applied to every handler over three separate `.catch()`
calls — the defect is the shape of the registration, and fixing it three times
by hand leaves the fourth handler to reintroduce it.

Consider a `process.on('unhandledRejection')` guard as a backstop, but do not
treat it as the fix. It converts a crash into a silent swallow, which is a
different failure, not an absence of one.

Note the `ack?.()` on `game:join` currently only fires on success, so a client
using `emitWithAck` hangs when the handler fails. That is the same defect seen
from the client side, and overlaps the existing socket-ack-reliability ticket.

### Acceptance

- A handler that throws emits `game:error` and the process stays up.
- A rejected database call in any of the three handlers does not terminate the
  process.
- The ack fires on failure as well as success.
- A test asserts the process survives a handler rejection, rather than asserting
  only the happy path.

### Related

The deck-size gap is tracked separately — it is a business rule worth enforcing
on its own merits, and fixing it alone would close this particular trigger while
leaving the crash mechanism intact.
