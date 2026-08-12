# Exclude secretCardId from the game:started socket payload type, GameSnapshotPayload is Game and GamePlayer[] so the type promises the whole room both players' secret cards

## Metadata

- Priority: C
- Created: 2026-08-04
- Due: 2026-10-21
- Projects: +backend
- Contexts: @sev3, @security

## Task

```todo.txt
(C) 2026-08-04 Exclude secretCardId from the game:started socket payload type, GameSnapshotPayload is Game and GamePlayer[] so the type promises the whole room both players' secret cards +backend @sev3 @security due:2026-10-21 note:projects/tuxedo-tasks/exclude-secretcardid-from-the-game-started-socket-payload-type.md
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

Make the payload type exclude `secretCardId` so the compiler rejects a snapshot
that carries it. The correct channel for that field is `game:your-card`, which
already targets a single socket.

This is a type-level change with no runtime behaviour change today, which is
precisely the point — it converts a property currently held by accident into one
the compiler enforces.

`@sev3` because there is no reachable exploit in the current code. The related
`GET /api/games/:id` ticket is the same field genuinely exposed, and is `@sev1`.

### Acceptance

- `GameSnapshotPayload` cannot carry `secretCardId`.
- Constructing a `game:started` payload from a freshly-read game with secret
  cards set fails to compile.
- `game:your-card` still delivers the field to its own player.

### Related

Found on 2026-08-04 during a backend audit, alongside the REST leak of the same
field. Fixing the REST one does not fix this, and vice versa.
