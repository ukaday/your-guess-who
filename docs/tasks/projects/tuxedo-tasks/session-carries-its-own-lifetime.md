# Return the session expiry with the access token and set the refresh token in an httpOnly cookie, login discards ExpiresIn and RefreshToken so a client cannot know when its session dies or renew it

## Metadata

- Priority: C
- Created: 2026-08-11
- Due: 2026-09-23
- Projects: +backend
- Contexts: @sev3, @feature

## Task

```todo.txt
(C) 2026-08-11 Return the session expiry with the access token and set the refresh token in an httpOnly cookie, login discards ExpiresIn and RefreshToken so a client cannot know when its session dies or renew it +backend @sev3 @feature due:2026-09-23 note:projects/tuxedo-tasks/session-carries-its-own-lifetime.md
```

## My notes

### The gap

`authenticateWithCognito` destructures `AuthenticationResult` and returns
`AccessToken` alone. `ExpiresIn` and `RefreshToken` are both discarded, and the
route answers `{ token }`.

A bare bearer string crosses the seam. The client cannot know when it dies, and
has no way to renew it. Expiry is discovered by receiving a 401 — or, on an
already-open socket, never discovered at all. A Game outlives its session and
there is no recovery.

### The decision

Recorded in `docs/adr/0002-refresh-token-stays-in-an-httponly-cookie.md`.
Summary: return the access token plus its expiry for the client to hold **in
memory only**, and set the refresh token in an httpOnly cookie the client's
JavaScript can never read.

The frontend is served same-origin with the API behind CloudFront, so the cookie
needs no cross-origin credential handling. XSS on a Vue SPA is the more plausible
threat than CSRF: httpOnly removes refresh-token theft from an XSS entirely, and
keeping the access token out of `localStorage` means a successful XSS yields a
short-lived token rather than a durable session.

### What to build

- `POST /auth/login` returns the access token and its expiry, and sets the
  refresh token as an httpOnly cookie.
- A refresh endpoint that reads the cookie and issues a new access token.
- Cookie attributes stated deliberately: `httpOnly`, `secure`, `sameSite`, path,
  and max-age. These are the whole security value of the change — do not accept
  framework defaults without deciding each one.
- Logout clears the cookie.

The Socket.io handshake keeps sending the in-memory access token as `auth.token`.
Nothing about the socket auth middleware changes here.

### Consequences to handle

Login becomes a `Set-Cookie` response, so the Vite dev proxy has to forward
cookies — this will not work locally until it does.

The design assumes same-origin. Splitting the frontend and API onto different
origins later means revisiting the cookie, not just the CORS config.

### Blocked by

Nothing. Can start immediately.

### Acceptance

- The refresh token never appears in a response body.
- The access token response carries an expiry the client can act on.
- A client with an expired access token and a valid cookie can obtain a new one
  without re-entering a password.
- Logout makes the cookie unusable.
- Cookie attributes are set explicitly, not inherited.

### Related

Unblocks the socket JWT re-validation ticket, which today can only disconnect on
expiry because nothing crossing the seam supports renewal.
