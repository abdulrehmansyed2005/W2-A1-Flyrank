# FlyRank Tasks & Auth API

A secure REST API built with **Node.js + Express**, backed by **PostgreSQL** (via Docker) and **Supabase Auth** for JWT-based authentication.

Built across 4 weekly assignments:
- **A1–A3**: Task CRUD API with PostgreSQL, Docker, and Swagger UI
- **A4**: Auth layer — Sign Up, Log In, Log Out, JWT middleware, protected routes, and stretch goals

---

## What this project does

| Layer | What it provides |
|-------|-----------------|
| **Task CRUD** | Create, read, update, delete tasks stored in PostgreSQL |
| **Supabase Auth** | Manages user accounts, hashes passwords, issues signed JWTs — your server never handles credentials directly |
| **JWT Middleware** | A single reusable `requireAuth` guard that verifies tokens on every protected route |
| **Swagger UI** | Interactive docs at `/docs` with a 🔒 Authorize button for testing protected routes from the browser |
| **Rate Limiting** | Brute-force protection on `POST /auth/login` — 5 attempts per 15 minutes |

---

## Environment setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (used by Docker) | `postgres://postgres:dev@localhost:5432/tasks` |
| `PORT` | Port the server listens on | `3000` |
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_KEY` | Your Supabase **publishable** (anon) key — safe to use in your app | `sb_publishable_...` |

> ⚠️ **Never commit `.env`**. It is in `.gitignore`. Your Supabase keys must not reach GitHub — bots scrape new keys within a minute.

---

## How to run

### Option A — with Docker (recommended, includes PostgreSQL)

```bash
docker compose up
```

### Option B — without Docker (Supabase auth only, no task DB)

```bash
npm install
npm run dev
```

Server starts at `http://localhost:3000`  
Swagger UI at `http://localhost:3000/docs`

---

## API Reference

### 🔓 Auth endpoints

| Method | Route | Auth required | Status codes | Description |
|--------|-------|:---:|---|---|
| `POST` | `/auth/signup` | ❌ | 201 · 400 | Register a new user account |
| `POST` | `/auth/login` | ❌ | 200 · 400 · 401 · 429 | Log in and receive a JWT access token |
| `POST` | `/auth/logout` | ✅ Bearer | 204 · 401 | End the session |
| `POST` | `/auth/refresh` | ❌ | 200 · 400 | Exchange refresh token for a new access token |

### 🌐 Public endpoints

| Method | Route | Auth required | Status codes | Description |
|--------|-------|:---:|---|---|
| `GET` | `/public/info` | ❌ | 200 | Public welcome message — no token needed |

### 🔒 Protected endpoints

| Method | Route | Auth required | Status codes | Description |
|--------|-------|:---:|---|---|
| `GET` | `/protected/profile` | ✅ Bearer | 200 · 401 | Returns authenticated user's profile (id, email, created_at) |
| `GET` | `/protected/dashboard` | ✅ Bearer | 200 · 401 | User dashboard with last sign-in and provider info |
| `GET` | `/protected/admin` | ✅ Bearer | 200 · 401 · **403** | Admin-only route — demonstrates 401 vs 403 |

### 📋 Task CRUD endpoints

| Method | Route | Auth required | Status codes | Description |
|--------|-------|:---:|---|---|
| `GET` | `/tasks` | ❌ | 200 | List all tasks (supports `?search=` and `?done=` filters) |
| `GET` | `/tasks/:id` | ❌ | 200 · 404 | Get a single task |
| `POST` | `/tasks` | ❌ | 201 · 400 | Create a new task |
| `PUT` | `/tasks/:id` | ❌ | 200 · 404 | Update a task |
| `DELETE` | `/tasks/:id` | ❌ | 204 · 404 | Delete a task |
| `GET` | `/stats` | ❌ | 200 | Task statistics |
| `GET` | `/health` | ❌ | 200 · 503 | Database health check |

---

## How authentication works

```
1. Client → POST /auth/signup or /auth/login  → credentials go to Supabase
2. Supabase → Client                          → returns a signed JWT (access_token)
3. Client → your server                       → sends JWT in Authorization: Bearer <token>
4. Server → Supabase                          → verifies the token (supabase.auth.getUser)
5. Supabase → Server → Client                → verified: route opens; invalid: 401
```

The `requireAuth` middleware in [`src/authMiddleware.js`](./src/authMiddleware.js) handles steps 3–5 for every protected route. Adding auth to a new route is one word: `requireAuth`.

---

## Using Swagger UI

1. Start the server: `npm run dev`
2. Open `http://localhost:3000/docs`
3. Call `POST /auth/login` → copy the `access_token` from the response
4. Click the **Authorize 🔒** button (top right)
5. Paste the token → click **Authorize**
6. Now try `GET /protected/profile` → **Try it out** → **Execute** → you get 200 ✅

---

## Status code reference

| Code | Meaning | When it appears |
|------|---------|----------------|
| `200` | OK | Successful GET or login |
| `201` | Created | Successful signup |
| `204` | No Content | Successful logout (no body) |
| `400` | Bad Request | Missing or invalid input fields |
| `401` | Unauthorized | No token, bad token, or expired token |
| `403` | Forbidden | Valid token — but you are not allowed (e.g. not an admin) |
| `429` | Too Many Requests | Rate limit exceeded on `/auth/login` |

### 401 vs 403 — the key difference

> **401 Unauthorized** = "I don't know who you are." The guard at the door doesn't recognise you — either no token was presented, or the token is fake/expired. Fix: log in and provide a valid token.
>
> **403 Forbidden** = "I know exactly who you are — and you may not enter." You are authenticated, but not authorised. Fix: you need elevated permissions (e.g. an admin role). Logging in again won't help.

---

## Stretch goals implemented

- ✅ **403 admin route** — `GET /protected/admin` returns 403 for non-admin users with explanation in README
- ✅ **Refresh token endpoint** — `POST /auth/refresh` exchanges a refresh token for a new access token
- ✅ **Rate limiting on login** — 5 attempts per 15 minutes on `POST /auth/login`, returns 429

### Why are access tokens short-lived?

Access tokens expire in ~1 hour by default. This limits the damage if a token is intercepted — an attacker's stolen token self-destructs quickly. The refresh token (longer-lived, stored securely) lets the client get a new access token without re-entering credentials.

### Why is instant logout hard with stateless JWTs?

When you call `POST /auth/logout`, Supabase invalidates the refresh token server-side. However, the **access token** technically remains valid for its remaining lifespan (up to 1 hour) because JWTs are stateless — your server verifies the signature, not a session record in a database. True instant revocation requires a token blocklist (a database lookup on every request), which trades the performance benefit of stateless JWTs for immediate revocation control.

---

## Swagger Screenshot

![Swagger UI showing lock icons on protected routes](./swagger-screenshot.png)

---

## Git log (assignment commits)

```
Stage 0: setup server and supabase client
Stage 1: signup and login routes working
Stage 2: public route and unverified protected route
Stage 3: profile route token verification
Stage 4: auth middleware and logout endpoint
Stage 5: Swagger UI documentation with bearer auth
Stage 6: publish to GitHub and write README
```

---

## Project structure

```
├── server.js              # All routes + Swagger config
├── src/
│   ├── supabaseClient.js  # Supabase singleton (Stage 0)
│   ├── authMiddleware.js  # Reusable JWT guard (Stage 4)
│   ├── repository.js      # PostgreSQL task queries
│   └── db.js              # pg Pool connection
├── .env                   # Secrets — git-ignored
├── .env.example           # Placeholder keys — committed
├── compose.yaml           # Docker Compose (PostgreSQL)
└── Dockerfile
```
