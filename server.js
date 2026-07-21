const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ─── Stage 0: Database Setup ────────────────────────────────────────────────
// Open (or create) the SQLite database file
const db = new Database('tasks.db');

// Create the tasks table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  )
`);

// Seed three example tasks only on the very first run (when the table is empty)
const rowCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
if (rowCount.count === 0) {
  const now = new Date().toISOString();
  const seed = db.prepare(
    'INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, 0, ?, ?)'
  );
  seed.run('Buy groceries', now, now);
  seed.run('Walk the dog', now, now);
  seed.run('Read a book', now, now);
  console.log('✅ Seeded 3 example tasks into the database.');
}

// ─── Swagger Setup ──────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tasks / To-Do API',
      version: '2.0.0',
      description:
        'A CRUD API for managing tasks — now backed by a SQLite database. ' +
        'Data persists across server restarts. Both /todos and /tasks routes are supported.',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Helper ─────────────────────────────────────────────────────────────────
// Convert SQLite integer (0/1) to a proper JS boolean for API responses
function formatTask(task) {
  return { ...task, done: task.done === 1 };
}

// ─── Swagger Schemas ────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated primary key
 *         title:
 *           type: string
 *           description: The task title
 *         done:
 *           type: boolean
 *           description: Whether the task is completed
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: ISO timestamp of creation
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: ISO timestamp of last update
 *       example:
 *         id: 1
 *         title: Buy groceries
 *         done: false
 *         created_at: "2025-01-01T00:00:00.000Z"
 *         updated_at: "2025-01-01T00:00:00.000Z"
 */

/**
 * @swagger
 * tags:
 *   - name: Tasks
 *     description: Task management endpoints (/tasks and /todos are identical)
 *   - name: Stats
 *     description: Database statistics
 */

// ─── Stage 1: GET all tasks ─────────────────────────────────────────────────

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Return all tasks
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter tasks by title (SQL LIKE search)
 *       - in: query
 *         name: done
 *         schema:
 *           type: boolean
 *         description: Filter by completion status (true or false)
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 */
function getAllTasksHandler(req, res) {
  const { search, done } = req.query;

  let query = 'SELECT * FROM tasks';
  const params = [];
  const conditions = [];

  // Optional: filter by search term using LIKE
  if (search) {
    conditions.push('title LIKE ?');
    params.push(`%${search}%`);
  }

  // Optional: filter by done status
  if (done !== undefined) {
    conditions.push('done = ?');
    params.push(done === 'true' ? 1 : 0);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Optional: sort alphabetically by title
  query += ' ORDER BY title ASC';

  const tasks = db.prepare(query).all(...params);
  res.json(tasks.map(formatTask));
}

app.get('/tasks', getAllTasksHandler);
app.get('/todos', getAllTasksHandler);

// ─── Stage 1: GET single task ────────────────────────────────────────────────

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Return a task by id
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The task id
 *     responses:
 *       200:
 *         description: The task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
function getOneTaskHandler(req, res) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(formatTask(task));
}

app.get('/tasks/:id', getOneTaskHandler);
app.get('/todos/:id', getOneTaskHandler);

// ─── Stage 2: POST — create a new task ──────────────────────────────────────

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Title is required
 */
function createTaskHandler(req, res) {
  const { title } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, 0, ?, ?)')
    .run(title.trim(), now, now);

  // Fetch the newly created task to return it
  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(formatTask(newTask));
}

app.post('/tasks', createTaskHandler);
app.post('/todos', createTaskHandler);

// ─── Stage 3: PUT — update a task ───────────────────────────────────────────

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update a task by id
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The task id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               done:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
function updateTaskHandler(req, res) {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title, done } = req.body;
  const updatedTitle = title !== undefined ? title.trim() : existing.title;
  const updatedDone  = done  !== undefined ? (done ? 1 : 0) : existing.done;
  const now = new Date().toISOString();

  db.prepare(
    'UPDATE tasks SET title = ?, done = ?, updated_at = ? WHERE id = ?'
  ).run(updatedTitle, updatedDone, now, req.params.id);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(formatTask(updatedTask));
}

app.put('/tasks/:id', updateTaskHandler);
app.put('/todos/:id', updateTaskHandler);

// ─── Stage 3: DELETE — remove a task ────────────────────────────────────────

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task by id
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The task id
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 */
function deleteTaskHandler(req, res) {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted successfully' });
}

app.delete('/tasks/:id', deleteTaskHandler);
app.delete('/todos/:id', deleteTaskHandler);

// ─── Optional Extra: GET /stats ──────────────────────────────────────────────

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Return task statistics from the database
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Task counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 completed:
 *                   type: integer
 *                 pending:
 *                   type: integer
 */
app.get('/stats', (req, res) => {
  const total     = db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;
  const completed = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE done = 1').get().count;
  const pending   = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE done = 0').get().count;
  res.json({ total, completed, pending });
});

// ─── Original utility routes (kept for backward compatibility) ───────────────
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello, world!',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/time', (req, res) => {
  res.json({
    utc: new Date().toUTCString(),
    unix: Date.now(),
  });
});

// ─── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running    → http://localhost:${PORT}`);
  console.log(`Swagger Docs      → http://localhost:${PORT}/api-docs`);
  console.log(`Database file     → tasks.db`);
});
