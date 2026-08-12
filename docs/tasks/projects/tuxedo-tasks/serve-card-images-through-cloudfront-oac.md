# Serve card images through CloudFront with an Origin Access Control and deliver a same-origin path instead of imageKey, no read path exists anywhere so no card image can render

## Metadata

- Priority: C
- Created: 2026-08-11
- Due: 2026-09-08
- Projects: +infra
- Contexts: @sev3, @feature

## Task

```todo.txt
(C) 2026-08-11 Serve card images through CloudFront with an Origin Access Control and deliver a same-origin path instead of imageKey, no read path exists anywhere so no card image can render +infra @sev3 @feature due:2026-09-08 note:projects/tuxedo-tasks/serve-card-images-through-cloudfront-oac.md
```

## My notes

### The gap

`services/images.ts` presigns a `PutObjectCommand` and nothing else. There is no
`GetObjectCommand` anywhere in `backend/src`, and `StorageStack` sets
`blockPublicAccess: BLOCK_ALL`.

Card payloads carry `imageKey` — `cards/<userId>/<uuid>` — an internal S3 key
from which no client can derive a fetchable URL. The write half of the image
pipeline is complete; the read half was never built.

No Card renders. The Board does not work.

### Why this is `@feature` and not `@bug`

Nothing is broken, because nothing is built — there is no client to fail. Under
the matrix, severity for a `@feature` is the impact of its absence, and the
absence here costs every Player every Game. That is `@sev3`, which the matrix
caps at (C).

The letter understates the urgency, and that is the system working as designed:
the date carries it. This must land well before the frontend image-upload flow,
which would otherwise be built against a payload field that cannot be rendered.

### The decision

Recorded in `docs/adr/0001-card-images-served-via-cloudfront-oac.md`. Summary:
serve through the existing CloudFront distribution with an Origin Access
Control, so the bucket stays `BLOCK_ALL` and CloudFront is its only reader.

Presigned GET was rejected because URL expiry becomes a Game-length constraint —
a Board loaded at the start of a long Game goes blank when the URLs die, and
every reconnect re-signs every Card. A backend endpoint streaming the bytes was
rejected outright: every image, every Board load, both Players, through a single
ECS task, uncacheable.

For the MVP a Card image is unadvertised, not secret. Guessing is not a threat at
two UUIDs of entropy, but a shared URL stays valid indefinitely. Making them
secret is a separate ticket and deliberately post-MVP.

### What to build

A CloudFront behaviour for the images bucket on the distribution that already
exists, fronted by an OAC, with the bucket policy that admits it. Card payloads
stop carrying `imageKey` and start carrying a path the client can request
same-origin.

Where that path is produced matters: it belongs in the projection module, not
sprinkled at each site that returns a Card. `imageKey` should not leave the
backend at all once this lands.

### Blocked by

The `GameView` projection module. Card payloads are built from Prisma rows today,
and this ticket changes what a Card looks like on the wire — that decision needs
one home before it is made.

### Acceptance

- The images bucket still blocks all public access.
- A Card payload contains no `imageKey`.
- A Card image loads in a browser from the path the payload carries.
- No image bytes pass through the backend.
- The path is produced in exactly one place.

### Related

The signed-cookies ticket is the post-MVP follow-up and depends on this one. Same
distribution, same payload shape, so it is additive rather than a rewrite — which
is the reason shipping OAC first does not have to be undone.
