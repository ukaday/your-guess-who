# Deploy backend images to ECS Express by commit SHA or digest instead of mutable latest tag

## Metadata

- Priority: B
- Created: 2026-07-30
- Due: 2026-09-18
- Projects: +infra
- Contexts: @sev2, @bug

## Task

```todo.txt
(B) 2026-07-30 Deploy backend images to ECS Express by commit SHA or digest instead of mutable latest tag +infra @sev2 @bug due:2026-09-18 note:projects/tuxedo-tasks/deploy-backend-images-by-immutable-digest.md
```

## My notes

### Why `@sev2 @bug`, promoted from (C)

Filed as hardening; the 2026-08-02 migration proved it is a live defect. A
broken image took over `latest`, and because the tag is mutable there was no way
to say which artifact was deployed, no way to roll back by reference, and no
record of what `latest` had pointed at before. Diagnosis meant reading push
timestamps in ECR by hand.

The same incident drives the smoke-test ticket. These are two halves of one
gap and neither substitutes for the other: the smoke test stops a bad image
being published, digest pinning makes whatever *is* published identifiable and
reversible. A smoke test that passes on an image you cannot name still leaves
you unable to roll back.

### What to build

Deploy by immutable reference — the commit SHA, or the digest ECR returns on
push — so a given service revision names exactly one artifact forever.

The service definition currently interpolates `:latest` into the container
image. That value has to become a deploy-time input rather than a constant baked
into the stack, which means deciding how CI hands the reference to CDK.

`latest` can keep being pushed as a convenience pointer for humans. It just must
not be the thing the service resolves.

### Watch out

Changing the image reference on `CfnExpressGatewayService` is an update, not a
replacement — replacement triggers are cluster, infrastructure role, service
name, and tags. Confirm this against a `cdk diff` before deploying rather than
assuming it.

Whatever supplies the reference must be present on a plain `cdk deploy` run from
a laptop too, not only inside the workflow, or local deploys break.

### Acceptance

- The deployed task definition names an image by digest or commit SHA.
- Re-running a deploy with no code change does not change the image reference.
- Rolling back to a prior revision pulls the prior artifact.
- `cdk diff` shows an update to the service, not a replacement.
- Stack tests assert the reference is not a mutable tag.
