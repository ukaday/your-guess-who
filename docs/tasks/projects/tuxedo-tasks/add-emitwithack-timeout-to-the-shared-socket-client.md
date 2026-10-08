# Add an emitWithAck timeout to the shared Socket.io client so a missing ack surfaces as an error instead of a hang, the server now acks game:join on failure so this is the client half of the ack-reliability fix

## Metadata

- Priority: C
- Created: 2026-07-30
- Due: 2026-12-16
- Projects: +frontend
- Contexts: @sev3, @feature

## Task

```todo.txt
(C) 2026-07-30 Add an emitWithAck timeout to the shared Socket.io client so a missing ack surfaces as an error instead of a hang, the server now acks game:join on failure so this is the client half of the ack-reliability fix +frontend @sev3 @feature due:2026-12-16 note:projects/tuxedo-tasks/add-emitwithack-timeout-to-the-shared-socket-client.md
```

## My notes

### Rescoped on 2026-10-08

This was "Fix socket ack reliability: ack in finally so rejected handlers still
ack, add client emitWithAck timeout" (`+backend @sev3 @bug`). The server half
shipped with the fix for socket handlers that void their promises: every handler
now runs through a per-socket guard, and the guard calls the ack in a `finally`,
so `game:join` acks on failure as well as success, after `game:error` has been
emitted.

What is left is the client half, which belongs with the frontend.

### Why the type changed from `@bug` to `@feature`

Nothing shipped is wrong any more. The server acks. The client that would wait
on that ack does not exist yet, so a timeout is a capability the client being
built has to include, not a defect in anything deployed. `@sev3` is unchanged: a
join that hangs forever leaves a player stuck, with a reload as the workaround.
`@sev3` × `@feature` is still (C) by the matrix, so the priority letter and the
due date did not move.

### No server work left for the other events

`game:eliminate` and `game:guess` declare no ack in `ClientEvents`, so a typed
client cannot `emitWithAck` them, and they answer through broadcasts
(`game:active-player-changed`, `game:guess-wrong`, `game:over`) or `game:error`.
If the client design wants request/response semantics for them, that is a
contract change: declare the ack in `ClientEvents`, call it through the guard,
and add a test. Decide that while building the shared client rather than ahead
of it.

### Scope

- The shared Socket.io client wraps `emitWithAck` with a timeout, so a missing
  ack rejects instead of waiting forever.
- Callers handle that rejection, for example by surfacing an error state.

### Related

Built alongside the shared Socket.io client ticket, which creates the module this
lives in.

### Acceptance

- A `game:join` whose ack never arrives rejects after the timeout.
- The timeout value is a named constant, not inlined at the call site.
- A test asserts the timeout path.
