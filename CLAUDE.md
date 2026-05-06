# CLAUDE.md

@context.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (`backend/`)
```bash
npm run dev       # tsx watch (hot reload)
npm run build     # prettier → eslint → tsc → vitest run
npm run format    # prettier --write src
npm run test      # vitest run
npm start         # node dist/index.js
```

**Frontend** (`frontend/`)
```bash
npm run dev       # vite dev server (localhost:5173)
npm run build     # vue-tsc + vite build → dist/
npm run test      # vitest run --coverage
```

**Infrastructure** (`infrastructure/`)
```bash
npx cdk diff      # show pending changes
npx cdk deploy    # deploy all stacks
npx cdk destroy   # tear down stacks
```

## Local Dev

DB runs in Docker (`docker-compose.yml` at repo root). Backend and frontend run natively for hot reload.

## Architecture

Monorepo: `backend/`, `frontend/`, `infrastructure/` are independent npm packages.

**Backend** — Express + Socket.io on single HTTP server. Entry: `src/server.ts` (port binding, Socket.io) + `src/app.ts` (`createApp(prisma, cognito, corsOrigin)` factory). Layered: `src/lib/` (env, db, cognito singletons), `src/routes/` (thin handlers via `handleError`), `src/services/` (business logic, injected deps), `src/utils/` (shared helpers). Socket.io rooms per game (`game:<id>`). Prisma 7 via `@prisma/adapter-pg`. AWS SDK v3 for Cognito auth + S3 pre-signed URLs.

**Frontend** — Vue 3 + Vite + TypeScript. Pinia stores: `authStore`, `deckStore`, `gameStore`. One shared Socket.io client, init on game join, torn down on leave. Card images upload direct to S3 via pre-signed URL (never through app server). Vite proxy `/api` → `http://localhost:3000` for local dev.

**Infrastructure** — AWS CDK (`infrastructure/`). Entry: `bin/app.ts`. Stack definitions: `lib/`. Six stacks: Network, Database (RDS PostgreSQL), Storage (S3 images), Auth (Cognito), Backend (App Runner + ECR), Frontend (S3 + CloudFront). Deployed via GitHub Actions on push to `main`.

**Auth** — Cognito issues JWTs. Username + password only — no email or personal data. Backend validates via Cognito JWKS per request. Local DB `users` table mirrors Cognito sub as PK.

## File Structure

```
your-guess-who/
├── docker-compose.yml
├── context.md                        # gitignored — local AWS resource IDs
├── CLAUDE.md
├── docs/
│   ├── business-requirements.md
│   ├── technical-design.md
│   ├── program-plan.md
│   └── bootstrap-instructions.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── server.ts                 # port binding, Socket.io init
│   │   ├── app.ts                    # createApp factory, route mounting
│   │   ├── lib/                      # singletons (env, db, cognito)
│   │   ├── middleware/               # Express middleware (auth)
│   │   ├── routes/                   # thin Express handlers
│   │   ├── services/                 # business logic, injected deps
│   │   ├── types/                    # global type augmentations
│   │   └── utils/                    # shared helpers
│   └── tests/
│       ├── middleware/
│       ├── services/
│       └── utils/
├── frontend/
│   └── src/
│       ├── main.ts
│       └── App.vue
└── infrastructure/
    ├── bin/app.ts                    # CDK entry point
    └── lib/                          # stack definitions
```

## Docs

| File | Contents |
|------|----------|
| `docs/business-requirements.md` | Game rules, deck/card constraints, gameplay mechanics |
| `docs/technical-design.md` | API routes, Prisma schema, Socket.io events, CDK stacks, CI/CD |
| `docs/program-plan.md` | Phased build plan with canary gates |
| `docs/bootstrap.md` | One-time manual AWS + GitHub setup steps |

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
