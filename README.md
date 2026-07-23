# Task API — PostgreSQL + Docker (A3)

A CRUD REST API for managing tasks, built with **Express** and **PostgreSQL** running in **Docker**.  
This is the third storage iteration of the same API: memory (A1) → SQLite (A2) → containerized Postgres (A3).  
The API surface never changed. Only the repository file was swapped each time.

---

## One-command startup

```bash
# Copy environment template
cp .env.example .env

# Start everything (Postgres + app)
docker compose up --build
```

App: <http://localhost:3000>  
Swagger UI: <http://localhost:3000/api-docs>  
Health check: <http://localhost:3000/health>

---

## Environment variables

Copy `.env.example` → `.env` and fill in your values. **Never commit `.env`.**

| Variable | Example | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:dev@localhost:5432/tasks` | Postgres connection string |
| `PORT` | `3000` | Port the app listens on |

---

## Endpoints

| Method | Path | Description | Success | Error |
|---|---|---|---|---|
| `GET` | `/tasks` | List all tasks (supports `?search=` and `?done=`) | 200 | — |
| `GET` | `/tasks/:id` | Get one task | 200 | 404 |
| `POST` | `/tasks` | Create a task (`{ "title": "..." }`) | 201 | 400 |
| `PUT` | `/tasks/:id` | Update a task (`{ "title": "...", "done": true }`) | 200 | 404 |
| `DELETE` | `/tasks/:id` | Delete a task | 204 | 404 |
| `GET` | `/stats` | Task counts (total / completed / pending) | 200 | — |
| `GET` | `/health` | Health check — pings the database | 200 | 503 |

> `/todos` is an alias for all `/tasks` routes.

---

## Example curl commands

```bash
# List all tasks
curl -i http://localhost:3000/tasks

# Create a task
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Ship A3"}'

# Mark done
curl -i -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

# Delete
curl -i -X DELETE http://localhost:3000/tasks/1

# 404 example
curl -i http://localhost:3000/tasks/999
```

---

## Proving persistence

```bash
# 1. Start the stack and create some tasks
docker compose up --build -d
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Survive restart"}'

# 2. Tear everything down (containers gone, volume stays)
docker compose down

# 3. Bring it back — rows are still there
docker compose up -d
curl http://localhost:3000/tasks   # ← "Survive restart" is still here
```

---

## Architecture

```
server.js          ← Express routes + Swagger (no DB code)
src/
  db.js            ← pg Pool (reads DATABASE_URL)
  repository.js    ← ONLY file that touches Postgres
Dockerfile         ← builds the app image
compose.yaml       ← wires api + db services together
.env               ← secrets (gitignored)
.env.example       ← committed template
```

**Swapping storage = changing one file (`src/repository.js`).** Routes and handlers are untouched across all three storage iterations. This is the architecture proof the assignment asks for.

---

## Running locally (without Docker)

```bash
# Requires a local Postgres or a running `docker run` container
npm install
# Set DATABASE_URL in .env pointing to your Postgres
npm start
```

---

## Database screenshot

<!-- Replace with your own psql screenshot after running docker compose up -->
![DB screenshot](db-screenshot.png)
