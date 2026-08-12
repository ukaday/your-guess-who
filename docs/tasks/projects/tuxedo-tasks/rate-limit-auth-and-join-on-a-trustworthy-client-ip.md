# Add express-rate-limit on /auth/login /auth/register /games/join and widen invite-code alphabet, first add a CloudFront origin request policy forwarding CloudFront-Viewer-Address and read the client IP from it, trust proxy is unset and ALL_VIEWER_EXCEPT_HOST_HEADER passes a spoofable X-Forwarded-For

## Metadata

- Priority: B
- Created: 2026-07-30
- Due: 2026-10-19
- Projects: +backend
- Contexts: @sev2, @security

## Task

```todo.txt
(B) 2026-07-30 Add express-rate-limit on /auth/login /auth/register /games/join and widen invite-code alphabet, first add a CloudFront origin request policy forwarding CloudFront-Viewer-Address and read the client IP from it, trust proxy is unset and ALL_VIEWER_EXCEPT_HOST_HEADER passes a spoofable X-Forwarded-For +backend @sev2 @security due:2026-10-19 note:projects/tuxedo-tasks/rate-limit-auth-and-join-on-a-trustworthy-client-ip.md
```

## My notes

### Why `@sev2`, promoted from (C)

Unlike most `@security` tickets in this backlog, this one describes something
exploitable today rather than a missing guard against a hypothetical. Login,
register, and join accept unlimited attempts right now. Credential stuffing and
invite-code enumeration both work.

Held at `@sev2` rather than `@sev1` because the accounts are username plus
password with no email and no personal data attached, so a compromised account
exposes decks and games and nothing else. Real, bounded, no data loss.

### The prerequisite that makes this ordering matter

Rate limiting cannot be added first and fixed later — a limiter keyed on the
wrong value is worse than no limiter.

`trust proxy` is unset, so `req.ip` resolves to the immediate peer, which is the
load balancer. Every request in the world shares one bucket, and the first
attacker to hit the limit locks out every legitimate user. That is a
self-inflicted denial of service.

Setting `trust proxy: true` trades that for the opposite failure. The leftmost
`X-Forwarded-For` entry is whatever the client sent, so an attacker rotates the
header and never hits a limit at all.

The trustworthy value is `CloudFront-Viewer-Address`, which CloudFront sets and
a client cannot forge. It is **not** included in
`ALL_VIEWER_EXCEPT_HOST_HEADER`, so it has to be forwarded deliberately via an
origin request policy before the backend can read it.

Sequence: forward the header, read the client IP from it, then add the limiter.

### Also in scope

Widen the invite-code alphabet. A short code over a narrow alphabet is
enumerable, and a rate limit raises the cost of guessing without changing the
size of the space being guessed. The two belong together.

### Watch out

`CloudFront-Viewer-Address` carries a port alongside the address. Key the
limiter on the address portion — including the port gives every connection its
own bucket and silently disables the limit.

Requests that reach the ALB without passing through CloudFront will not carry
the header at all. Decide what happens then: treat a missing header as
untrusted and reject, rather than falling back to a value an attacker controls.

### Acceptance

- Origin request policy forwards `CloudFront-Viewer-Address`.
- Client IP derives from that header, with the port stripped.
- A missing header does not silently fall back to a spoofable source.
- Repeated failed logins from one address are limited; a second address is
  unaffected.
- Invite codes draw from the widened alphabet.
- Tests cover the IP-extraction helper directly, including the missing-header
  and port-bearing cases.
