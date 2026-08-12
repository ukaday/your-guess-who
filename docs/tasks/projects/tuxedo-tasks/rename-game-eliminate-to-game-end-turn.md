# Rename the game:eliminate socket event to game:end-turn, the event carries no card id and only advances the turn so its name claims a server-side elimination that does not exist

## Metadata

- Priority: D
- Created: 2026-08-11
- Due: 2026-08-23
- Projects: +backend
- Contexts: @sev4, @chore

## Task

```todo.txt
(D) 2026-08-11 Rename the game:eliminate socket event to game:end-turn, the event carries no card id and only advances the turn so its name claims a server-side elimination that does not exist +backend @sev4 @chore due:2026-08-23 note:projects/tuxedo-tasks/rename-game-eliminate-to-game-end-turn.md
```

## My notes

### The lie

`ClientEvents` declares `'game:eliminate': () => void` — no payload. The handler
reads the game, decides the outcome, writes `activePlayerId`, and emits
`game:active-player-changed`. No card id crosses the seam at any point. The
server never learns which Card was eliminated, or how many, or whether any were.

The event ends a Turn. It eliminates nothing.

### Why this is worth half an hour now

`CONTEXT.md` defines Elimination as a Player ruling a Card out on their own
Board, and Turn as an opportunity to act that ends when the Player says so — a
single Turn may eliminate many Cards, or none. That is real Guess Who: ask a
question, flip down every Card that does not match, then pass.

Elimination stays client-only for the MVP, which is the right call: it is private
by the rules, and the win condition depends only on the Secret card, which the
server already owns. But the current name asserts the opposite, and the frontend
does not exist yet to have learned it. Renaming after a client ships means
renaming across a contract with a live consumer.

Server-side elimination is tracked separately and is a real capability, not a
rename. When it lands it will want `game:eliminate` to mean what it says —
carrying Card ids and no longer advancing the Turn. Leaving the name occupied by
a turn action guarantees a collision at exactly the point the protocol is hardest
to change.

### What to build

Rename the event across the handler registration, the `ClientEvents` type, and
the socket tests. No behaviour change of any kind — same payload shape (none),
same outcome, same emissions.

### Blocked by

Nothing. Can start immediately.

### Acceptance

- No occurrence of `game:eliminate` remains in `backend/`.
- `game:end-turn` produces the same emissions the old event did.
- Existing socket tests pass unchanged apart from the event name.

### Related

Falls out of the domain pass on 2026-08-11. The eliminated-cards persistence
ticket is the capability this rename makes room for; it is already correctly
graded `@sev3 @feature` and needs no change.
