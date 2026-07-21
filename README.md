# Tasks API — SQLite Edition

A Node.js + Express CRUD API for managing tasks, backed by a **SQLite database** (`tasks.db`).  
Data now **survives server restarts** — tasks are stored on disk, not in memory.

---

## Why SQLite?

SQLite was chosen because:
- **Zero configuration** — no separate database server to install or run
- **Single file** — the entire database lives in `tasks.db` in the project root
- **Perfect for learning** — shows the separation between API layer and data layer without operational overhead
- **Production-proven** — used in millions of apps worldwide (browsers, mobile apps, embedded systems)

---

## Where is the database file?

```
Flyrank Assignment1/
├── tasks.db       ← SQLite database (created automatically on first run)
├── server.js
├── package.json
└── README.md
```

The file is created **automatically** the first time you run the server.  
On first run, **3 example tasks** are seeded. They will not be re-inserted on subsequent restarts.

---

## How to start the project

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
```

Server starts at `http://localhost:3000`.  
Interactive API docs (Swagger UI) available at `http://localhost:3000/api-docs`.

---

## API Endpoints

Both `/tasks` and `/todos` routes are supported (identical behaviour).

| Method | Path           | Description                        | Status codes    |
|--------|----------------|------------------------------------|-----------------|
| GET    | `/tasks`       | Return all tasks                   | 200             |
| GET    | `/tasks?search=milk` | Search tasks by title (LIKE) | 200             |
| GET    | `/tasks?done=true`   | Filter by completion status  | 200             |
| GET    | `/tasks/:id`   | Return one task by id              | 200, 404        |
| POST   | `/tasks`       | Create a new task                  | 201, 400        |
| PUT    | `/tasks/:id`   | Update title and/or done status    | 200, 404        |
| DELETE | `/tasks/:id`   | Delete a task                      | 200, 404        |
| GET    | `/stats`       | Task counts (total/done/pending)   | 200             |

---

## Test with curl

```bash
# Get all tasks
curl http://localhost:3000/tasks

# Get one task
curl http://localhost:3000/tasks/1

# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Learn SQLite\"}"

# Mark as done
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d "{\"done\": true}"

# Delete a task
curl -X DELETE http://localhost:3000/tasks/4

# Search tasks
curl "http://localhost:3000/tasks?search=buy"

# Filter completed tasks
curl "http://localhost:3000/tasks?done=true"

# Get statistics
curl http://localhost:3000/stats
```

---

## Database Schema

```sql
CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,   -- 0 = false, 1 = true
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
```

---

## Example SQL Queries (Stage 4)

Open `tasks.db` in [DB Browser for SQLite](https://sqlitebrowser.org/) and run these:

```sql
-- List every task
SELECT * FROM tasks;

-- Show only completed tasks
SELECT * FROM tasks WHERE done = 1;

-- Count all tasks
SELECT COUNT(*) FROM tasks;

-- Mark every task as completed
UPDATE tasks SET done = 1;

-- Delete all completed tasks
DELETE FROM tasks WHERE done = 1;
```

> **Note:** Changes made directly in the database are immediately reflected in the API.

---

## Database Viewer Screenshot

The screenshot below shows the `tasks` table open in **DB Browser for SQLite**, displaying all 5 rows with their `id`, `title`, `done`, `created_at`, and `updated_at` columns:

![DB Browser for SQLite showing the tasks table](db-screenshot.png)

---

## Swagger API Docs Screenshot

Interactive API documentation available at `http://localhost:3000/api-docs`:

![Swagger UI showing all CRUD endpoints](swagger-screenshot.png)

---

## Architecture

```
Client Request
      │
      ▼
 Express Router  (/tasks or /todos)
      │
      ▼
 better-sqlite3  (synchronous SQL queries)
      │
      ▼
   tasks.db      (SQLite file on disk)
```

The API layer and the data layer are completely separate.  
Moving from SQLite to PostgreSQL or MySQL would only require changing the database queries — not the endpoints.
