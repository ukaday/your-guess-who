# Infra step 2 of 6, add public subnets and internet gateway to NetworkStack and remove the Cognito interface endpoint, Fargate tasks need egress that App Runner provided on its managed plane

## Metadata

- Priority: B
- Created: 2026-08-02
- Due: 2026-08-03
- Projects: +infra

## Task

```todo.txt
(B) 2026-08-02 Infra step 2 of 6, add public subnets and internet gateway to NetworkStack and remove the Cognito interface endpoint, Fargate tasks need egress that App Runner provided on its managed plane +infra due:2026-08-03 note:projects/tuxedo-tasks/add-public-subnets-and-drop-cognito-endpoint.md
```

## My notes

Spec: `docs/technical-design.md`. Step 1 of the ECS Express migration. Do this
before standing up the Express service — it has nowhere to run otherwise.

### Why

The VPC is isolated-subnets-only today: no public subnets, no internet gateway,
no NAT. App Runner tolerated that because it pulled images and reached AWS
services on its own managed plane, outside the VPC entirely. Fargate does not.

A Fargate task in an isolated subnet cannot pull from the container registry or
ship logs without either a NAT gateway or interface endpoints for registry API,
registry Docker, and CloudWatch Logs. Separately, the load balancer that Express
Mode provisions is internet-facing and needs public subnets.

### Decision

Add public subnets with an internet gateway; place backend tasks there with
public network assignment. Rejected alternatives:

- **NAT gateway** — the single most expensive option (~$32/mo plus data
  processing).
- **Three interface endpoints** — registry API, registry Docker, CloudWatch
  Logs. Costs more than the NAT once summed, and adds more moving parts.

Isolation comes from the security group, not from subnet placement. That is the
part to get right.

### Scope

- Add a public subnet configuration alongside the existing isolated subnets,
  across the same two AZs.
- Remove the Cognito interface endpoint — it exists only to reach Cognito from
  isolated subnets, which stops being necessary once tasks have egress.
  Recovers its per-ENI hourly charge.
- Keep the S3 gateway endpoint. Gateway endpoints are free and keep bucket
  traffic off the public path.
- Keep the isolated subnets. The database stays there.

### Acceptance

- Public subnets exist in both AZs with a route to an internet gateway.
- Isolated subnets are unchanged and still host the database.
- The Cognito interface endpoint is gone.
- The S3 gateway endpoint remains.
- Network stack tests assert the above.
- `cdk diff` on the database stack shows no change.

### Watch out

Removing the interface endpoint while App Runner is still live is safe — App
Runner reaches Cognito on its managed plane, not through the endpoint. Confirm
that with a health check after deploying, before moving on.

`noUncheckedIndexedAccess` is enabled in this package. Index into subnet arrays
with `.slice(0, n)` rather than `[n]`.
