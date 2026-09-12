# CLAUDE.md

@CONTEXT.md
@aws-resources.local.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (`backend/`)
```bash
npm run dev       # tsx watch (hot reload)
npm run build     # prettier --write → eslint → tsc → vitest run --coverage
npm run format    # prettier --write src
npm run test      # vitest run --coverage (100% thresholds)
npm start         # node dist/server.js
```

**Frontend** (`frontend/`)
```bash
npm run dev       # vite dev server (localhost:5173), proxies /api to BACKEND_URL
npm run build     # prettier --write → eslint → vue-tsc → vite build → vitest run --coverage
npm run format    # prettier --write src tests
npm run test      # vitest run --coverage
```

**Infrastructure** (`infrastructure/`)
```bash
npm test          # vitest CDK assertion tests
npx cdk diff      # show pending changes
npx cdk deploy    # deploy stacks
npx cdk destroy   # tear down stacks
```

CDK targets whichever account and region the AWS CLI is signed in to (`CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION`). Everything is deployed to `us-east-2`.

## Local Dev

DB runs in Docker (`docker-compose.yml` at repo root). Backend and frontend run natively for hot reload.

1. `docker compose up -d` at the repo root
2. Copy `backend/.env.example` and `frontend/.env.example` to `.env` in the same folder and fill in the blanks
3. `backend/`: `npx prisma generate && npx prisma migrate deploy`, then `npm run dev`
4. `frontend/`: `npm run dev`

There is no separate dev environment. Only the database is local: local dev signs users up in the deployed Cognito pool and uploads to the deployed S3 bucket, using the AWS CLI's credentials (`aws login`).

## Architecture

Monorepo: `backend/`, `frontend/`, `infrastructure/` are independent npm packages.

**Backend** — Express + Socket.io on single HTTP server. Entry: `src/server.ts` (port binding, Socket.io) + `src/app.ts` (`createApp(prisma, cognito, s3, s3Bucket, corsOrigin)` factory). Layered: `src/lib/` (env, db, cognito, s3 singletons), `src/middleware/` (Express auth, Socket.io auth, error handler), `src/routes/` (thin handlers; errors propagate to `createErrorHandler`), `src/services/` (business logic, injected deps), `src/socket/` (Socket.io event handlers), `src/utils/` (shared helpers, `HttpError`). Socket.io rooms per game (`game:<id>`). JWT passed as `auth.token` in handshake, validated by `createSocketAuthMiddleware`. Prisma 7 via `@prisma/adapter-pg`. AWS SDK v3 for Cognito auth + S3 pre-signed URLs. Config is environment variables read by `src/lib/env.ts`: locally from `.env` via dotenv; deployed, from the ECS container environment, with DB credentials injected from Secrets Manager as `DB_*`.

**Frontend** — Vue 3 + Vite + TypeScript. Still the Vite scaffold (`App.vue`, `components/HelloWorld.vue`); the app itself is tracked in `todo.txt`. Planned: Pinia stores `authStore`, `deckStore`, `gameStore`; one shared Socket.io client, init on game join, torn down on leave; card images upload direct to S3 via pre-signed URL (never through app server). Locally, Vite proxies `/api` → `BACKEND_URL`. Deployed, CloudFront serves the SPA from S3 and routes `/api/*` and `/socket.io/*` to the backend, so both share one origin.

**Infrastructure** — AWS CDK (`infrastructure/`). Entry: `bin/app.ts`. Stack definitions: `lib/`. Assertion tests: `tests/`. Eight stacks:

| Stack | Contents |
|---|---|
| `NetworkStack` | VPC: public subnets for backend tasks, isolated subnets for the database |
| `DatabaseStack` | RDS PostgreSQL 15, credentials generated into Secrets Manager |
| `StorageStack` | S3 card-image bucket, CORS for the CloudFront origin and `localhost:5173` |
| `AuthStack` | Cognito user pool + app client |
| `BackendStack` | ECS Express Mode service running `your-guess-who-backend:latest` from ECR (repository created by hand, not by CDK) |
| `FrontendStack` | S3 + CloudFront for the SPA, `/api/*` and `/socket.io/*` routed to the backend |
| `CicdStack` | GitHub OIDC provider + `github-actions-deploy` role, assumable only from `master` |
| `BudgetStack` | AWS Budgets alerts, address read from SSM `/your-guess-who/budget-alert-email` |

**CI/CD** — GitHub Actions. Deploy workflows authenticate through the OIDC role; no AWS secrets are stored in GitHub.

| Workflow | Trigger | Does |
|---|---|---|
| `backend-ci.yml` | push + PR touching `backend/` | lint/build/test against a Postgres service container |
| `backend.yml` | push to `master` touching `backend/` | build image, push to ECR as `latest` |
| `frontend.yml` | push to `master` touching `frontend/` | `cdk deploy FrontendStack` (bundles the frontend in Docker) |
| `infrastructure.yml` | push to `master` touching `infrastructure/` | `cdk deploy --all` |

**Auth** — Cognito issues JWTs. Username + password only — no email or personal data. Backend validates via Cognito JWKS per request. Local DB `users` table mirrors Cognito sub as PK.

## File Structure

```
your-guess-who/
├── docker-compose.yml                # local Postgres
├── CONTEXT.md                        # domain glossary
├── aws-resources.local.md            # gitignored — local AWS resource IDs
├── CLAUDE.md
├── todo.txt                          # task backlog (todo.txt format, managed with tuxedo)
├── done.txt                          # archived completed tasks
├── .github/
│   └── workflows/
│       ├── backend-ci.yml            # backend lint/build/test on push + PR
│       ├── backend.yml               # push backend image to ECR on master
│       ├── frontend.yml              # deploy FrontendStack on master
│       └── infrastructure.yml        # deploy all stacks on master
├── docs/
│   ├── adr/                          # architecture decision records
│   ├── agents/                       # how agent skills use docs and the tracker
│   ├── tasks/                        # per-ticket notes for todo.txt
│   ├── bootstrap-instructions.md
│   └── technical-design.md
├── backend/
│   ├── .env.example
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── server.ts                 # port binding, Socket.io init
│   │   ├── app.ts                    # createApp factory, route mounting
│   │   ├── lib/                      # singletons (env, db, cognito, s3)
│   │   ├── middleware/               # Express + Socket.io auth, error handler
│   │   ├── routes/                   # thin Express handlers
│   │   ├── services/                 # business logic, injected deps
│   │   ├── socket/                   # Socket.io event handlers
│   │   ├── types/                    # global type augmentations
│   │   └── utils/                    # shared helpers
│   └── tests/
│       ├── middleware/
│       ├── services/
│       ├── socket/
│       └── utils/
├── frontend/
│   ├── .env.example
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   └── components/
│   └── tests/
└── infrastructure/
    ├── bin/app.ts                    # CDK entry point
    ├── lib/                          # stack definitions
    └── tests/                        # CDK assertion tests
```

## Docs

| File | Contents |
|------|----------|
| `docs/technical-design.md` | Spec for the App Runner → ECS Express Mode migration (completed) |
| `docs/bootstrap-instructions.md` | One-time manual AWS + GitHub setup steps |
| `docs/adr/` | Architecture decision records |

Task backlog lives in `todo.txt` at repo root — todo.txt format. Check it for pending work before proposing new tasks.

**Priority criteria** — the letter is derived, never chosen. Every task carries one severity context and one type context; the matrix produces the letter.

**Severity** — technical impact alone. Set once at triage; it does not move because the schedule moved.

| Context | Meaning |
|---------|---------|
| `@sev1` | Exploitable today, data loss, or a core flow broken for everyone |
| `@sev2` | Broken with no workaround, contained blast radius |
| `@sev3` | Degraded, or a real gap with no reachable exploit; workaround exists |
| `@sev4` | Cosmetic, no user impact |

**Type** — what the ticket is.

| Context | Meaning |
|---------|---------|
| `@bug` | Shipped behaviour is wrong or broken, whether it ever worked or not |
| `@security` | Hardening or defense-in-depth with no live exploit path |
| `@feature` | Net-new capability |
| `@chore` | Tooling, dependencies, cleanup, docs, cost control |

**Matrix** — severity sets the level; type caps it.

| | `@bug` | `@security` | `@feature` | `@chore` |
|---|---|---|---|---|
| **`@sev1`** | (A) | (A) | (C) | (C) |
| **`@sev2`** | (B) | (B) | (C) | (C) |
| **`@sev3`** | (C) | (C) | (C) | (D) |
| **`@sev4`** | (D) | (D) | (D) | (D) |

`@feature` and `@chore` can never reach (A) or (B) — new work does not jump an open break. A `@feature` that feels (A)-urgent is mis-typed: it is a `@bug` or a `@security` ticket.

For a `@feature`, severity is the impact of its **absence**. A missing capability that costs a player their game is `@sev3`; one the game plays fine without is `@sev4`.

A tag is not a priority. `@security` on its own says nothing about ordering — an unreachable validation gap is `@sev3` and lands at (C); a live auth bypass is `@sev1` and lands at (A). Argue the severity, not the letter.

`@blocker` and `@cicd` remain free-form topic contexts. They carry no weight in the matrix.

## Collaboration

Act as tutor — explain concepts and guide the user to write the code. Don't implement unless the user is stuck or explicitly asks.

## Conventions

- 4-space indentation
- One statement per line
- New functions at bottom of file
- Configurable constants (max card name length, image pixel size) live in backend config — not hardcoded in logic

**Principles**
- **SLAP** — single level of abstraction per function; constructors/handlers delegate to private methods
- **SOLID** — single responsibility, open/closed, dependency injection over hardcoded dependencies
- **DRY** — no duplicated logic; shared values in config or env, not inlined
- **YAGNI** — no placeholder files, no dead code, no stubs, no features not yet needed

## Agent skills

### Issue tracker

Tasks live in `todo.txt` (todo.txt format, managed with tuxedo); per-ticket detail in `docs/tasks/projects/tuxedo-tasks/`. Priority letters are derived from the severity × type matrix above, never set by hand. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
