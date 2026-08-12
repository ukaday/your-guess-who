# Card images are served through CloudFront with OAC, not presigned S3 URLs

Card images must be readable by both Players in a Game, and the images bucket
blocks all public access. We serve them through the existing CloudFront
distribution using an Origin Access Control, so the bucket stays sealed and
CloudFront is its only reader. Presigned GET URLs were rejected because their
expiry is a game-length constraint — a board loaded at the start of a long Game
goes blank when the URLs die, and every reconnect re-signs every Card. A backend
endpoint streaming the bytes was rejected outright: it puts every image on the
single ECS task and defeats caching.

## Consequences

For the MVP a Card image is **unadvertised, not secret**: the CloudFront path is
unauthenticated, so anyone holding a URL can fetch it indefinitely. Guessing is
not a threat — keys are `cards/<userId>/<uuid>`, two UUIDs of entropy — but a
shared URL stays valid forever.

Making Card images secret is deliberately deferred to after the MVP, via
CloudFront signed cookies: one cookie covers a whole Deck, caching survives, and
no bytes pass through the backend. That is an additive change on the same
distribution and the same payload shape, which is why shipping OAC first does
not have to be undone.
