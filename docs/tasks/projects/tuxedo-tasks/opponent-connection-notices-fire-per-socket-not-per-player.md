# Emit opponent-disconnected and opponent-reconnected per player not per socket, a user with two sockets in a game makes the opponent see a disconnect when either closes and a reconnect when the second opens

## Metadata

- Priority: D
- Created: 2026-11-13
- Due: 2027-04-11
- Projects: +backend
- Contexts: @sev4, @bug

## Task

```todo.txt
(D) 2026-11-13 Emit opponent-disconnected and opponent-reconnected per player not per socket, a user with two sockets in a game makes the opponent see a disconnect when either closes and a reconnect when the second opens +backend @sev4 @bug due:2027-04-11 note:projects/tuxedo-tasks/opponent-connection-notices-fire-per-socket-not-per-player.md
```

## My notes

### The defect

The game-start ticket (`make-game-start-atomic-against-concurrent-join.md`)
drops the "Already connected to this game" reject, so one User may have several
sockets in a Game's room — a second tab, or a phone and a laptop.

The connection notices in `socket/game-handler.ts` are still per socket:

- `onSocketDisconnect` emits `game:opponent-disconnected` whenever any socket
  with a `gameId` closes, even if the same User has another socket in the room.
- `onGameJoin` emits `game:opponent-reconnected` whenever a socket joins an
  `ACTIVE` Game, even if that User was already connected.

The other Player is told their opponent left while the opponent is still there.

### Severity

`@sev4`: cosmetic. No Game state is affected, and no frontend consumes these
events yet.

### Acceptance

- `game:opponent-disconnected` is emitted only when a Player's last socket
  leaves the room.
- `game:opponent-reconnected` is emitted only when a Player goes from no sockets
  in the room to one.

### Related

Depends on room membership across tasks once the shared Socket.io adapter
ticket lands; the "last socket" check must use the adapter-aware
`fetchSockets`.
