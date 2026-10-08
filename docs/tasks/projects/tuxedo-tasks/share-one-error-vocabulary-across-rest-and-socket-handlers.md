# Share one error vocabulary across REST and socket handlers, Game not found is inlined in five socket emits and again in games.ts and game-logic.ts, Internal server error is written separately in error-handler.ts and the socket guard, and the logger type is inlined in error-handler.ts

## Metadata

- Priority: D
- Created: 2026-10-08
- Due: 2027-02-06
- Projects: +backend
- Contexts: @sev4, @chore

## Task

```todo.txt
(D) 2026-10-08 Share one error vocabulary across REST and socket handlers, Game not found is inlined in five socket emits and again in games.ts and game-logic.ts, Internal server error is written separately in error-handler.ts and the socket guard, and the logger type is inlined in error-handler.ts +backend @sev4 @chore due:2027-02-06 note:projects/tuxedo-tasks/share-one-error-vocabulary-across-rest-and-socket-handlers.md
```

## My notes

### Why `@sev4 @chore`

Duplicated strings and a duplicated type. Nothing is broken and nothing is
exposed; the cost is that a wording change or a logger signature change has to
be made in several places and one will be missed. `@sev4` × `@chore` is (D) by
the matrix.

### Found by

The review of the socket handler guard fix (the (A) ticket on socket handlers
that void their promises). That change added `INTERNAL_ERROR_MESSAGE` and the
`ErrorLogger` type in `src/socket/guard-handler.ts` and deliberately left every
older copy alone to stay inside its own ticket.

### What exists today

As of 2026-10-08:

- **Internal server error** — `src/middleware/error-handler.ts:18` writes it for
  REST as `{ error }`. The socket side has its own constant,
  `INTERNAL_ERROR_MESSAGE` in `src/socket/guard-handler.ts`, emitted as
  `{ message }`. Same words, two definitions.
- **Game not found** — five `game:error` emits in `src/socket/game-handler.ts`
  (lines 60, 164, 175, 215, 226), plus `src/routes/games.ts:47` and the `REJECT`
  outcome in `src/services/game-logic.ts:66`. `games.ts:35` is a different
  string, `Game not found or not joinable`.
- **Logger type** — `createErrorHandler` in `src/middleware/error-handler.ts`
  inlines `(err: unknown) => void`. The same shape is exported as `ErrorLogger`
  from `src/socket/guard-handler.ts`, a socket-specific location for a type that
  is not socket-specific.
- **Payload shape** — every `game:error` emit builds `{ message: ... }` inline.

### Scope

Pick one home for user-facing error messages and for `ErrorLogger`, shared by the
REST error handler and the socket layer, and import from it at every site above.
Keep the wire shapes exactly as they are: REST stays `{ error }`, sockets stay
`{ message }`. This is a refactor with no client-visible change.

Do not change what the socket guard does. Its behaviour is covered by
`tests/socket/handler-failure.test.ts`.

### Acceptance

- Each message string is defined once and imported wherever it is used.
- `error-handler.ts` and the socket guard import the same `ErrorLogger`; no
  inline copies of the signature remain.
- Wire payload shapes are unchanged and the existing tests pass untouched.
- Backend coverage thresholds stay at 100%.
