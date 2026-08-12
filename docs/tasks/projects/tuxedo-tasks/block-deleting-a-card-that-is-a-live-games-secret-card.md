# Block deleting a card that is a live game's secret card, GamePlayer_secretCardId_fkey is ON DELETE SET NULL so the deck owner can silently make an in-progress game unwinnable

## Metadata

- Priority: B
- Created: 2026-08-04
- Due: 2026-09-29
- Projects: +backend
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-08-04 Block deleting a card that is a live game's secret card, GamePlayer_secretCardId_fkey is ON DELETE SET NULL so the deck owner can silently make an in-progress game unwinnable +backend @sev2 @bug due:2026-09-29 note:projects/tuxedo-tasks/block-deleting-a-card-that-is-a-live-games-secret-card.md
```

## My notes

### The defect

`deleteCard` in `services/cards.ts` authorises on deck ownership and nothing
else. There is no check for whether the card is in use by a running game.

The migration declares:

```sql
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_secretCardId_fkey"
  FOREIGN KEY ("secretCardId") REFERENCES "Card"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

So the delete succeeds and quietly nulls `secretCardId` on any `GamePlayer` row
holding that card.

The deck owner is always a player in games using their deck — `createGame`
requires `ownerId: userId` — so this is reachable by a participant in the game
being corrupted.

### Why it is silent

Two downstream reads assume the secret card is present, and neither fails
loudly.

`decideGuessOutcome` in `services/game-logic.ts` compares
`opponent.secretCardId === cardId`. With `secretCardId` null, no guess can ever
match. Every guess returns `WRONG`, turns keep alternating, and the game can
never be won. No error is raised and nothing in the UI would indicate why.

`decideJoinOutcome` returns `{ type: 'REVEAL_CARD', cardId: player.secretCardId! }`
— a non-null assertion over a nullable column. A player reconnecting after the
deletion receives `game:your-card` carrying `undefined`.

The type already admits the case: `secretCardId: string | null` on both
`JoinDecisionGame` and `GuessDecisionGame`. The `!` is the code overriding a
correct type rather than handling it.

### What to build

Reject the delete when the card is referenced by a game that is not finished,
and return a defined error rather than a generic failure. Deleting a card from a
deck whose games have all finished stays allowed.

Decide deliberately what "in use" means — the natural reading is any `Game` on
that deck whose status is not `FINISHED`, not merely a card currently held as a
`secretCardId`, since a running game's board is the whole deck.

Separately, the `!` in `decideJoinOutcome` should stop asserting away a real
case, regardless of how the delete is fixed.

### Acceptance

- Deleting a card referenced by a non-finished game is rejected.
- The rejection is a defined status, not a 500.
- Deleting a card whose games have all finished still succeeds.
- No `GamePlayer.secretCardId` can transition to null while its game is
  `ACTIVE`.
- `decideJoinOutcome` handles a null secret card rather than asserting.

### Related

Found on 2026-08-04 while checking an unrelated claim about `imageKey`. Sits in
the same code as the deck-delete and orphaned-object tickets; all three are
delete-path defects and are cheapest done together.
