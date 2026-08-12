# Convert the repo to an npm workspace and move the wire contract into packages/contract, the Docker build context is backend/ so COPY paths rootDir and the CI path filters all move

## Metadata

- Priority: D
- Created: 2026-08-11
- Due: 2026-09-16
- Projects: +cicd
- Contexts: @sev3, @chore

## Task

```todo.txt
(D) 2026-08-11 Convert the repo to an npm workspace and move the wire contract into packages/contract, the Docker build context is backend/ so COPY paths rootDir and the CI path filters all move +cicd @sev3 @chore due:2026-09-16 note:projects/tuxedo-tasks/npm-workspace-and-shared-contract-package.md
```

## My notes

### The gap

The protocol is declared once, in `backend/src/types/socket.ts`, inside a package
the frontend cannot reach. `frontend/package.json` has one dependency, `vue`.
The two are independent npm packages, not a workspace.

The Pinia, router, and socket-client tickets each write the client half of this
seam. Without a shared contract they will re-declare the protocol by hand, and a
renamed event or a changed payload will then break at runtime rather than at
build.

### What crosses the seam

Types only. No runtime values — no zod schemas, no shared constants. Schemas stay
server-side; the client enforces its own input limits for UX and treats the
server's 400 as the authority. Error codes can be a union of string literals,
which is still type-only.

That constraint is what keeps this ticket to plumbing. Nothing in
`packages/contract` compiles to JavaScript that ships.

### What makes it cost a day

`backend/Dockerfile` builds with `backend/` as its build context:

```
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
```

A workspace symlinks its packages into the **root** `node_modules`. Inside that
image there is no root `package.json`, no root `node_modules`, and
`packages/contract` is not in the build context at all, so `npm ci` cannot
resolve the package.

Everything that has to move:

- Docker build context to the repo root, and every `COPY` path rewritten.
- A `.dockerignore`, so a backend image stops shipping the frontend and CDK
  dependency trees.
- `backend/tsconfig.json` `rootDir`, which currently pins `./src`.
- `backend-ci.yml` `working-directory` and its path filters, which today never
  fire on a change to a shared package.
- Reconciling `nodenext` resolution on the backend against Vite's bundler
  resolution on the frontend.

Alternatives considered and rejected: a frontend `tsconfig` path alias reaching
into `backend/src` (cheap, but smuggles the dependency rather than declaring it),
and a copied file with a CI drift check (two files that must stay identical is
the problem, not the fix).

### Blocked by

The `GameView` projection module, and only that.

`GameSnapshotPayload` is `Game & { players: GamePlayer[] }` — Prisma's
**generated** types. Moving `types/socket.ts` into a shared package as it stands
would make `packages/contract` depend on `src/generated/prisma`, and then make
the frontend depend on it transitively. A shared contract package importing the
database's generated client is worse than the problem being solved.

The projection module is what severs that. So the contract has to be born holding
hand-written view types, which means the projection lands first.

The card-image path change and the `game:end-turn` rename both alter the
contract's *contents*, but neither gates this migration — they change a field and
a string. If they land after, the edit is one line in a package with no external
consumers.

### Acceptance

- Both packages import the contract by name, not by relative path.
- The backend image builds and runs.
- Backend CI triggers on a change to the contract package.
- A backend image does not contain frontend or CDK dependencies.
- `packages/contract` imports nothing from `src/generated`.
- Nothing in `packages/contract` emits runtime JavaScript.

### Related

This is build tooling, so it is mine to build outright rather than tutor.
