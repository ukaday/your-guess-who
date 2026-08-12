# Delete S3 objects when cards and decks are deleted, deleteCard removes the row and never touches the bucket so every image ever uploaded is retained forever

## Metadata

- Priority: C
- Created: 2026-08-04
- Due: 2026-10-06
- Projects: +backend
- Contexts: @sev3, @bug

## Task

```todo.txt
(C) 2026-08-04 Delete S3 objects when cards and decks are deleted, deleteCard removes the row and never touches the bucket so every image ever uploaded is retained forever +backend @sev3 @bug due:2026-10-06 note:projects/tuxedo-tasks/delete-s3-objects-when-cards-and-decks-are-deleted.md
```

## My notes

### The defect

`deleteCard` in `services/cards.ts` removes the `Card` row and nothing else.
There is no `DeleteObjectCommand` anywhere in `src/` — the only S3 command the
application issues is the `PutObjectCommand` that `services/images.ts` presigns.

Once the row is gone the `imageKey` is gone with it, so the object is not merely
orphaned, it is unreferenced and unfindable through the application. The only
way to identify it afterwards is to diff the bucket against the table.

### Why this is `@bug` and not `@chore`

Distinct from the ECR-lifecycle and log-retention tickets, which are genuinely
`@chore`: those are platform resources accumulating as a byproduct of operations
nobody wrote cleanup code for.

Here someone wrote a delete operation and it does half its job. Afterwards the
database says the card does not exist and the bucket says its image does. Two
stores disagreeing about the same fact is a correctness problem, and the storage
cost is a symptom rather than the defect.

`@sev3` because nothing visible breaks and manual cleanup is possible.

### Note on versioning

`StorageStack` sets `versioned: true` with a 30-day `noncurrentVersionExpiration`
rule. That rule only acts on versions superseded by an overwrite or a delete
marker. Since nothing is ever deleted or overwritten, no version ever becomes
noncurrent and the rule never fires on anything. Deleting objects will start it
working as intended.

### What to build

Delete the object when the card is deleted, and every object in the deck when a
deck is deleted.

Two ordering decisions that should be made rather than fallen into: whether the
S3 delete happens before or after the row delete, and what happens when one
succeeds and the other fails. Deleting the row first and the object second means
a failure leaks an object that can no longer be found; deleting the object first
means a failure leaves a card pointing at nothing.

Neither is obviously correct — pick one, and make the failure mode explicit
rather than incidental. Bulk deletion is worth using for the deck path rather
than issuing one call per card.

The card service currently takes only `prisma`. It will need the S3 client
injected the same way `createImageService` receives it.

### Acceptance

- Deleting a card removes its object from the bucket.
- Deleting a deck removes every object belonging to its cards.
- A partial failure leaves a defined, documented state.
- Tests assert the S3 client is called with the right keys, using an injected
  mock rather than a real bucket.

### Related

Found on 2026-08-04 alongside the deck-delete-500 and secret-card tickets. All
three are delete-path defects in the same two service files; doing them in one
pass is cheaper than three separate visits, though they are tracked separately
because the fixes are independent.
