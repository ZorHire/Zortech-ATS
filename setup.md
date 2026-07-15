# Local Development Setup

Follow these steps to run ZorHire on your local machine.

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | v18+ | Backend + Frontend |
| npm | v9+ | Package management |
| Docker Desktop | latest | Option A database setup (recommended) |
| PostgreSQL | v14+ | Option B (if not using Docker) |

---

## Step 1 — Clone the repository

```bash
git clone <repository-url>
cd zortech-hosting
```

---

## Step 2 — Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set at minimum:
- `SERVER_DATABASE_URL` (see Step 3 — two options)
- `SERVER_JWT_SECRET` → any long random string, e.g.:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Everything else (`GEMINI_API_KEY`, `RAZORPAY_*`) can stay blank — those features simply won't be active in dev.

---

## Step 3 — Start the database (pick one option)

### Option A — Docker (recommended, no sign-up needed)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop) to be running.

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts a local PostgreSQL and Redis. Your `.env.example` already has the matching connection strings:

```
SERVER_DATABASE_URL=postgresql://zortech:zortech@localhost:5432/zortech_hosting
REDIS_URL=redis://localhost:6379
```

To stop the containers later:
```bash
docker compose -f docker-compose.dev.yml down
```

To stop and wipe all data:
```bash
docker compose -f docker-compose.dev.yml down -v
```

---

### Option B — Free cloud Postgres

Sign up for a free Postgres database (any of these work):

- [Neon](https://neon.tech) — serverless, generous free tier
- [Supabase](https://supabase.com) — free tier, also has a local Docker option
- [Railway](https://railway.app) — free trial credits

Once you have a project, copy the connection string (usually shown as "Connection URL" or "DATABASE_URL") and set it in `.env`:

```
SERVER_DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

For Redis in development, you can use [Upstash](https://upstash.com) free tier or keep using the Docker Redis from Option A alongside a cloud Postgres.

---

## Step 4 — Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## Step 5 — Run database migrations

From the `backend/` directory:

```bash
npm run migrate
```

This runs `schema.sql` (creates all tables) followed by all files in `src/db/migrations/` in order. It is **additive only** — safe to run multiple times.

**Expected output:**
```
Starting database migration (additive only — no data loss)...
Connecting to: localhost:5432/zortech_hosting
  Applying 001_extend_clients.sql...
  ...
  Applying 012_notifications.sql...
Migration completed successfully — existing data preserved.
```

If it fails, the most likely cause is a wrong `SERVER_DATABASE_URL` — double-check the host, port, user, password, and database name.

---

## Step 6 — Start the application

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
Server starts at `http://localhost:5000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
App available at `http://localhost:5173`

---

## Default admin account

After migration, log in with:

| Field | Value |
|-------|-------|
| Email | `hr@zortechs.in` |
| Password | `Solutions1!` |

This account has `super_admin` role and can invite other users via the Admin panel.

---

## Production build

```bash
# Backend
cd backend && npm run build   # outputs to backend/dist/

# Frontend
cd frontend && npm run build  # outputs to frontend/dist/
```

For VPS deployment, see `docker-compose.yml` (the production compose file) and `vps-setup.sh`.

---

## Troubleshooting

**Migration fails with "connection refused"**
→ The database isn't running. If using Docker, run `docker compose -f docker-compose.dev.yml up -d` first.

**Migration fails with "password authentication failed"**
→ The credentials in `SERVER_DATABASE_URL` don't match what Postgres has. For the Docker setup, credentials are `zortech:zortech`.

**Backend starts but returns 401 on all requests**
→ The frontend's `VITE_API_URL` doesn't match the backend port. Ensure `.env` has `VITE_API_URL=http://localhost:5000/v1`.

**Email features not working**
→ Set `EMAIL_ENCRYPTION_KEY` (generate with the command in `.env.example`) and configure SMTP credentials in Admin → Email Settings.

**AI resume parsing not working**
→ Set `GEMINI_API_KEY` in `.env` with a key from Google AI Studio.
