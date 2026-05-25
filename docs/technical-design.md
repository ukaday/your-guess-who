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

- **Emit**: `game:join`, `game:eliminate`, `game:guess`, `game:concede`
- **Listen**: `game:started`, `game:your-card`, `game:turn-ended`, `game:over`, `game:opponent-disconnected`, `game:opponent-reconnected`, `game:error`

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
| POST   | `/auth/login`      | Authenticate, return `{ token }` (Cognito AccessToken) |

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

| Event            | Payload                 | Action                                                                                      |
|------------------|-------------------------|---------------------------------------------------------------------------------------------|
| `game:join`      | `{ gameId }`            | Verify user is a `GamePlayer` for this game, join socket room. Re-emit `game:your-card` + full game state to that socket (handles reconnect). If both players now in room and game is LOBBY: randomly assign secret cards, randomly pick first `activePlayerId`, set status → ACTIVE, emit `game:started` to room + `game:your-card` to each socket individually |
| `game:eliminate` | `{ cardIds: string[] }` | Validate game ACTIVE + sender is `activePlayerId`; advance `activePlayerId` to opponent; emit `game:turn-ended` to room. `cardIds` accepted but not persisted — stored in future for visible opponent board feature |
| `game:guess`     | `{ cardId }`            | Validate game ACTIVE + sender is `activePlayerId`. Correct (`cardId` === opponent's `secretCardId`): set `winnerId`, status → FINISHED, emit `game:over` to room with both secret cards revealed. Wrong: advance `activePlayerId` to opponent, emit `game:turn-ended` with `guessedCardId` so guesser can eliminate it locally |
| `game:concede`   | —                       | Validate game ACTIVE + sender is a player; set `winnerId` to opponent, status → FINISHED; emit `game:over` to room |

**Server-emitted events**:

| Event                      | Target  | Payload                                          |
|----------------------------|---------|--------------------------------------------------|
| `game:started`             | room    | Full game state (no secret cards)                |
| `game:your-card`           | socket  | `{ cardId }` — sent individually, never to room |
| `game:turn-ended`          | room    | Full game state + optional `{ guessedCardId }`  |
| `game:over`                | room    | `{ winnerId, reason, revealedCards }`            |
| `game:opponent-disconnected` | room  | —                                                |
| `game:opponent-reconnected`  | room  | —                                                |
| `game:error`               | socket  | `{ message }` — dev: full error, prod: generic  |

Questions are asked verbally in real life — no in-app chat or question events.

Connection auth: JWT passed as `auth.token` in Socket.io handshake. Invalid/missing token rejected at handshake (`connect_error` on client).

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
  id             String       @id @default(cuid())
  inviteCode     String       @unique
  status         GameStatus
  deck           Deck         @relation(fields: [deckId], references: [id])
  deckId         String
  players        GamePlayer[]
  activePlayerId String?      // null until ACTIVE
  winnerId       String?      // null until FINISHED
  createdAt      DateTime     @default(now())
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

All resources in single CDK app under `infrastructure/`. Stacks split by concern for independent deploy/update. Entry point: `bin/app.ts`. Stack definitions: `lib/`. Runs via `tsx` (same pattern as backend).

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
- Health check: `GET /api/health`

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

Requires Phase 4 (Infrastructure) to be deployed first — workflows reference AWS resource IDs added to GitHub Actions secrets from CDK outputs.

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

- **Backend canary**: `GET /api/health` returns `{ status: "ok" }`
- **Frontend canary**: on load, fetch `/api/health`, display response on screen

Must pass before feature work begins on that layer. See `docs/bootstrap.md` for when to run.

---

## Future Enhancements

- **Invite code collision handling** — codes are 6-char UUID-derived (alphanumeric uppercase). Collision probability is negligible at current scale but not zero. Future: retry generation on `P2002` unique constraint violation, or switch to a larger code space.
- **Eliminated cards persistence** — currently client-only state, lost on refresh. Future: persist per-player eliminated card IDs in DB to support reconnect board restoration and visible opponent elimination count.
- **Finished game cleanup** — completed games are kept indefinitely. Future: scheduled job to archive or delete games older than X days.
- **Typed Socket.io event maps** — currently using `Record<string, never>` (no typed events). Future: define `ClientEvents` and `ServerEvents` maps so `socket.emit`/`socket.on` are type-checked at compile time.

## Future Features

- **Persist eliminated cards** — add `GamePlayerCard` join table tracking which cards each player has eliminated; `game:turn-ended` payload includes each player's eliminated set; enables visible opponent board (shows how many cards opponent has eliminated)
- **Rematch** — post-game socket event to signal both players want rematch; server creates new game with same deck, new random secret cards
- **Spectators** — read-only socket room members; requires `game:join` permission check relaxed + in-app audio or text chat for questions/answers
- **Game archive + cleanup** — result history per user; cron job to purge `FINISHED` games older than 30 days