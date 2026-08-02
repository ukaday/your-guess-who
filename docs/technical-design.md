# Spec: Migrate backend off App Runner to ECS Express Mode

## Problem Statement

The game is real-time. Two players share a board, and every elimination and
guess has to reach the other player immediately. That is what Socket.io is for,
and it is why the backend was built around it.

The platform the backend runs on cannot do it.

App Runner fronts every service with a managed proxy that refuses HTTP upgrade
requests. Verified against the live service: a plain request to the health
endpoint returns 200, and the identical request carrying `Upgrade: websocket`
returns 403 with an empty body. The rejection happens at the proxy, is
independent of path, and the application never sees the request. The
application itself is configured correctly and advertises WebSocket support in
its handshake.

This is not a misconfiguration that can be fixed. AWS closed the roadmap issue
for WebSocket support as `not_planned` in April 2024. The companion issue for
session stickiness has been open since 2021 and never shipped. App Runner is
closed to new customers and AWS states it will receive no new features.

Three consequences follow, and the repo owner is living with all of them:

1. **The game silently breaks above one instance.** Socket.io rooms are held in
   Node process memory. Two players in the same game landing on different
   instances never see each other's moves — no error, no crash, just a dead
   board. Long-polling sessions have the same problem: each poll must reach the
   instance holding the session, and there is no stickiness to make that happen.
2. **Failures are unreadable.** The CloudFront error-response rule rewrites 403
   to a 200 serving the SPA shell, so a rejected WebSocket upgrade arrives at
   the client as HTML where a handshake was expected.
3. **Every fix is a workaround.** Capping the service at a single instance
   keeps the game correct, but it also caps availability and throughput, and it
   is a constraint imposed by the platform rather than chosen.

Separately, the deploy pipeline is broken. Two of the three deploy workflows
fail before reaching AWS, so infrastructure changes cannot ship without running
deploys by hand.

The repo owner has stated the goal plainly: they do not want to hand-hold this.
They want the infrastructure boilerplate to work so attention can move to
building the game.

## Solution

Move the backend to Amazon ECS Express Mode and delete App Runner entirely.

Express Mode is the migration path AWS recommends for App Runner customers. It
provisions an ECS service on Fargate together with an Application Load
Balancer, target groups, security groups, auto-scaling, and log groups, from a
single declarative resource. The load balancer terminates TLS and forwards
`Upgrade: websocket`, and supports target-group stickiness. Both platform
constraints disappear.

Concretely, after this work:

- WebSocket upgrades succeed end to end, browser through CloudFront to the
  backend. The Socket.io client connects on its native transport instead of
  falling back to long-polling.
- The single-instance cap stops being a platform limitation. It remains
  temporarily for a different and better-understood reason — in-process
  Socket.io rooms — which is tracked separately and no longer blocked by the
  platform.
- Deploy workflows run green, so pushing an infrastructure change deploys it.
- Budgets reflect what the new architecture actually costs, and alert before
  the account overruns rather than after.

The trade is money. Express Mode runs a load balancer 24/7 whether or not
anyone is playing, and Fargate tasks need network egress that App Runner
provided for free on its managed plane. This spec accepts that cost and sizes
the budgets to it, because the alternative is a real-time game that cannot do
real-time.

## User Stories

1. As a player, I want my opponent's eliminations to appear on my board the
   moment they make them, so that the game feels live rather than turn-delayed.
2. As a player, I want my connection to survive a full game session, so that I
   am not dropped mid-match.
3. As a player, I want to reconnect after a brief network blip and find the
   game where I left it, so that a dropped signal does not cost me the match.
4. As a player, I want my guess to reach my opponent reliably, so that the win
   condition resolves fairly.
5. As a player, I want the board to be correct for both of us at all times, so
   that we are not playing two different games.
6. As a player, I want the app to tell me when something is wrong, so that I am
   not staring at a frozen board wondering whose turn it is.
7. As a player, I want to play with a friend at the same time as other pairs
   are playing, so that the game does not have to be used by one pair at a time.
8. As the repo owner, I want the backend to run on a platform that supports
   WebSockets natively, so that the application's real-time design is actually
   expressible.
9. As the repo owner, I want to stop running on a service that is closed to new
   customers and receives no new features, so that I am not building on a dead
   end.
10. As the repo owner, I want App Runner removed completely rather than left
    alongside the new service, so that I am not paying for or reasoning about
    two compute platforms.
11. As the repo owner, I want the load balancer's WebSocket support verified
    before cutover, so that I do not discover the migration failed after
    deleting the old service.
12. As the repo owner, I want the single-instance cap to remain in place after
    migration, so that in-process Socket.io rooms do not silently break the game
    while I am mid-migration.
13. As the repo owner, I want the reason for that cap documented as an
    application constraint rather than a platform one, so that lifting it later
    is a known piece of work.
14. As the repo owner, I want the Fargate tasks to reach the database, so that
    the migration does not break the thing that already works.
15. As the repo owner, I want the tasks to pull their container image without a
    NAT gateway, so that the migration does not quietly add a large fixed cost.
16. As the repo owner, I want the database reachable only from the backend
    tasks, so that moving compute does not widen network exposure.
17. As the repo owner, I want the tasks' inbound traffic restricted to the load
    balancer, so that giving them public network placement does not make them
    publicly reachable.
18. As the repo owner, I want environment variables and database credentials to
    arrive the same way they do today, so that the application needs no changes
    to run on the new platform.
19. As the repo owner, I want database credentials to stay in Secrets Manager
    and never appear in a task definition, so that the migration does not
    regress secret handling.
20. As the repo owner, I want CloudFront to route to the new backend endpoint,
    so that the public URL does not change and the frontend needs no rework.
21. As the repo owner, I want the same-origin model preserved, so that I do not
    reintroduce CORS between frontend and backend.
22. As the repo owner, I want the health check to keep using the existing
    endpoint, so that I can tell whether the service is up using the check I
    already trust.
23. As the repo owner, I want container logs to reach CloudWatch, so that I can
    diagnose failures without shell access to a task.
24. As the repo owner, I want my deploy workflows to run green, so that pushing
    a change deploys it instead of failing.
25. As the repo owner, I want the frontend bundling step to work inside CI, so
    that the frontend deploy stops failing before it reaches AWS.
26. As the repo owner, I want the CI failure fixed independently of the
    migration, so that a broken pipeline is not blocking an unrelated piece of
    work.
27. As the repo owner, I want to keep deploying through the existing OIDC role,
    so that no long-lived AWS credentials enter the pipeline.
28. As the repo owner, I want the deploy role's permissions widened only as far
    as the new resources require, so that the migration does not grant blanket
    access.
29. As the repo owner, I want to know what the new architecture costs before I
    deploy it, so that I am not surprised by the bill.
30. As the repo owner, I want per-service budgets that match the services I now
    run, so that an alert tells me which component overran.
31. As the repo owner, I want budgets to exclude credits, so that spend offset
    by credits still triggers alerts instead of reading as zero.
32. As the repo owner, I want to be alerted before the monthly budget is
    exhausted rather than after, so that I can act while it still matters.
33. As the repo owner, I want to know how long my remaining credits last under
    the new cost, so that I can plan for when they run out.
34. As the repo owner, I want the App Runner budget replaced rather than left
    pointing at a service I no longer use, so that the budget set does not go
    stale.
35. As the repo owner, I want the alert address kept out of source control, so
    that publishing this repo does not publish my email.
36. As an AFK agent, I want the compute stack to assert its shape in tests, so
    that I can change it without deploying to find out what broke.
37. As an AFK agent, I want existing test patterns reused rather than new ones
    invented, so that the suite stays consistent and legible.
38. As an AFK agent, I want the tests to fail if App Runner resources reappear,
    so that a partial revert is caught in CI.
39. As an AFK agent, I want the spec to state which decisions are settled, so
    that I do not relitigate the platform choice mid-implementation.
40. As the repo owner, I want the migration broken into ordered tickets, so that
    I can stop between steps without leaving the system broken.
41. As the repo owner, I want a rollback position at each step, so that a failed
    cutover does not take the game offline.
42. As the repo owner, I want the frontend socket client's transport
    configuration settled before the client is written, so that I do not build
    against a workaround that no longer applies.

## Implementation Decisions

**Platform.** The backend moves to ECS Express Mode. The decision is settled;
implementation should not reopen it. Alternatives considered and rejected:
classic ECS Fargate with a hand-wired load balancer (more infrastructure code
for the same runtime), a network load balancer (identical hourly cost, layer 4
only), and a single EC2 host with an elastic IP (cheapest, but adds host
patching and container supervision to a solo project).

**Construct level.** Express Mode is declared through the generated L1 resource
in the CDK ECS module. No L2 construct exists — an aws-cdk issue tracks the
request. The L1 is present in the version of the CDK library already installed,
so no dependency upgrade is required. Because it is an L1, the ergonomic helpers
available on other stacks (grant methods, connection objects) are unavailable
and their effects must be expressed explicitly.

**Network topology changes.** This is the largest change and the one with cost
consequences. The VPC currently has isolated subnets only — no public subnets,
no internet gateway, no NAT. App Runner tolerated this because it pulled
container images and reached AWS services on its own managed service plane,
outside the VPC. Fargate tasks do not get that. A task in an isolated subnet
cannot pull from the container registry or ship logs without either a NAT
gateway or a set of interface endpoints, and the load balancer that Express Mode
provisions must be internet-facing, which requires public subnets.

The decision is to add public subnets with an internet gateway and place the
backend tasks in them with public network assignment, rather than adding NAT or
additional interface endpoints. Rationale: a NAT gateway is the single most
expensive option, and the interface endpoints needed to avoid it — registry API,
registry Docker, and CloudWatch Logs — together cost more than the NAT while
adding more moving parts. Public placement with a restrictive security group
achieves the same isolation at no hourly cost.

Security is preserved by the security group, not by subnet placement: the task
security group accepts inbound traffic only from the load balancer's security
group, on the application port. Nothing else can reach the tasks regardless of
their network placement.

**Interface endpoint removal.** Once tasks have internet egress through the
gateway, the Cognito interface endpoint exists only to serve a path that is no
longer needed. It is removed, recovering its per-ENI hourly charge. The S3
gateway endpoint is retained — gateway endpoints are free and keep image and
bucket traffic off the public path.

**Database reachability.** The ingress rule on the database security group
currently admits the App Runner VPC connector's security group. It is repointed
at the backend task security group. The rule stays declared in the compute stack
rather than the database stack, for the same reason as today: declaring it on
the database side creates a circular dependency between the two stacks.

**IAM.** Express Mode requires two roles. A task execution role, used by the
ECS agent to pull the image and write logs. An infrastructure role, which ECS
assumes to provision and manage the load balancer, target groups, security
groups, scaling policies, and alarms on the owner's behalf. Both are declared in
the compute stack rather than assumed to pre-exist, so that a clean deploy into
a fresh account works. A task role carries the application's own permissions —
the image bucket read/write that the App Runner instance role holds today.

**Service configuration.** CPU and memory are set to match what App Runner runs
now, so the migration does not silently change the runtime envelope. The health
check path is the existing application health endpoint; the platform default
points somewhere the application does not serve. Container port, environment
variables, and secret references carry over unchanged — the application's
configuration contract is deliberately untouched, so no backend code changes are
part of this work. Database credentials continue to resolve from Secrets Manager
by reference rather than being materialised into the service definition.

**Scaling.** Minimum and maximum task count are both set to one. The platform no
longer forces this, but the application still does: Socket.io rooms live in
process memory, so two tasks means two players in one game can land on different
processes and never exchange events. Load balancer stickiness does not solve
this — pinning a client to a task does not put *both* players on the same task.
Lifting the cap requires a shared Socket.io adapter and is tracked as separate
work, explicitly out of scope here. The cap is now an application constraint
with a known fix, not a platform dead end.

**Update behaviour.** Several properties on the Express service force
replacement when changed: the cluster, the infrastructure role, the service
name, and — unusually — tags. Implementation should set these deliberately and
avoid incidental churn, since replacement means a new endpoint and a
corresponding CloudFront origin change.

**Frontend wiring.** The distribution's API origin currently reads the App
Runner service URL from the compute stack. It reads the Express service's
endpoint attribute instead. The cross-stack dependency edge is unchanged in
direction and shape, so deploy ordering does not change. The public CloudFront
domain is unaffected, so no client-side URL changes are needed.

**Error response scoping.** The distribution's error responses rewrite 403 and
404 to the SPA shell with a 200 status. That rule is intended for client-side
routing but currently applies to API and socket paths too, which is what turns a
backend rejection into unreadable HTML. Scoping this to the static behaviour is
in scope, because it is the difference between a legible failure and an opaque
one during cutover.

**Socket transport.** With a load balancer that forwards upgrades, the planned
frontend socket client no longer needs to pin itself to long-polling. That
decision is reversed here before the client is written, so the workaround is
never built.

**App Runner removal.** The service, its VPC connector, its auto-scaling
configuration, and the alpha App Runner CDK dependency are all removed. The
container registry repository is retained — it is unchanged by the migration and
still receives images from CI. Removal happens after the new service is verified
serving traffic, not before.

**Cutover.** The default service endpoint changes, and there is no custom domain
to shift traffic across gradually. Cutover is therefore a CloudFront origin
switch: stand up the Express service, verify it directly on its own endpoint,
then repoint the origin. Rollback at any point before App Runner deletion is
repointing the origin back.

**Deploy pipeline fix.** The frontend and infrastructure workflows both fail
inside CDK's Docker bundling of the frontend asset, before any AWS call. The
bundling container runs as the CI runner's numeric user, which has no home
directory inside the image, so the package manager cannot create its cache
directory and exits non-zero. The fix is to give the bundling step a writable
cache location. This is independent of the migration and ships first — a broken
pipeline should not be diagnosed at the same time as a platform change. Note
that the backend deploy workflow already passes, which confirms the OIDC role
and its trust policy are correct.

**Deploy role permissions.** The deploy role reaches AWS by assuming the CDK
bootstrap roles, and the bootstrap execution role carries administrator
permissions, so no policy change is required for the new resource types. This is
recorded so implementation does not add permissions unnecessarily.

**Budgets.** The per-service budget filtered to App Runner is replaced by
budgets covering the container service and the load balancer, since spend moves
from one line to two. The account-level monthly budget is re-sized against the
new projected total. The existing design points are retained deliberately:
credits are excluded from budget evaluation, or credit-offset spend evaluates to
zero and never alerts; and the alert address is read from Parameter Store at
synthesis time rather than committed, so it does not appear in source or in the
generated template.

**Cost.** The migration increases steady-state spend. Approximate monthly
figures for the region in use:

| Component | Now | After |
|---|---|---|
| Backend compute | ~$3–5 (App Runner) | ~$9 (Fargate) |
| Load balancer | none | ~$16.40, billed continuously |
| Cognito interface endpoint | ~$7.30 | removed |
| Database and storage | ~$16 | unchanged |

Net effect is roughly $15/month more, moving the projected total from about $25
to about $40. That lands exactly on the current monthly budget ceiling, which is
why re-sizing the budgets is part of this work rather than a follow-up. The
implication for credit runway should be stated in the budget ticket.

## Testing Decisions

**What makes a good test here.** Assert the contract the infrastructure
promises, not the shape of the code that produces it. A test should fail when
the deployed system would behave differently, and should not fail when a
construct is refactored, a private method is renamed, or a logical ID changes.
Assert on resource types and the properties that carry meaning — the health
check path, the scaling bounds, the network placement, the security group
relationships. Do not assert on generated logical IDs, on property ordering, or
on the full synthesized template.

**One seam.** Testing happens at the existing seam: CDK template assertions
against a synthesized stack. This is the only seam in the infrastructure package
today and no new one is introduced. Every stack is already tested this way, so
the migration extends existing coverage rather than establishing a new pattern.

**Modules under test.** The backend compute stack is the primary subject — it
changes most. The network stack is tested for the added public subnets and the
removed interface endpoint. The frontend stack is tested for the origin now
resolving from the Express service rather than App Runner. The budget stack is
tested for the revised budget set.

**What to assert.**

- An Express service resource exists with the intended CPU, memory, health check
  path, and container port.
- Scaling bounds are both one, since this encodes a correctness constraint
  rather than a preference — a change here should require changing a test.
- The service's network configuration references the public subnets and the task
  security group.
- The database security group admits the task security group on the database
  port, and admits nothing broader.
- Task execution, infrastructure, and task roles exist, and the task role
  carries image bucket access.
- No App Runner resource types remain in any synthesized stack. This is the
  guard against a partial revert and should be asserted explicitly rather than
  inferred.
- The distribution's API behaviours point at the Express service endpoint, and
  the error-response rewrite no longer applies to API paths.
- The budget set no longer filters on App Runner, does include the container
  service and load balancer, and continues to exclude credits.

**Prior art.** Six stack test files already exist and establish the pattern:
synthesize the stack under test with its required props, then assert resource
properties against the template. Follow their structure, including the project's
arrange-act-assert convention without section comments. Coverage expectations
follow the existing repo convention — wiring files are excluded, behavioural
files are held to full coverage.

**Not tested automatically.** WebSocket upgrade behaviour is a property of the
deployed load balancer, not of the template, and cannot be asserted at this
seam. It is verified by hand once after cutover: a request carrying an upgrade
header should return a protocol-switch response where it currently returns 403.
Adding a post-deploy smoke test was considered and deliberately declined, to
keep the seam count at one.

## Out of Scope

- **Multi-task operation.** Running more than one backend task requires a shared
  Socket.io adapter so that room membership is not confined to a single process.
  That is separate work and this spec deliberately keeps the task count at one.
- **Session stickiness configuration.** Irrelevant while a single task runs, and
  insufficient on its own once more than one does.
- **Custom domain and certificate.** The service keeps its generated endpoint
  behind the existing distribution. No DNS-weighted traffic shifting.
- **Backend application changes.** The configuration contract is unchanged. No
  code changes to the application are part of this migration.
- **Frontend implementation.** Routes, stores, views, and the socket client
  remain unwritten. Only the transport decision is settled here.
- **The outstanding backend security work.** Boundary validation, image key
  ownership checks, constrained upload signing, and atomic game start are all
  tracked separately and unaffected by the platform change.
- **Rate limiting.** Its prerequisite — resolving the real client address from a
  header the client cannot forge — is affected by the ingress path changing, but
  the work itself is separate.
- **The image bucket's cross-origin configuration.** Tracked separately.
- **Database storage class change.** Deliberately deferred; it risks instance
  replacement and should be a scheduled change.
- **Pinning CI actions to commit digests.** Tracked separately.
- **Registry lifecycle policy.** Tracked separately.

## Further Notes

**On what this document replaced.** This file previously held the architecture
reference — REST route tables, the data model, socket event contracts,
stack-by-stack resource configuration, and the security findings register. That
content was replaced at the repo owner's explicit direction after the trade-off
was raised. It remains recoverable from version history, and is worth restoring
to a separate document once this migration lands, since a spec describes a
change while an architecture reference describes a system.

**On evidence.** The platform limitation was established empirically against the
running service rather than inferred from documentation, and the roadmap issue
states were read from the API rather than from secondary sources. The
distinction matters because several third-party write-ups describe an App Runner
shutdown deadline that AWS documentation does not state — AWS says the service
is closed to new customers and that existing customers may continue creating
resources. There is no forced migration date. The reason to move is WebSocket
support, not deprecation pressure.

**On sequencing.** The pipeline fix ships first and independently. The migration
then proceeds: network changes, then the new service, then verification, then
the origin switch, then App Runner removal. Budgets are re-sized last, once
actual spend on the new architecture is observable rather than projected.

**On the cost decision.** Roughly $15/month is being spent to make a real-time
game capable of real-time. That is the correct trade for this project, but it
consumes the remaining headroom under the current budget ceiling, and the
remaining credit balance will run out sooner as a result. The budget ticket
should state the revised runway explicitly so the date is known rather than
discovered.

**On the single-task cap.** It is worth being precise that this constraint
survives the migration, because it would be easy to read "the platform now
supports WebSockets" as "the cap can be lifted." It cannot, yet. What changes is
the nature of the constraint: it moves from an unfixable platform limitation to
an application-level one with a known remedy.
