# Deleting a deck that has cards returns 500, Card_deckId_fkey is ON DELETE RESTRICT so DELETE /api/decks/:id fails for every non-empty deck and a deck used in any game can never be deleted at all

## Metadata

- Priority: B
- Created: 2026-08-04
- Due: 2026-10-03
- Projects: +backend
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-08-04 Deleting a deck that has cards returns 500, Card_deckId_fkey is ON DELETE RESTRICT so DELETE /api/decks/:id fails for every non-empty deck and a deck used in any game can never be deleted at all +backend @sev2 @bug due:2026-10-03 note:projects/tuxedo-tasks/deleting-a-deck-with-cards-returns-500.md
```

## My notes

### The defect

`deleteDeck` in `services/decks.ts` issues a bare `deck.deleteMany` filtered on
ownership. The schema declares no `onDelete` behaviour anywhere, so the
migration took Prisma's defaults for required relations:

```sql
ALTER TABLE "Card" ADD CONSTRAINT "Card_deckId_fkey"
  FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Game" ADD CONSTRAINT "Game_deckId_fkey"
  FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Postgres refuses the delete, Prisma throws, and the route has no handling for
it. Express 5 forwards the async rejection to `createErrorHandler`, which
returns **500 `{"error":"Internal server error"}`**.

Every deck a player actually built has cards, so the delete endpoint fails for
every realistic input.

The `Game` constraint is the harder half. Clearing the cards first is a
workaround for a fresh deck, but a deck that has ever been used in a game — even
a finished one — can never be deleted at all, because `Game` rows persist.

### What to decide

This is a product question before it is a code change, and the answer should be
deliberate rather than whatever makes the constraint stop complaining.

- **Cards** — should deleting a deck delete its cards? Almost certainly yes; a
  card has no meaning outside its deck.
- **Games** — a finished game references the deck it was played with. Deleting
  the deck either destroys that history, or the deck must be refused, or decks
  need soft deletion so history survives.

Whatever is chosen should be expressed in the schema's referential actions where
it belongs, not worked around with manual multi-step deletes in the service.

### Why the tests did not catch it

`tests/services/decks.test.ts` passes a mocked client (`prisma as never`), so
`deleteMany` returns a stubbed count and no foreign key is ever evaluated. The
unit tests are green against behaviour that fails in Postgres.

Mocked-Prisma unit tests structurally cannot catch referential integrity. This
class of defect needs a test against a real database — the CI workflow already
runs a Postgres service container, so the capability exists.

Worth treating as a general lesson about where the mocking boundary sits, not
just a gap in this one file.

### Acceptance

- Deleting a deck with cards succeeds or fails deliberately, never 500.
- The chosen behaviour for decks referenced by games is explicit and documented.
- Referential actions are declared in the schema with a migration.
- A test exercises deck deletion against a real database, not a mock.

### Related

Found on 2026-08-04. Same code path as the secret-card and orphaned-object
tickets.
