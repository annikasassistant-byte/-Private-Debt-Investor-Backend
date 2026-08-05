# Depth Dashboard API

Production-oriented Node.js (ES Modules) backend for the Depth Dashboard platform. Built with Express-style layering, MongoDB, Redis, BullMQ, Socket.IO, and JWT auth.

## Table of contents

- [Installation](#installation)
- [Folder structure](#folder-structure)
- [Architecture](#architecture)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Auth flow](#auth-flow)
- [Redis](#redis)
- [MongoDB Atlas](#mongodb-atlas)
- [Docker](#docker)
- [Swagger](#swagger)
- [Queues, cron, events & sockets](#queues-cron-events--sockets)
- [Testing](#testing)
- [CI/CD](#cicd)
- [API versioning](#api-versioning)
- [Best practices](#best-practices)

---

## Installation

**Requirements:** Node.js ≥ 20, Redis 7+, MongoDB 7+ (local or Atlas).

```bash
cd server
cp .env.example .env
# Edit secrets: JWT_*, COOKIE_SECRET, MONGODB_URI, REDIS_URL

npm install
npm run seed          # permissions, roles, admin
npm run dev           # nodemon on src/server.js
```

Health check (once the HTTP app is running):

```text
GET /api/v1/health
GET /api/v1/health/ready
```

---

## Folder structure

```text
server/
├── docker/                 # Dev Dockerfile
├── .github/workflows/      # CI + deploy stubs
├── uploads/                # Local uploads (.gitkeep)
├── logs/                   # Rotated logs (.gitkeep)
├── src/
│   ├── config/             # env, db, redis, jwt, logger, swagger, …
│   ├── constants/          # HTTP status, messages, error codes, cache keys
│   ├── controllers/        # HTTP handlers (thin)
│   ├── cron/               # Scheduled cleanup jobs
│   ├── di/                 # Simple DI container
│   ├── docs/               # Extra Swagger path defs
│   ├── enums/              # Roles, permissions, token types
│   ├── events/             # EventEmitter bus + domain listeners
│   ├── exceptions/         # Typed AppException hierarchy
│   ├── factories/          # Test/seed factories
│   ├── helpers/            # device / query helpers
│   ├── jobs/               # BullMQ workers
│   ├── middlewares/        # auth, validate, rate-limit, error
│   ├── models/             # Mongoose schemas
│   ├── permissions/        # Permission catalog
│   ├── policies/           # Authorization policies
│   ├── queues/             # BullMQ producers + Redis connection
│   ├── repositories/       # Data access
│   ├── routes/             # Versioned route mounts
│   ├── scripts/            # seed, migrate, createAdmin
│   ├── seeders/            # Idempotent seeders
│   ├── services/           # Business logic
│   ├── sockets/            # Socket.IO bootstrap
│   ├── templates/emails/   # HTML email templates
│   ├── tests/              # Unit + integration + mocks
│   ├── utils/              # password, jwt, pagination, ApiError, …
│   ├── validators/         # Zod / schema validators
│   ├── app.js              # Express app (no listen)
│   └── server.js           # Process entry: listen, workers, sockets
├── Dockerfile
├── docker-compose.yml
├── jest.config.js
├── package.json
└── README.md
```

---

## Architecture

Layered, dependency-injected design:

```text
HTTP / Socket
    ↓
Controllers / Socket handlers
    ↓
Services  ←  Events (side effects)  ←  Queues / Email / Notifications
    ↓
Repositories
    ↓
MongoDB / Redis
```

| Concern          | Location                              |
| ---------------- | ------------------------------------- |
| Config & secrets | `src/config` (Zod-validated `env.js`) |
| Domain logic     | `src/services`                        |
| Persistence      | `src/repositories` + `src/models`     |
| Cross-cutting    | middlewares, policies, exceptions     |
| Async work       | BullMQ queues + workers               |
| Realtime         | Socket.IO (`src/sockets`)             |
| Side effects     | `src/events` bus                      |

Call `initEvents()`, `startWorkers()`, `startCronJobs()`, and `initSocket(httpServer)` from `server.js` after the HTTP server is created.

---

## Environment variables

Copy `.env.example` → `.env`. Critical values:

| Variable                                   | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `NODE_ENV`                                 | `development` \| `production` \| `test` \| `staging` |
| `PORT`                                     | HTTP port (default `5000`)                           |
| `API_PREFIX`                               | Route prefix (default `/api/v1`)                     |
| `MONGODB_URI`                              | Mongo connection string                              |
| `REDIS_URL`                                | Redis for cache, sessions, BullMQ                    |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 chars                                           |
| `COOKIE_SECRET`                            | Cookie signing (≥ 32 chars)                          |
| `SMTP_*`                                   | Transactional email                                  |
| `QUEUE_*`                                  | BullMQ prefix, concurrency, retries                  |
| `SOCKET_*`                                 | Socket.IO path & CORS                                |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`           | Seed / createAdmin                                   |

Full list and defaults live in `src/config/env.js` and `.env.example`.

---

## Scripts

| Script                   | Command                 |
| ------------------------ | ----------------------- |
| Dev (nodemon)            | `npm run dev`           |
| Production start         | `npm start`             |
| Seed DB                  | `npm run seed`          |
| Migrations (placeholder) | `npm run migrate`       |
| Create admin             | `npm run create-admin`  |
| Tests                    | `npm test`              |
| Coverage                 | `npm run test:coverage` |
| Lint                     | `npm run lint`          |

Create admin with overrides:

```bash
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='StrongPass123!' npm run create-admin
# or
node src/scripts/createAdmin.js --email=you@company.com --password='StrongPass123!'
```

---

## Auth flow

1. **Register** → user created → `user.registered` event → verification / welcome email queued.
2. **Login** → credentials checked, lockout respected → access + refresh JWTs issued (cookies and/or body) → `user.login` event.
3. **Access token** → short-lived; sent as `Authorization: Bearer` or httpOnly cookie.
4. **Refresh** → rotate refresh token (family / reuse detection via Redis + optional Mongo backup).
5. **Logout** → revoke refresh token, clear cookies.
6. **Password reset / email verify / OTP** → token or OTP in Redis with TTL; emails via queue.

Socket handshake verifies JWT, **access-token blacklist**, and account lock/active flags (same rules as HTTP auth).

**Redis unavailable:** login/register/forgot/OTP brute-force counters **fail closed** (HTTP 503). Do not run production auth without Redis. Mongo account lockout still applies when Redis is up for failed passwords.

---

## Redis

Used for:

- Cache (`cache.service`, `redis.helper`)
- Refresh-token / OTP / rate metadata / access-token blacklist
- Auth brute-force counters (**required** for sensitive auth paths)
- **BullMQ** job queues (dedicated connection with `maxRetriesPerRequest: null`)

Local:

```bash
docker compose up redis -d
# REDIS_URL=redis://localhost:6379
```

---

## MongoDB Atlas

1. Create a cluster and database user.
2. Allow network access (IP allowlist or VPC peering).
3. Set:

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/depth_dashboard?retryWrites=true&w=majority
```

4. In production Compose, **omit** the `mongo` service and point `MONGODB_URI` at Atlas.
5. Prefer TLS (Atlas default) and avoid embedding passwords in shell history.

---

## Docker

**Production multi-stage image:**

```bash
docker build -t depth-dashboard-api .
docker run --env-file .env -p 5000:5000 depth-dashboard-api
```

**Full stack (app + Mongo + Redis):**

```bash
docker compose up --build
```

**Dev image:** `docker/Dockerfile.dev` (full `npm install` + `npm run dev`).

Volumes: `mongo_data`, `redis_data`, `app_uploads`, `app_logs`. Network: `depth-net`.

---

## Swagger

- Spec builder: `src/config/swagger.js`
- Extra paths: `src/docs/swagger.paths.js`
- UI path: `SWAGGER_PATH` (default `/api-docs`)
- Disable in prod if desired: `SWAGGER_ENABLED=false`

Annotate routes with OpenAPI JSDoc; merge `swaggerPaths` when mounting the docs middleware.

---

## Queues, cron, events & sockets

| Module         | Role                                       |
| -------------- | ------------------------------------------ |
| `src/queues/*` | Email & notification producers             |
| `src/jobs/*`   | Workers (`startWorkers()`)                 |
| `src/cron`     | Expired tokens + soft-deleted user purge   |
| `src/events`   | `USER_REGISTERED`, `USER_LOGIN` listeners  |
| `src/sockets`  | `initSocket(httpServer)` + event constants |

Cron examples (UTC): tokens daily `02:15`, soft-deleted users Sundays `03:30`. Retention: `SOFT_DELETE_RETENTION_DAYS` (default 30).

---

## Testing

```bash
npm test
```

- Unit: password, pagination, `ApiError`
- Integration: auth & health via Supertest — **skipped** when `app.js` is missing or Mongo is unreachable (`describe.skip` pattern)
- Mocks: `src/tests/mocks/redis.mock.js`, `user.mock.js`
- Setup: `jest.setup.js` + `src/tests/setup.js`

Jest runs with `--experimental-vm-modules` for native ESM.

---

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint → test → Docker build on push/PR
- **Deploy** (`.github/workflows/deploy.yml`): manual / tag-driven stub with GitHub **Environment** protection notes

If this package lives under a monorepo root, move workflows to the repository root `.github/workflows/` and set `working-directory: server`.

---

## API versioning

- Default prefix: `/api/v1` (`API_PREFIX`)
- Mount routers under that prefix only
- Breaking changes → `/api/v2` with parallel support window
- Deprecate old versions via response headers / changelog, not silent behavior changes

---

## Best practices

- Never commit `.env`; rotate JWT/cookie secrets regularly
- Keep controllers thin; put rules in services/policies
- Prefer typed exceptions (`ApiError` / domain exceptions) over raw `Error` in request paths
- Soft-delete by default; hard-delete only via retention cron
- Queue emails/notifications — don’t block HTTP on SMTP
- Validate all env at boot (`src/config/env.js`)
- Log with Winston; don’t log secrets or full tokens
- Use Docker healthchecks and readiness (`/health/ready`) behind your load balancer
- Protect production deploys with GitHub Environment required reviewers

---

## License

MIT — Depth Dashboard Team
