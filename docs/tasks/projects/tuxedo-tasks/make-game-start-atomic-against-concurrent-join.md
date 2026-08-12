# Make game start a conditional DB transition and deliver state as a self-snapshot to every socket joining the room, room arrival currently triggers the start so a lost race can leave a player in a dead lobby

## Metadata

- Priority: B
- Created: 2026-07-30
- Due: 2026-09-01
- Projects: +backend
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-07-30 Make game start a conditional DB transition and deliver state as a self-snapshot to every socket joining the room, room arrival currently triggers the start so a lost race can leave a player in a dead lobby +backend @sev2 @bug due:2026-09-01 note:projects/tuxedo-tasks/make-game-start-atomic-against-concurrent-join.md
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
