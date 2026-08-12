# Enforce a minimum deck size before a game can start, nothing checks card count so selectSecretCards throws on a deck with fewer than two cards

## Metadata

- Priority: B
- Created: 2026-08-04
- Due: 2026-09-26
- Projects: +backend
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-08-04 Enforce a minimum deck size before a game can start, nothing checks card count so selectSecretCards throws on a deck with fewer than two cards +backend @sev2 @bug due:2026-09-26 note:projects/tuxedo-tasks/enforce-minimum-deck-size-before-a-game-can-start.md
```

## My notes

### The gap

`selectSecretCards` in `services/game-logic.ts` throws when handed fewer than
two cards. Nothing upstream prevents that:

- `createGame` checks deck ownership only, never card count.
- `decideJoinOutcome` returns `START` based purely on how many unique players
  are in the room.
- `startGame` calls `selectSecretCards` immediately.

So a one-card deck produces a game that cannot start, and the failure arrives as
a thrown error deep in the socket path rather than a refusal at the point the
player did something invalid.

### Where the real number comes from

`docs/business-requirements.md` is the authority on deck constraints. Read it
before picking a bound — two is what makes `selectSecretCards` not throw, which
is a floor, not a game rule. A real Guess Who board needs enough cards for
elimination to be meaningful, and there is likely an upper bound too.

Per the project conventions, the bound belongs in backend config alongside the
existing max card name length and image pixel size, not inlined at the check
site. There will be at least two call sites — creating a game and starting one —
and they must not disagree.

### Where to enforce it

Rejecting at game creation is the useful place, because that is where the player
can still act on the message. Rejecting only at start means two people are
already waiting in a lobby before anything tells them the deck was never
playable.

Enforcing at creation alone is not sufficient, though: cards can be deleted
between creating a game and starting it. Both points need the check, which is
the argument for the bound living in config rather than being written twice.

### Acceptance

- Creating a game on a deck below the minimum is rejected with a defined status
  and a message naming the requirement.
- Starting a game whose deck has fallen below the minimum is rejected without
  throwing.
- The bound reads from backend config.
- The bound matches `docs/business-requirements.md`.

### Related

This is the cheapest known trigger for the socket-handler crash ticket, but it
is not the fix for it. Closing this leaves the crash mechanism intact for every
other error path; closing the crash ticket leaves one-card decks producing a
confusing `game:error` instead of a clear refusal. Both are worth doing.
