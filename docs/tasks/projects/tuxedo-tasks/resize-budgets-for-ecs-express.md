# Infra step 6 of 6, deploy BudgetStack sized for ECS and ALB rather than App Runner, exclude credits, keep the alert address in Parameter Store, restate credit runway at the new monthly total

## Metadata

- Priority: B
- Created: 2026-08-02
- Due: 2026-08-03
- Projects: +infra
- Contexts: @ready-for-agent

## Task

```todo.txt
(B) 2026-08-02 Infra step 6 of 6, deploy BudgetStack sized for ECS and ALB rather than App Runner, exclude credits, keep the alert address in Parameter Store, restate credit runway at the new monthly total +infra @ready-for-agent due:2026-08-03 note:projects/tuxedo-tasks/resize-budgets-for-ecs-express.md
```

## My notes

Spec: `docs/technical-design.md`. Last step of the infra push.

**This absorbed the separate "Add AWS Budgets" task.** `BudgetStack` is already
written but has never been deployed, and it is currently sized against App
Runner. Deploying it as-is and then re-sizing would be two deploys of a stack
that has had zero. Do it once, sized correctly for the post-migration
architecture. If the migration slips past Monday, deploy it with the current
numbers rather than leaving the account unmonitored, and re-size after.

Figures below are projections. Once a few days of real spend exist on the new
architecture, check them against actuals and adjust.

### Why it can't wait long

The migration moves the projected monthly total from roughly $25 to roughly $40.
That lands exactly on the current account budget ceiling, so the ceiling stops
having any headroom the moment cutover completes.

Approximate deltas:

| Component | Before | After |
|---|---|---|
| Backend compute | ~$3–5 (App Runner) | ~$9 (Fargate) |
| Load balancer | none | ~$16.40, billed 24/7 |
| Cognito interface endpoint | ~$7.30 | removed |
| Database and storage | ~$16 | unchanged |

The load balancer is the new floor: it bills continuously whether or not anyone
is playing.

### Scope

- Replace the App Runner service budget. Spend moves from one service line to
  two, so it becomes a container service budget and a load balancer budget.
- Re-size the account monthly budget against observed spend. Decide explicitly
  whether to raise the ceiling or absorb the increase by trimming elsewhere —
  say which, don't leave it implied.
- Re-check the daily budget. It was sized against the old total.
- Restate the credit runway at the new monthly rate, as an explicit date. The
  remaining balance drains faster now, and knowing the month it runs dry matters
  more than knowing the rate.

### Keep these — they are load-bearing

- **Credits excluded from budget evaluation.** With credits included,
  credit-offset spend evaluates to $0 and no alert ever fires. This previously
  masked the entire real bill. Do not "simplify" it away.
- **Alert address read from Parameter Store at synthesis time.** It must not
  appear in source or in the generated template. Verify the synthesized output
  still contains a parameter reference and not the address itself.

### Acceptance

- No budget filters on App Runner.
- Budgets exist for the container service and the load balancer.
- Account monthly and daily budgets re-sized against observed spend, with the
  rationale written down.
- Credits still excluded on every budget.
- Synthesized template contains no literal email address.
- Budget stack tests assert the revised set.
- Credit runway restated as a date in the spec or this note.
