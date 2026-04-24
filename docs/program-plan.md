# Program Plan

## Phase 0 — Local Canary
*Verify full stack works locally before touching AWS*

- Postgres runs via Docker Compose (local DB, no AWS needed)
- Backend connects to local DB, runs Prisma migrations
- **Canary**: `GET /health` returns `{ status: "ok" }`
- Frontend fetches `/api/health` via Vite proxy and renders response on screen
- **Gate**: both pass before moving to Phase 1

## Phase 1 — Manual Bootstrapping
*One-time setup, cannot be automated*

- Create GitHub repo and push code
- Create AWS account and IAM user with deploy permissions
- Run `cdk bootstrap` (prepares AWS account for CDK)
- Add AWS credentials to GitHub Actions secrets

## Phase 2 — Infrastructure (CDK)
*All other phases depend on this*

- RDS PostgreSQL instance
- S3 bucket for card images
- S3 bucket + CloudFront for frontend hosting
- App Runner service for backend
- ECR repository for backend Docker images
- Cognito user pool for auth
- **Canary (backend)**: App Runner `GET /health` returns `{ status: "ok" }`
- **Canary (frontend)**: CloudFront site fetches `/api/health` and renders response
- **Gate**: both pass before writing product code

## Phase 3 — CI/CD
*Depends on Phase 2 — AWS resources must exist before deploying to them*

- GitHub Actions workflow for frontend (triggers on `frontend/**` changes)
- GitHub Actions workflow for backend (triggers on `backend/**` changes)
- GitHub Actions workflow for infrastructure (triggers on `infrastructure/**` changes)
- Deploy on merge to `main`

## Phase 4 — Backend
*Depends on Phase 2 (needs DB connection string, S3 bucket name)*

- Prisma schema — users, decks, cards, games
- Auth endpoints (register, login)
- CRUD endpoints (decks, cards)
- Game creation and invite codes
- Socket.io real-time game logic

## Phase 5 — Frontend
*Depends on Phase 4 (needs API to exist), can overlap once CI/CD is wired up*

- Auth pages (login, register)
- Deck builder
- Game lobby (create game, join via invite code)
- Game board (real-time gameplay)
