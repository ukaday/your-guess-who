# Parse all REST bodies and socket payloads with zod at the seam and enforce the configured max card and deck name lengths, socket payloads are never inspected at all today

## Metadata

- Priority: C
- Created: 2026-07-30
- Due: 2026-10-01
- Projects: +backend
- Contexts: @sev3, @security

## Task

```todo.txt
(C) 2026-07-30 Parse all REST bodies and socket payloads with zod at the seam and enforce the configured max card and deck name lengths, socket payloads are never inspected at all today +backend @sev3 @security due:2026-10-01 note:projects/tuxedo-tasks/parse-rest-and-socket-payloads-at-the-seam.md
```

## My notes

### The gap

Seven route handlers do the same thing:

```
const { deckId } = req.body as { deckId: string }
```

`as` is an assertion, not a check. TypeScript is told the field exists; nothing
verifies it. At runtime that value can be `undefined`, a number, an object, or a
four-megabyte string, and every handler downstream believes the type.

Socket payloads are worse — they are not inspected at all. `game:guess` takes
`payload.cardId` straight from the wire.

The request contract is enforced by the client behaving well.

### Why this is the seam ticket, not a validation ticket

Framing this as "add zod" scopes it to REST bodies. Framing it as the seam
brings in three things that otherwise have nowhere to live:

- **Socket payloads.** Same untrusted input, no coverage today.
- **Configured bounds.** Max Card and Deck name length and image pixel size
  belong in backend config per the project conventions, and the parse site is
  where they are applied.
- **The `imageKey` prefix rule.** Rejecting an `imageKey` outside the caller's
  own `cards/<userId>/` prefix is a validation rule tracked separately with no
  home in the current code. It is a schema concern.

### What to build

One module that parses at the seam and hands handlers values that are already
typed, in range, and trusted. Handlers stop casting.

Schemas stay **server-side**. They are runtime values, and the contract crossing
to the frontend is types-only by decision — sharing them is what would force an
expensive workspace shape for no benefit, since the server must validate
regardless. The client enforces its own input limits for UX and treats the
server's 400 as the authority.

### Blocked by

Nothing. Can start immediately. It does not depend on the shared contract
package, precisely because the schemas do not cross.

### Acceptance

- No `req.body as` cast remains in `backend/src/routes`.
- Every socket payload is parsed before the handler reads it.
- A request violating a bound is rejected with a 400 naming what was wrong.
- Bounds read from backend config, not from the parse site.
- A malformed socket payload does not reach a service.

### Related

Widened on 2026-08-11 from "add zod validation on all REST bodies". The
`imageKey` prefix ticket stays separate — it is a specific rule, this is the
place it will live.
