# Technical Design

## Architecture Overview

```
Browser (Vue 3)
    │  HTTP (REST)          WebSocket (Socket.io)
    ▼
App Runner (Express + Socket.io)
    │
    ├── RDS PostgreSQL (game/user/deck state)
    ├── S3 (card image storage)
    └── Cognito (auth token validation)

CloudFront → S3 (frontend static assets)
ECR (backend Docker images)
```

---

## Frontend

**Stack**: Vue 3, Vite, TypeScript, Vue Router, Pinia, Socket.io client

### Routing

| Route               | Component       | Auth required |
|---------------------|-----------------|---------------|
| `/`                 | Home            | No            |
| `/login`            | Login           | No            |
| `/register`         | Register        | No            |
| `/decks`            | DeckList        | Yes           |
| `/decks/:id`        | DeckEditor      | Yes           |
| `/game/create`      | CreateGame      | Yes           |
| `/game/join`        | JoinGame        | Yes           |
| `/game/:id/lobby`   | GameLobby       | Yes           |
| `/game/:id`         | GameBoard       | Yes           |

### State Management (Pinia)

- `authStore` — current user, JWT token, login/logout actions
- `deckStore` — decks list, active deck, card CRUD
- `gameStore` — active game state, board (cards in play), turn, socket connection

### Socket.io Client

One shared socket, init on game join, torn down on leave. Events:

- **Emit**: `select-card`, `ask-question`, `answer-question`, `make-guess`, `concede`
- **Listen**: `game-started`, `question-asked`, `question-answered`, `guess-result`, `opponent-disconnected`, `game-over`

### Image Uploads

Card images upload direct to S3 via pre-signed URL from backend. Frontend never sends image bytes through app server.

### Build & Hosting

Vite builds static bundle → S3, served via CloudFront. `VITE_API_URL` set at build time from env var.

---

## Backend

**Stack**: Node.js, Express, TypeScript, Socket.io, Prisma, AWS SDK v3

### REST API

All routes prefixed `/api`.

#### Auth

| Method | Path               | Description                        |
|--------|--------------------|------------------------------------|
| POST   | `/auth/register`   | Create Cognito user + DB user row  |
| POST   | `/auth/login`      | Authenticate, return JWT           |

#### Decks

| Method | Path               | Description          |
|--------|--------------------|----------------------|
| GET    | `/decks`           | List user's decks    |
| POST   | `/decks`           | Create deck          |
| GET    | `/decks/:id`       | Get deck + cards     |
| PATCH  | `/decks/:id`       | Rename deck          |
| DELETE | `/decks/:id`       | Delete deck          |

#### Cards

| Method | Path                          | Description                        |
|--------|-------------------------------|------------------------------------|
| POST   | `/decks/:id/cards`            | Add card (name + upload URL req.)  |
| DELETE | `/decks/:deckId/cards/:id`    | Remove card                        |

#### Images

| Method | Path                    | Description                         |
|--------|-------------------------|-------------------------------------|
| POST   | `/images/upload-url`    | Return pre-signed S3 PUT URL        |

#### Games

| Method | Path                | Description                      |
|--------|---------------------|----------------------------------|
| POST   | `/games`            | Create game (deck, invite code)  |
| POST   | `/games/join`       | Join by invite code              |
| GET    | `/games/:id`        | Get game state                   |

### Socket.io

Socket.io runs alongside Express on same HTTP server. Each game gets own room (`game:<id>`).

**Server-side events handled**:

| Event              | Payload                     | Action                                          |
|--------------------|-----------------------------|-------------------------------------------------|
| `select-card`      | `{ cardId }`                | Record secret card, emit `game-started` if both ready |
| `ask-question`     | `{ text }`                  | Broadcast question to opponent                  |
| `answer-question`  | `{ answer: 'yes' \| 'no' }` | Broadcast answer, advance turn                  |
| `make-guess`       | `{ cardId }`                | Evaluate guess, emit `game-over` to both        |
| `concede`          | —                           | Emit `game-over` to both                        |

Connection auth: JWT passed as `auth.token` in Socket.io handshake, verified before joining any room.

### Authentication

Cognito issues JWTs. Backend validates token per request via Cognito JWKS endpoint. Local DB `users` table mirrors Cognito user ID as primary key for relational joins.

### Prisma Schema (outline)

```prisma
model User {
  id     String  @id           // Cognito sub
  decks  Deck[]
  games  GamePlayer[]
}

model Deck {
  id     String  @id @default(cuid())
  name   String
  owner  User    @relation(fields: [ownerId], references: [id])
  ownerId String
  cards  Card[]
  games  Game[]
}

model Card {
  id       String  @id @default(cuid())
  name     String
  imageKey String  // S3 object key
  deck     Deck    @relation(fields: [deckId], references: [id])
  deckId   String
}

model Game {
  id         String       @id @default(cuid())
  inviteCode String       @unique
  status     GameStatus
  deck       Deck         @relation(fields: [deckId], references: [id])
  deckId     String
  players    GamePlayer[]
  createdAt  DateTime     @default(now())
}

model GamePlayer {
  game       Game   @relation(fields: [gameId], references: [id])
  gameId     String
  user       User   @relation(fields: [userId], references: [id])
  userId     String
  secretCard Card?  @relation(fields: [secretCardId], references: [id])
  secretCardId String?
  @@id([gameId, userId])
}

enum GameStatus { LOBBY ACTIVE FINISHED }
```

### Docker

Backend containerised. `Dockerfile` multi-stage:
1. `builder` — installs deps, runs `prisma generate`, compiles TypeScript
2. `runner` — copies compiled output + `node_modules`, runs `node dist/index.js`

DB migrations (`prisma migrate deploy`) run at container startup.

---

## Infrastructure (AWS CDK)

All resources in single CDK app under `infrastructure/`. Stacks split by concern for independent deploy/update.

### Stacks

| Stack              | Resources                                              |
|--------------------|--------------------------------------------------------|
| `NetworkStack`     | VPC, subnets, security groups                          |
| `DatabaseStack`    | RDS PostgreSQL (Multi-AZ in prod, single in dev)       |
| `StorageStack`     | S3 bucket for card images (private, CORS for uploads)  |
| `AuthStack`        | Cognito User Pool + App Client                         |
| `BackendStack`     | ECR repo, App Runner service                           |
| `FrontendStack`    | S3 bucket (static hosting) + CloudFront distribution  |

### App Runner

- Pulls image from ECR on deploy
- Env vars injected at deploy: `DATABASE_URL`, `S3_BUCKET`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
- Auto-scaling: min 1, max 5 instances
- Health check: `GET /health`

### RDS

- Engine: PostgreSQL 15
- Instance: `db.t3.micro` (dev), `db.t3.small` (prod)
- Credentials in Secrets Manager, referenced by App Runner env vars

### S3 (images)

- Private bucket, no public read
- CORS allows PUT from frontend origin for pre-signed upload URLs
- CloudFront NOT in front — images served via pre-signed GET URLs

### CloudFront (frontend)

- Origin: S3 static hosting bucket
- Default root: `index.html`
- Custom error: 404 → `index.html` (enables Vue Router history mode)
- Cache: long TTL on hashed assets, short TTL on `index.html`

---

## CI/CD (GitHub Actions)

Three independent workflows, each triggered by changes to respective package directory.

### `frontend.yml`

Trigger: push to `main`, changes in `frontend/**`

1. `npm ci && npm run build` (with `VITE_API_URL` from secrets)
2. Sync `dist/` to S3 frontend bucket
3. Invalidate CloudFront distribution

### `backend.yml`

Trigger: push to `main`, changes in `backend/**`

1. `docker build`, tag with commit SHA
2. Push image to ECR
3. Update App Runner service to new image tag

### `infrastructure.yml`

Trigger: push to `main`, changes in `infrastructure/**`

1. `npm ci`
2. `npx cdk diff` (printed to job log)
3. `npx cdk deploy --all --require-approval never`

---

## Canary Connectivity Step

Before building features on newly deployed layer, verify end-to-end connectivity:

- **Backend canary**: `GET /health` returns `{ status: "ok" }`
- **Frontend canary**: on load, fetch `/api/health`, display response on screen

Must pass before feature work begins on that layer. See `docs/bootstrap.md` for when to run.