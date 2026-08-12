# Make card images secret with CloudFront signed cookies, the OAC path is unauthenticated so a card image URL that escapes stays valid forever

## Metadata

- Priority: C
- Created: 2026-08-11
- Due: 2026-11-20
- Projects: +infra
- Contexts: @sev3, @security

## Task

```todo.txt
(C) 2026-08-11 Make card images secret with CloudFront signed cookies, the OAC path is unauthenticated so a card image URL that escapes stays valid forever +infra @sev3 @security due:2026-11-20 note:projects/tuxedo-tasks/make-card-images-secret-with-signed-cookies.md
```

## My notes

### The gap this closes

The OAC ticket deliberately ships Card images as **unadvertised, not secret**:
the CloudFront path is unauthenticated, so anyone holding a URL can fetch it
indefinitely. That was the right MVP trade — guessing is not a threat at two
UUIDs of entropy, and the alternative was blocking the Board on a key-pair setup.

The residual risk is share-based, not guess-based. A URL that escapes — pasted
into a chat, captured in a bug report, left in a browser history on a shared
machine — stays valid forever. Cards are user-uploaded photos, plausibly of real
people the uploader knows, which is what makes an indefinitely-valid public URL
worth closing rather than accepting permanently.

`@sev3 @security` because there is no reachable exploit: nothing is enumerable
and no authorization is bypassed. It is defence in depth on a deliberately
accepted MVP position.

### Why signed cookies rather than signed URLs

One cookie covers a whole Deck. Signed URLs would mean signing every Card on
every Board load and re-signing on every reconnect — the same per-request cost
that ruled out presigned S3 GETs in the first place.

Cookies also keep CloudFront caching intact, which signed URLs undermine by
making every request path unique.

### What to build

- A CloudFront key pair and a trusted key group on the existing distribution.
- A backend endpoint that mints a signed cookie for a Deck the caller is entitled
  to see, scoped by path and given a lifetime that outlasts a plausible Game.
- The images behaviour switched to require the trusted key group.

Entitlement is the part worth thinking about, not the crypto. A Player in a Game
may see every Card in that Game's Deck. A Deck owner may see their own. Nobody
else may see either. That rule is the ticket; the signing is mechanics.

### Blocked by

The CloudFront OAC ticket. Same distribution, same payload shape — this is
additive on top of it, which is why shipping OAC first does not have to be
undone.

### Acceptance

- A request for a Card image without a valid signed cookie is refused at the
  edge.
- A Player in a Game can load every Card in that Game's Deck.
- A Deck owner can load their own Cards.
- An authenticated user with no relationship to a Deck cannot load its Cards.
- Cookie lifetime outlasts a plausible Game.
- Caching still works — the same Card is not re-fetched from S3 per viewer.

### Related

Decision recorded in `docs/adr/0001-card-images-served-via-cloudfront-oac.md`,
which names this as the deliberate post-MVP follow-up.
