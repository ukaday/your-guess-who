# Program Plan

## Phase 0 — Local Canary
*Verify full stack works locally before writing product code*

- Postgres runs via Docker Compose (local DB, no AWS needed)
- Backend connects to local DB, runs Prisma migrations
- **Canary**: `GET /health` returns `{ status: "ok" }`
- Frontend fetches `/api/health` via Vite proxy and renders response on screen
- **Gate**: both pass before moving to Phase 1

## Phase 1 — Backend MVP
*All endpoints, local DB only*

- Prisma schema — users, decks, cards, games
- Auth endpoints (register, login)
- CRUD endpoints (decks, cards)
- Game creation and invite codes
- Socket.io real-time game logic

## Phase 2 — Frontend MVP
*All screens, wired to local backend*

- Auth pages (login, register)
- Deck builder
- Game lobby (create game, join via invite code)
- Game board (real-time gameplay)

## Phase 3 — Manual Bootstrapping
*One-time setup, cannot be automated*

- Create GitHub repo and push code
- Create AWS account and IAM user with deploy permissions
- Run `cdk bootstrap` (prepares AWS account for CDK)

## Phase 4 — Infrastructure (CDK)
*First manual deploy — creates all AWS resources*

- RDS PostgreSQL instance
- S3 bucket for card images
- S3 bucket + CloudFront for frontend hosting
- App Runner service for backend
- ECR repository for backend Docker images
- Cognito user pool for auth
- **Canary (backend)**: App Runner `GET /health` returns `{ status: "ok" }`
- **Canary (frontend)**: CloudFront site fetches `/api/health` and renders response
- **Gate**: both pass before wiring CI/CD

## Phase 5 — CI/CD
*Depends on Phase 4 — AWS resources must exist before workflows can reference them*

- Add CDK output values (ECR repo, App Runner service, S3 buckets, CloudFront ID) to GitHub Actions secrets
- GitHub Actions workflow for frontend (triggers on `frontend/**` changes)
- GitHub Actions workflow for backend (triggers on `backend/**` changes)
- GitHub Actions workflow for infrastructure (triggers on `infrastructure/**` changes)
- Deploy on merge to `main`
