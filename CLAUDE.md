# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (`backend/`)
```bash
npm run dev       # tsx watch (hot reload)
npm run build     # tsc → dist/
npm start         # node dist/index.js
```

**Frontend** (`frontend/`)
```bash
npm run dev       # vite dev server (localhost:5173)
npm run build     # vue-tsc + vite build → dist/
```

No test runner configured yet — add vitest (frontend) and jest (backend) when needed.

## Local Dev

DB runs in Docker (`docker-compose.yml` at repo root). Backend and frontend run natively for hot reload.

## Architecture

Monorepo: `backend/`, `frontend/`, `infrastructure/` are independent npm packages.

**Backend** — Express + Socket.io on single HTTP server (`backend/src/index.ts`). Socket.io rooms per game (`game:<id>`). JWT from Cognito auth handshake for socket connections. Prisma for DB access. AWS SDK v3 for S3 pre-signed URLs.

**Frontend** — Vue 3 + Vite + TypeScript. Pinia stores: `authStore`, `deckStore`, `gameStore`. One shared Socket.io client, init on game join, torn down on leave. Card images upload direct to S3 via pre-signed URL (never through app server). Vite proxy `/api` → `http://localhost:3000` for local dev.

**Infrastructure** — AWS CDK (`infrastructure/`). Six stacks: Network, Database (RDS PostgreSQL), Storage (S3 images), Auth (Cognito), Backend (App Runner + ECR), Frontend (S3 + CloudFront). Deployed via GitHub Actions on push to `main`.

**Auth** — Cognito issues JWTs. Username + password only — no email or personal data. Backend validates via Cognito JWKS per request. Local DB `users` table mirrors Cognito sub as PK.

## Docs

| File | Contents |
|------|----------|
| `docs/business-requirements.md` | Game rules, deck/card constraints, gameplay mechanics |
| `docs/technical-design.md` | API routes, Prisma schema, Socket.io events, CDK stacks, CI/CD |
| `docs/program-plan.md` | Phased build plan with canary gates |
| `docs/bootstrap.md` | One-time manual AWS + GitHub setup steps |

## Conventions

- 4-space indentation
- One statement per line
- No placeholder files, no dead code
- New functions at bottom of file
- Configurable constants (max card name length, image pixel size) live in backend config — not hardcoded in logic
