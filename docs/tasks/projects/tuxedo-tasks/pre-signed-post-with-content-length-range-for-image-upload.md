# Switch /images/upload-url to pre-signed POST with content-length-range and image-only content types

## Metadata

- Priority: B
- Created: 2026-07-30
- Due: 2026-10-11
- Projects: +backend
- Contexts: @sev2, @security

## Task

```todo.txt
(B) 2026-07-30 Switch /images/upload-url to pre-signed POST with content-length-range and image-only content types +backend @sev2 @security due:2026-10-11 note:projects/tuxedo-tasks/pre-signed-post-with-content-length-range-for-image-upload.md
```

## My notes

### Why `@sev2 @security`, demoted from (A)

A pre-signed PUT commits to an object key but constrains nothing else about the
request. Any authenticated user can send an object of any size and any content
type to their own prefix.

What keeps this off `@sev1`: the bucket sets `BlockPublicAccess.BLOCK_ALL`, so
nothing uploaded is publicly reachable. There is no arbitrary-file-hosting
vector and no stored-XSS path on the app's own domain. The realistic damage is
storage and transfer cost, amplified by `versioned: true` — repeated overwrites
retain every version for 30 days rather than replacing in place.

Contained, requires an account, no cross-user access, no data loss. `@sev2`.

### What to build

Replace the pre-signed PUT with a pre-signed POST, whose policy can carry
conditions the PUT cannot:

- A `content-length-range` condition bounding the upload at both ends.
- A content-type condition restricting to the image types the game accepts.
- The existing per-user key prefix, unchanged.

The bounds are configuration, not literals in the handler — max image bytes and
the accepted content-type list belong in backend config alongside the existing
max card name length and image pixel size.

The frontend upload flow changes shape with this: a POST form submission with
policy fields rather than a bare PUT. That ticket is still open, so the two can
land in either order, but whichever ships second has to match the other.

### Watch out

S3 enforces the POST policy, so a violation surfaces as an S3 error at upload
time rather than an app error at request time. The client needs to render that
usefully — "file too large" rather than a raw XML error body.

The condition set is fixed at signing time. Signing a policy per upload with the
declared content type is fine; signing one broad policy and reusing it is not.

### Acceptance

- An upload above the configured size ceiling is rejected by S3.
- An upload with a non-image content type is rejected by S3.
- A conforming upload succeeds and the card create flow still works end to end.
- Size and type bounds read from backend config.
- Tests cover the generated policy's conditions, not just that a URL comes back.
