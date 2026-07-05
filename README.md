# ShopHub Auth Service

Authentication microservice for **ShopHub** (specification requirement **1.1 — Prijava i registracija korisnika**).
Built with **NestJS** as its own repository/microservice (per DevOps requirement 5.1).

Supports two authentication methods:

- **Email + password** — classic registration/login with JWT access & refresh tokens.
- **Web3 (SIWE)** — Sign-In With Ethereum (EIP-4361); optional per spec.

> No frontend. The API is exercised via the Swagger UI at `/api/docs`.

## Tech stack

- NestJS 11 + TypeScript
- PostgreSQL + TypeORM
- JWT (`@nestjs/jwt` + `passport-jwt`), argon2 password hashing
- SIWE (`siwe`) for Web3 auth
- Jest (unit) + Testcontainers (integration)
- Docker / docker-compose

## Local development

Requirements: Node.js 24+, Docker.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env

# 3. Start PostgreSQL (host port 5433)
docker compose up -d postgres

# 4. Apply database migrations
npm run migration:run

# 5. Run the service in watch mode
npm run start:dev
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/api/docs
- Health check: http://localhost:3000/health

### Run everything in Docker

```bash
docker compose up --build
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Run in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint check |
| `npm test` | Unit tests |
| `npm run test:e2e` | Integration tests (Testcontainers) |
| `npm run migration:run` | Apply pending TypeORM migrations |
| `npm run migration:generate -- src/database/migrations/<Name>` | Generate a migration from entity changes |
| `npm run migration:revert` | Roll back the last migration |

## Authentication API

Email/password auth (SIWE/Web3 arrives in a later PR). All request/response bodies
are documented and can be tried out in Swagger at `/api/docs`.

| Method & path | Auth | Body | Result |
| --- | --- | --- | --- |
| `POST /auth/register` | — | `{ email, password }` | `201` + `{ accessToken, refreshToken }` (`409` if email taken) |
| `POST /auth/login` | — | `{ email, password }` | `200` + `{ accessToken, refreshToken }` (`401` on bad credentials) |
| `POST /auth/refresh` | — | `{ refreshToken }` | `200` + a new `{ accessToken, refreshToken }` (`401` if invalid/expired) |
| `GET /auth/me` | Bearer access token | — | `200` + `{ userId, email }` (`401` if missing/invalid) |

Tokens are stateless JWTs signed with separate access/refresh secrets. Configure via
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` (see `.env.example`).

## Contributing (Trunk Based Development)

This repo strictly follows [Trunk Based Development](https://trunkbaseddevelopment.com/):

- `main` is the single trunk. Work happens on **short-lived** branches (`feat/...`, `fix/...`, `chore/...`).
- Every change goes through a **Pull Request**; direct pushes to `main` are not allowed.
- Each PR must pass **CI** (build + lint + unit + integration tests) and be approved by **at least one** teammate.
- **Squash merge** only → linear history on `main`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced locally via commitlint + husky and in CI).

## Project structure

```
src/
├── config/     # env validation
├── health/     # health/liveness endpoint
├── users/      # User entity + service
└── auth/       # email/password auth: controller, service, JWT strategy + guard
                #   Web3/SIWE (to be added)
```
