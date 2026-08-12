# Build a GameView projection module so Prisma rows never cross the wire, getGame includes every GamePlayer column so either player can read the opponent secretCardId and win on the next guess

## Metadata

- Priority: A
- Created: 2026-08-04
- Due: 2026-08-22
- Projects: +backend
- Contexts: @sev1, @security

## Task

```todo.txt
(A) 2026-08-04 Build a GameView projection module so Prisma rows never cross the wire, getGame includes every GamePlayer column so either player can read the opponent secretCardId and win on the next guess +backend @sev1 @security due:2026-08-22 note:projects/tuxedo-tasks/get-game-returns-both-players-secret-cards.md
```

## My notes

### The exploit

`getGame` in `services/games.ts` reads:

```
prisma.game.findFirst({
  where: { id: gameId, players: { some: { userId } } },
  include: { players: true, deck: { include: { cards: true } } },
})
```

`include: { players: true }` selects every scalar column on `GamePlayer`, and the
schema declares `secretCardId String?` among them. There is no `select` narrowing
anywhere in the file. The route hands the result straight to `res.json(game)`.

So any Player in a started Game can call `GET /api/games/:id`, read
`players[].secretCardId` for their opponent, and submit it as their first guess.
`decideGuessOutcome` compares exactly that field, so the guess wins.

Membership is the only precondition, and being a member is the normal state of
every participant. One request, guaranteed win, every Game.

### Why the fix is a module and not a `select`

Narrowing that one query closes this instance. It does not close the class, and
the class has three members:

- `GET /api/games/:id` — leaks the opponent's Secret card today.
- `game:started` — the payload type is `Game & { players: GamePlayer[] }`, so it
  promises the same field to the whole room. It emits nulls at runtime only
  because `startGame` builds the payload from the copy of `game` read *before*
  `activateGame` wrote the Secret cards. The array is stale in exactly the way
  that happens to be safe. That is luck, not design.
- `game:your-card` — correct.

Confidentiality is decided independently at three sites and gets it wrong at two.
Nothing in the codebase answers the question "what may this Player see?", so the
database schema is the wire contract by default and every column added to
`GamePlayer` publishes itself.

### What to build

One projection module that is the only thing allowed to construct a wire payload.
`Game`, `GamePlayer`, and `Card` never cross it. `GameView` carries the
requesting Player's own Secret card and nothing of the opponent's.

Prefer an explicit `select` over `include` for anything touching `GamePlayer`.
`include` is open by default, which is the mechanism that made this a leak rather
than a decision.

The type should make the leak fail to compile, not merely be absent at runtime —
`GameView` has no field an opponent's Secret card could occupy.

### Blocked by

Nothing. Can start immediately, and several things wait on it.

### What waits on this

- **The npm workspace.** `packages/contract` cannot be born holding Prisma's
  generated types, and today's payloads are made of them. `GameView` is what
  severs that.
- **Card images through CloudFront.** That ticket changes what a Card looks like
  on the wire; the decision needs one home before it is made.
- **Game start transition and delivery.** The self-snapshot sent to each joining
  socket is a `GameView`.

### Acceptance

- `GET /api/games/:id` never returns another Player's Secret card.
- The requesting Player can still learn their own.
- `game:started` carries no Secret card for anyone.
- A test asserts the opponent's Secret card is absent from an `ACTIVE` Game
  response.
- Constructing a wire payload from a freshly-read Game with Secret cards set
  fails to compile.
- No route serialises a Prisma row directly.

### Related

Widened on 2026-08-11 from "stop returning the opponent's secretCardId". The
separate ticket for excluding `secretCardId` from the `game:started` payload type
is fully absorbed by this one and can be closed.

Note this is a different shape from the `imageKey` ticket, which was graded
`@sev1` on assumption and corrected to `@sev3` after reading the code. This one
was verified before filing: the field is in the schema, the query does not narrow
it, and the route serialises the whole object.
