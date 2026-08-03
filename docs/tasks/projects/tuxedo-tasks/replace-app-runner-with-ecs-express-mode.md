# Infra step 3 of 6, migrate backend to ECS Express Mode, stand up CfnExpressGatewayService L1 alongside App Runner, single task, existing health path, task SG admits only the managed ALB

## Metadata

- Priority: B
- Created: 2026-08-02
- Due: 2026-08-03
- Projects: +infra

## Task

```todo.txt
(B) 2026-08-02 Infra step 3 of 6, migrate backend to ECS Express Mode, stand up CfnExpressGatewayService L1 alongside App Runner, single task, existing health path, task SG admits only the managed ALB +infra due:2026-08-03 note:projects/tuxedo-tasks/replace-app-runner-with-ecs-express-mode.md
```

## My notes

Spec: `docs/technical-design.md`. Step 2. Depends on the public subnets ticket.

Stand the Express service up **alongside** App Runner. Do not delete anything
here — cutover and removal are the next ticket.

### Construct

`AWS::ECS::ExpressGatewayService`, via the generated L1 in the CDK ECS module.
Confirmed present in the installed CDK version. No L2 exists —
`aws/aws-cdk#36234` tracks the request. Being an L1, there are no grant helpers
or connection objects; express every effect explicitly.

Required: infrastructure role ARN. The CDK typings additionally mark execution
role and primary container as required.

Notable defaults, all of which need overriding or confirming: CPU `256`, memory
`512`, health check path `HTTP:80/ping`, cluster `default`.

### Configuration

- **CPU / memory** — match what App Runner runs now (0.25 vCPU / 0.5 GB), so
  the runtime envelope does not silently change.
- **Health check path** — the existing application health endpoint. The
  platform default points somewhere the app does not serve.
- **Container port, environment variables, secrets** — carry over unchanged.
  The application's configuration contract is deliberately untouched; no backend
  code changes belong to this migration. Database credentials resolve from
  Secrets Manager by reference, never materialised into the service definition.
- **Scaling** — `minTaskCount` and `maxTaskCount` both 1. See below.
- **Network configuration** — the new public subnets, plus a task security
  group.

### Scaling stays at one — read this before changing it

The platform no longer forces a single instance, but the application still does.
Socket.io rooms live in Node process memory, so two tasks means two players in
one game can land on different processes and never exchange events. It fails
silently: no error, no crash, dead board.

Load balancer stickiness does **not** fix this. Pinning a client to a task does
not put *both players* on the same task. Lifting the cap needs a shared
Socket.io adapter, which is out of scope.

The constraint changed character, not existence: platform dead end → application
constraint with a known remedy.

### IAM

Three roles, all declared here rather than assumed to pre-exist, so a clean
deploy into a fresh account works:

- **Task execution role** — ECS agent pulls the image, writes logs.
- **Infrastructure role** — ECS assumes it to provision and manage the load
  balancer, target groups, security groups, scaling policies, alarms.
- **Task role** — the application's own permissions. Carries the image bucket
  read/write that the App Runner instance role holds today.

### Security group wiring

The task security group accepts inbound **only** from the ECS-managed load
balancer's security group, on the application port. This is what makes public
subnet placement safe; do not rely on subnet placement for isolation.

Repoint the database ingress rule from the App Runner VPC connector security
group to the task security group. Keep the rule declared in the compute stack —
declaring it on the database side creates a circular stack dependency.

### Replacement triggers

Cluster, infrastructure role, service name, and **tags** all force replacement.
Set them deliberately. Replacement means a new endpoint, which means a
CloudFront origin change.

### Acceptance

- Express service synthesizes with intended CPU, memory, health path, container
  port.
- Scaling bounds both 1, asserted in tests — this encodes a correctness
  constraint, so changing it should require changing a test.
- Network config references the public subnets and task security group.
- Database security group admits the task security group on the database port,
  and nothing broader.
- All three roles exist; task role has image bucket access.
- App Runner still running and serving — untouched by this ticket.
- Service reachable and healthy on its own generated endpoint.

### Verify before moving on

Hit the Express endpoint directly with an upgrade request. Should return a
protocol switch, where App Runner returns `403 Forbidden` from its proxy. That
single check is the whole point of the migration.
