# Set CloudWatch log retention on the ECS Express service log group, retentionInDays is unset so logs are kept forever and storage grows unbounded

## Metadata

- Priority: C
- Created: 2026-08-02
- Due: 2026-12-27
- Projects: +infra
- Contexts: @ready-for-agent

## Task

```todo.txt
(C) 2026-08-02 Set CloudWatch log retention on the ECS Express service log group, retentionInDays is unset so logs are kept forever and storage grows unbounded +infra @ready-for-agent due:2026-12-27 note:projects/tuxedo-tasks/set-log-retention-on-ecs-service-log-group.md
```

## My notes

### Why

`/aws/ecs/your-guess-who/your-guess-who-backend-9383` has
`retentionInDays: None` — CloudWatch keeps it forever. Storage is currently
negligible but only ever grows, and unlike the App Runner log groups this one is
live and written to continuously.

Found while cleaning up after the ECS Express migration. Six orphaned App Runner
log groups were deleted at the same time; this one is the live service's and
must be kept, just bounded.

### Scope

ECS Express creates the log group itself, so retention is set through the
container's `awsLogsConfiguration` in `CfnExpressGatewayService` rather than by
declaring a `logs.LogGroup` construct.

Pick a retention period deliberately. Two weeks to a month is plenty for a
pre-launch project where logs are read only when something breaks. Longer only
buys value if there is a reason to look back that far.

Check whether the setting applies to an already-created log group or only to a
newly created one. If ECS will not adopt the retention on the existing group, it
may need setting once via the API and then declaring it so future groups inherit
it.

### Also worth deciding

The three Lambda log groups from CDK custom resources are likewise unbounded:

```
/aws/lambda/CicdStack-CustomAWSCDKOpenIdConnectProviderCustomR-…
/aws/lambda/FrontendStack-CustomCDKBucketDeployment…
/aws/lambda/FrontendStack-CustomS3AutoDeleteObjectsCustomResou-…
```

These write rarely — only during deploys — so they matter far less. Worth
setting in the same pass if it is cheap, not worth a separate task.

### Acceptance

- The ECS service log group has an explicit retention period.
- Retention is declared in CDK, not set by hand, so a service replacement does
  not silently drop back to unbounded.
- Stack tests assert the retention value.
