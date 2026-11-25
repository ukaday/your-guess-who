# Make game start a conditional DB transition and deliver state as a self-snapshot to every socket joining the room, room arrival currently triggers the start so a lost race can leave a player in a dead lobby

## Metadata

- Priority: B
- Created: 2026-07-30
- Due: 2026-11-15
- Projects: +backend
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-07-30 Make game start a conditional DB transition and deliver state as a self-snapshot to every socket joining the room, room arrival currently triggers the start so a lost race can leave a player in a dead lobby +backend @sev2 @bug due:2026-11-15 note:projects/tuxedo-tasks/make-game-start-atomic-against-concurrent-join.md
```

## My notes

### The defect

`onGameJoin` answers "are both Players here?" by calling
`io.in(roomName).fetchSockets()` and counting user ids. The transport holds
domain state. `Game.status` is already the authority and is never consulted for
this.

Two consequences:

- **The race.** Two joins interleave, both read a `LOBBY` Game, both decide
  `START`, and `activateGame` runs twice — three sequential un-transacted writes,
  the second run overwriting the first's Secret cards.
- **The trigger is wrong in principle.** Start fires when a *second socket enters
  a room*, not on a state transition. A second browser tab, a reconnect during
  `LOBBY`, or a slow client all change the answer.

### The trap in the obvious fix

Replacing the trigger with a conditional `updateMany where status = LOBBY` closes
the race and breaks delivery.

Room arrival is load-bearing today for a reason that is easy to miss: both
sockets must already be in the room to receive the `game:started` broadcast. Move
the trigger to the database and Player A can win the transition before B's socket
has joined — B misses the broadcast and sits in a dead lobby with no way to learn
the Game began.

Fixing the race without fixing delivery trades a rare corruption for a common
hang.

### What to build

Separate the transition from the delivery.

- **Transition** is a conditional update inside a transaction:
  `updateMany({ where: { id, status: 'LOBBY' }, data: { status: 'ACTIVE', ... } })`.
  `count === 1` means this call started the Game; `count === 0` means another
  already did. Secret cards and the first Player are assigned in the same
  transaction.
- **Delivery** is unconditional: every socket joining the room is sent the
  current state, addressed to itself, always. On top of that, whoever wins the
  transition broadcasts `game:started` to the room.

Two independent mechanisms, each covering the other's gap. Nothing depends on
*winning* the race to receive state.

### Why this simplifies rather than adds

`decideJoinOutcome` currently branches `REJECT` / `REVEAL_CARD` / `WAIT` /
`START` — reconnect, first join, second join, and a mid-Game refresh are four
different code paths producing four different emission patterns. Under the new
shape they are one path: join the room, then send this socket what it should be
looking at.

Room membership becomes what it should have been throughout — a delivery detail
recording who is currently listening, with no authority over Game state.

### Blocked by

The `GameView` projection module. The self-snapshot is a `GameView`, and building
it from Prisma rows would leak both Players' Secret cards to each socket.

### Decisions (2026-11-13)

Settled in a design session. Where these differ from "What to build" above,
these win.

- **Blocker cleared.** The `GameView` projection exists
  (`src/payloads/game-view.ts`).
- **Trigger.** Every `game:join` may attempt the start. The socket joins the
  room first, then distinct Users in the room are counted — join-then-count, so
  two simultaneous joins both see two Players instead of both waiting.
- **Start condition.** Status `LOBBY`, exactly two `GamePlayer` rows, both
  Players in the room. A Game does not start with one Player connected. Room
  membership gates *when a start is attempted*; `Game.status` alone says whether
  the Game has started, and the conditional update makes the start happen once.
  Consequence: the shared Socket.io adapter ticket stays a correctness
  dependency before running more than one task.
- **Transition.** One function in `services/games.ts`, one `$transaction`: the
  conditional `updateMany` on `status: 'LOBBY'`, then both `secretCardId` writes
  only when `count === 1`. Returns whether this call started the Game. Secret
  cards and first Player are picked before the transaction.
- **Delivery.** New `game:state` event carrying `GameView`. Sent to the joining
  socket in every status (`LOBBY`, `ACTIVE`, `FINISHED`), and to every socket in
  the room, each its own view, when a start succeeds.
- **Contract.** `game:started` and `game:your-card` are removed — a departure
  from the broadcast described above. `status` moving from `LOBBY` to `ACTIVE`
  in `game:state` is the start signal. `GameView` gains
  `winnerId: string | null`.
- **Join decision.** Split in two during implementation, because the checks run
  on opposite sides of `socket.join`. `decideJoinOutcome(game, userId)` returns
  `REJECT` (not a Player of the Game) or `JOIN`, before the join, so a
  non-Player never sits in the room and receives broadcasts.
  `shouldStartGame(game, userIdsInRoom)` runs after the join, so two
  simultaneous joins both see each other. The "Already connected" reject is
  gone; a second socket for the same User joins and gets a snapshot.
- **Handler order.** Read and reject non-Players, join the room, send this
  socket its `game:state`, attempt the transition on `JOIN_AND_START`, and if it
  started, re-read the Game and send every socket in the room its own
  `game:state`.
- **Failure.** A failed start rolls back, the Game stays `LOBBY`, the joiner
  gets `game:error` from the guard, and a retried `game:join` attempts the start
  again. No cleanup or eviction.
- **"Board state the server owns"** means the `GameView`. Eliminations are
  client-side until the `GamePlayerCard` ticket lands.
- **`game:opponent-reconnected`** is unchanged for joins to an `ACTIVE` Game.
- **Tests.** Exactly-once is proven on the service function with `Promise.all`
  against the Postgres test database. Socket tests cover delivery. The race
  test lives in `tests/socket/game-handler.test.ts`, not a file of its own:
  Vitest runs files in parallel and `resetDb` wipes every table, so a second
  database-backed file would delete the other's rows mid-test.
- **Filed separately.** The `joinGame` Invite-code race
  (`joingame-race-lets-a-third-player-into-a-game.md`) — this ticket only
  refuses to start a Game without exactly two Players — and the spurious
  connect/disconnect notices with two sockets per User
  (`opponent-connection-notices-fire-per-socket-not-per-player.md`).

### Acceptance

- Two simultaneous joins start the Game exactly once.
- Secret cards are written in the same transaction as the status change.
- A socket joining an `ACTIVE` Game receives current state without relying on a
  broadcast.
- The Player who did not trigger the transition still learns the Game started.
- A mid-Game refresh restores the Board state the server owns.
- `Game.status`, not room membership, decides whether a Game has started.

### Related

Widened on 2026-08-11 from "make game start atomic". The deep game module that
would have restructured this code is deferred, so this is the version that ships.

The shared Socket.io adapter ticket becomes a pure delivery change once this
lands — room membership no longer carries domain meaning, so scaling past one
task stops being a correctness risk.

Surfaced on 2026-10-08 by the socket handler guard fix (the (A) ticket on socket
handlers that void their promises). A failure inside `startGame` now reaches the
joiner as `game:error` instead of crashing the process, but nothing undoes the
join, and what the Players see afterwards depends on where it failed:

- **Before any write** (for example `selectSecretCards` throws): the Game stays
  `LOBBY`, the joiner stays in the room, and a retry is rejected with "Already
  connected to this game" because `decideJoinOutcome` lets room membership
  decide.
- **Partway through `activateGame`**, which is three un-transacted writes that
  set the status to `ACTIVE` first and the two secret cards after: the Game is
  already `ACTIVE`, so a retry takes the `REVEAL_CARD` branch, which runs before
  the room check and emits `game:your-card` with a `secretCardId` that may still
  be null. `game:started` was never broadcast, so the waiting Player is stuck
  too.

The unified join path above should make both cases recoverable. Worth an
acceptance check: a failure during start must not strand either Player.

Noted on 2026-10-10: the `game:started` payload slice (C) routes the emit through
the projection but deliberately keeps emitting the stale pre-`activateGame` copy.
Emitting fresh state after the transition is this ticket's job.
