# Reject imageKey values outside caller's own cards/<userId>/ prefix on card create

## Metadata

- Priority: C
- Created: 2026-07-30
- Due: 2026-09-08
- Projects: +backend
- Contexts: @sev3, @security

## Task

```todo.txt
(C) 2026-07-30 Reject imageKey values outside caller's own cards/<userId>/ prefix on card create +backend @sev3 @security due:2026-09-08 note:projects/tuxedo-tasks/reject-imagekey-values-outside-caller-s-own-cards-userid-prefix-on-card-create.md
```

## My notes

### The defect

`services/cards.ts` checks ownership of the **deck** and nothing else:

```
const deck = await prisma.deck.findFirst({ where: { id: deckId, ownerId: userId } })
if (!deck) return null
return prisma.card.create({ data: { name, imageKey, deckId } })
```

`imageKey` arrives from `req.body` in `routes/cards.ts` and is written verbatim.
`services/images.ts` is the only thing that mints keys, always as
`cards/${userId}/${randomUUID()}`, and nothing checks that a submitted key came
from there.

Route is `POST /api/decks/:deckId/cards`.

### Why `@sev3` and not `@sev1`

Graded `@sev1` on 2026-08-04 from the ticket title, then corrected after reading
the code. Not exploitable today:

- **No read path exists.** `services/images.ts` presigns `PutObjectCommand`
  only. There is no `GetObjectCommand` and no download presign anywhere in
  `src/`. Nothing ever turns a stored `imageKey` into a fetchable URL.
- **Keys are not guessable** — `cards/<cognito-sub>/<uuid-v4>`, two random
  UUIDs.
- **Bucket is `BlockPublicAccess.BLOCK_ALL`**, so a stored key cannot be fetched
  out of band either.

A caller can store a pointer to another user's object. Nothing in the system
will follow it. That is the `@sev3` line — a real gap with no reachable exploit.

### Why the due date sits ahead of the letter

The defect arms itself the moment a read path lands, and the read path arrives
with the card image upload flow. Fixing it while the exploit is unreachable
costs a couple of hours; fixing it afterwards means auditing whatever already
consumed the keys.

`due:` carries that constraint, the letter carries the severity, and here they
disagree on purpose. This is the backlog's one worked example of that split.

### Put the check on the write side

Not the read side. `services/games.ts` returns
`deck: { include: { cards: true } }` to **both** players, which is correct — a
Guess Who board is the same deck for everyone, so the non-owner legitimately
receives and renders the owner's `imageKey` values.

Possession of a key is therefore not evidence of owning it, and a read-time
"does this key start with your prefix" test would break normal play. The only
point where the distinction is knowable is card create, where the caller is
claiming the key as their own.

### Acceptance

- Card create rejects an `imageKey` outside `cards/<callerId>/`.
- The prefix derives from the authenticated user, never from the request.
- A key minted by `/api/images/upload-url` for the caller is accepted.
- Rendering another player's deck in a game still works.

hello
