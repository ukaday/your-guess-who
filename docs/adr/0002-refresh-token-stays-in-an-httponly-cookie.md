# The refresh token stays in an httpOnly cookie; the access token lives in memory

`/auth/login` currently returns a bare Cognito access token and discards the
refresh token and expiry, so a client cannot know when its session dies or renew
it. We will return the access token plus its expiry for the client to hold **in
memory only**, and set the refresh token in an httpOnly cookie the client's
JavaScript can never read.

The frontend is a Vue SPA served same-origin with the API behind CloudFront, so
the cookie needs no cross-origin credential handling. XSS is the more plausible
threat here than CSRF: an httpOnly cookie removes refresh-token theft from an
XSS entirely, and keeping the access token out of `localStorage` means a
successful XSS yields a short-lived token rather than a durable session.

## Consequences

Login becomes a `Set-Cookie` response, so the Vite dev proxy has to forward
cookies. The design assumes same-origin — splitting the frontend and API onto
different origins later means revisiting this. The Socket.io handshake continues
to send the in-memory access token as `auth.token`.
