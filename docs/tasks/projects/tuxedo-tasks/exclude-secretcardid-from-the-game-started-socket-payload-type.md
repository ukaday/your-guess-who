# Exclude secretCardId from the game:started socket payload type, GameSnapshotPayload is Game and GamePlayer[] so the type promises the whole room both players' secret cards

## Metadata

- Priority: C
- Created: 2026-08-04
- Due: 2026-10-25
- Projects: +backend
- Contexts: @sev3, @security

## Task

```todo.txt
(C) 2026-08-04 Exclude secretCardId from the game:started socket payload type, GameSnapshotPayload is Game and GamePlayer[] so the type promises the whole room both players' secret cards +backend @sev3 @security due:2026-10-25 note:projects/tuxedo-tasks/exclude-secretcardid-from-the-game-started-socket-payload-type.md
```

## My notes

### The gap

`types/socket.ts` declares:

```
export type GameSnapshotPayload = Game & { players: GamePlayer[] }
```

`GamePlayer` carries `secretCardId`, so the declared contract for `game:started`
includes both players' secret cards, broadcast to the entire room.

### Why it does not leak today

`startGame` builds the payload by spreading the `game` object read at the top of
`onGameJoin`, which happened *before* `activateGame` wrote the secret cards.
Prisma's `update` calls do not mutate that in-memory array, so the emitted
`players` still carry the `null` values the row had while the game was in
`LOBBY`.

The payload is safe because it is stale. Nothing expresses the intent that it
must stay that way.

Any of these turns it into a live leak, none of them obviously wrong in
isolation: re-reading the game after `activateGame` to emit fresh state, having
`activateGame` return the updated rows, or building the snapshot from a helper
that queries rather than reuses.

### What to build

The first slice of the `GameView` projection ticket (A), shipped on its own.
`game:started` gets an explicit wire shape, built by one function that turns the
Game row into the payload. The shape names only what the Board needs:

- Game: `id`, `status`, `activePlayerId`
- Players: `userId`
- Deck Cards: `id`, `name` — no image field until the CloudFront OAC ticket
  defines one

The shape is an allow-list written by hand, not derived from Prisma types, so a
column added to `GamePlayer` does not publish itself. The Secret card's only
channel stays `game:your-card`, which already targets a single socket.

No runtime flow change. `startGame` keeps emitting from the copy of the Game read
before `activateGame`, now routed through the new function. Re-reading after the
transition belongs to the atomic game start ticket (B), which rewrites this flow.

`@sev3` because there is no reachable exploit in the current code. The related
`GET /api/games/:id` ticket is the same field genuinely exposed, and is `@sev1`.

### Decisions

Grilled on 2026-10-10.

- **Slice of (A), not a separate fix.** Ships first; close it when (A) closes.
- **Allow-list, not `Omit`.** `Omit<GamePlayer, 'secretCardId'>` is a deny-list:
  open by default, the same mistake (A) blames on `include`.
- **Minimum fields.** Every field sent is one that must keep being sent. Today's
  emit also spreads the whole Deck in, which the type never declared.
- **No image on the wire yet.** `imageKey` has no read path; shipping it would
  turn the OAC ticket into a contract change instead of an addition.
- **"Fails to compile" dropped.** TypeScript has no exact types, so a full
  `GamePlayer` still fits `{ userId: string }` — the compiler cannot reject a
  snapshot built by spreading a fresh row. Locking construction (a branded type
  only the projection can produce) is left open for (A), where REST adds a
  second construction site.
- **Layer name.** The projection module lives under a `payloads` layer, matching
  the existing `*Payload` type names. Not `views`, which reads as a database
  view.

### Acceptance

- The `game:started` payload type declares no `secretCardId` — asserted by a
  type test.
- A Game whose Players have Secret cards set, run through the projection,
  produces a payload with no Secret card — asserted by a runtime test that feeds
  it fresh state on purpose.
- The payload carries only the fields listed above.
- `game:your-card` still delivers each Player their own Secret card.

### Related

Found on 2026-08-04 during a backend audit, alongside the REST leak of the same
field. Fixing the REST one does not fix this, and vice versa.

First slice of (A), `get-game-returns-both-players-secret-cards.md`.
