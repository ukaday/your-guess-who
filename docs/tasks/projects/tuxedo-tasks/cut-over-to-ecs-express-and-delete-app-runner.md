# Infra step 4 of 6, cut CloudFront origin over to the Express service endpoint, scope errorResponses off API paths, verify websocket upgrade returns 101, then delete App Runner

## Metadata

- Priority: B
- Created: 2026-08-02
- Due: 2026-08-03
- Projects: +infra
- Contexts: @ready-for-agent

## Task

```todo.txt
(B) 2026-08-02 Infra step 4 of 6, cut CloudFront origin over to the Express service endpoint, scope errorResponses off API paths, verify websocket upgrade returns 101, then delete App Runner +infra @ready-for-agent due:2026-08-03 note:projects/tuxedo-tasks/cut-over-to-ecs-express-and-delete-app-runner.md
```

## My notes

Spec: `docs/technical-design.md`. Step 3. Depends on the Express service ticket.

Ordered, and each step has a rollback position. Do not delete App Runner until
the origin switch is verified.

### 1. Scope the error responses first

Do this **before** the origin switch, so cutover failures are legible.

The distribution rewrites 403 and 404 to the SPA shell with a 200 status. That
is correct for client-side routing and wrong for everything else — it currently
applies to API and socket paths too, which is what turns a backend rejection
into `200 text/html` at the client. A failed WebSocket handshake arrives as
HTML, not as an error.

Scope the rewrite to the static behaviour only.

Verify: request a path the API 404s on, confirm you get a JSON 404 rather than
the HTML shell.

### 2. Switch the origin

The API origin currently resolves from the App Runner service. Point it at the
Express service's endpoint attribute instead. Direction and shape of the
cross-stack dependency are unchanged, so deploy ordering does not change.

The public CloudFront domain does not change. No client-side URL changes.

**Rollback:** repoint the origin back. App Runner is still running.

### 3. Verify

Through CloudFront, not just against the service endpoint:

- Health endpoint returns 200 JSON.
- Socket.io polling handshake returns 200 with a session id.
- **Upgrade request returns a protocol switch, not 403.** This is the acceptance
  criterion for the entire migration. Today, with an upgrade header, App Runner
  returns `403 Forbidden` with `server: envoy` and an empty body — on any path,
  including the health endpoint.

Manual check; it is a property of the deployed load balancer and cannot be
asserted at the template seam.

### 4. Delete App Runner

Only once step 3 passes.

Remove the service, its VPC connector, its auto-scaling configuration, and the
alpha App Runner CDK dependency from the package.

**Keep the container registry repository.** It is unchanged by the migration and
still receives images from CI.

### 5. Settle the socket transport decision

The planned frontend socket client no longer needs pinning to long-polling. That
workaround was only ever needed because upgrades 403'd. Reverse it now, before
the client is written, so it never gets built.

### Acceptance

- Error responses no longer apply to API paths.
- Distribution API behaviours resolve from the Express service endpoint.
- Upgrade request through CloudFront returns a protocol switch.
- No App Runner resource types remain in any synthesized stack — assert this
  explicitly in tests; it is the guard against a partial revert.
- Alpha App Runner dependency removed from the package.
- Registry repository still present and still receiving CI pushes.
- Backend deploy workflow still passes.

### Supersedes

Two existing backlog items are answered by this work and its spec:

- The item asking to verify whether Socket.io WebSocket transport survives
  CloudFront to App Runner — answered: it does not, proven empirically.
- The item asking to evaluate migrating off App Runner — answered: migrate,
  decision recorded in the spec.

Both are the repo owner's to close or delete.
