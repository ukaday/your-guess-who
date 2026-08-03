# Smoke test the backend image in Deploy Backend before tagging latest, the workflow pushes without ever starting the container so a broken image shipped undetected and only surfaced when ECS crash-looped hours later

## Metadata

- Priority: C
- Created: 2026-08-02
- Due: 2026-11-05
- Projects: +cicd

## Task

```todo.txt
(C) 2026-08-02 Smoke test the backend image in Deploy Backend before tagging latest, the workflow pushes without ever starting the container so a broken image shipped undetected and only surfaced when ECS crash-looped hours later +cicd due:2026-11-05 note:projects/tuxedo-tasks/smoke-test-backend-image-before-tagging-latest.md
```

## My notes

### What happened

During the ECS Express migration on 2026-08-02, the new service crash-looped.
The infrastructure was correct — ALB provisioned, host routing worked, task
placed, database reachable, migrations applied. The container then exited 1:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/app/dist/generated/prisma/internal/class.ts'
imported from /app/dist/generated/prisma/client.js
```

The generated Prisma client imported a `.ts` path. `tsc` does not rewrite import
specifiers, so the compiled output pointed at a file that only exists as `.js`
in `dist`.

Two images were pushed that day:

| Digest | Pushed | State |
|---|---|---|
| `170f08a4` | 14:47 | good |
| `f21c36c3` | 16:59 | broken, became `latest` |

Nothing caught it. `Deploy Backend` builds and pushes; it never runs the
container. App Runner happened to still be serving a June image (its
`UpdatedAt` was 2026-06-28), so nothing consumed the broken tag until ECS pulled
it hours later.

Resolved at the time by rebuilding locally and pushing the good image over
`latest`. `f21c36c3` has since been deleted.

### Unresolved

**Root cause is unknown.** The committed source imports `./internal/class.js`,
and a clean `docker build --no-cache` reproduces the *good* image byte for byte
— same digest as the 14:47 build. No backend commit landed between the good and
broken builds. Something environment-specific to the CI runner produced
different `prisma generate` output, and it was not reproducible locally.

Because the cause is unknown, assume it can recur.

### Scope

Add a step to `Deploy Backend` that runs the built image before it is tagged
`latest`, and fails the job if the container cannot start. Enough to catch this
class:

- Start the container with placeholder env values.
- Assert it gets past module resolution into application code. A failure on a
  bogus Cognito pool ID or database host is a **pass** — it proves the Prisma
  client loaded and `createApp` was reached. `ERR_MODULE_NOT_FOUND` is a fail.
- Only tag and push `latest` after that passes.

Locally this distinction looked like:

```
ParameterValidationError: Invalid Cognito User Pool ID: x
    at createAuthMiddleware (file:///app/dist/middleware/auth.js:3:41)
    at createApp (file:///app/dist/app.js:14:28)
```

which is the healthy signal.

### Acceptance

- `Deploy Backend` fails before pushing when the image cannot boot.
- A deliberately broken image (e.g. delete a file from `dist`) fails the job.
- A good image still pushes and deploys unchanged.

### Related

Overlaps with the digest-pinning task — deploying by commit SHA or digest
instead of mutable `latest` would have made the bad image identifiable and
rollback trivial. Both address the same gap from different sides; neither
replaces the other.
