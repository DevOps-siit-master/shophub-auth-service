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

Requirements: Node.js 22+, Docker.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env

# 3. Start PostgreSQL (host port 5433)
docker compose up -d postgres

# 4. Run the service in watch mode
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
├── users/      # User entity + service (PR2)
└── auth/       # auth controller/service, JWT, SIWE (PR3–PR5)
```
