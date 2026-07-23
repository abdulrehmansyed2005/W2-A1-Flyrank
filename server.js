'use strict';

// Load .env before anything else so DATABASE_URL is available
require('dotenv').config();

const express    = require('express');
const swaggerUi  = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// ─── Repository (the ONLY place that talks to Postgres) ──────────────────────
const repo = require('./src/repository');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ─── Swagger Setup ──────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tasks / To-Do API',
      version: '3.0.0',
      description:
        'A CRUD API for managing tasks — backed by PostgreSQL in Docker. ' +
        'Data persists across restarts. Start the whole stack with: docker compose up',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

// ─── Stage 2: GET all tasks ─────────────────────────────────────────────────

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
 *         description: Filter tasks by title (case-insensitive ILIKE search)
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
async function getAllTasksHandler(req, res) {
  const { search, done } = req.query;
  const tasks = await repo.getAll(search, done);
  res.json(tasks);
}

app.get('/tasks', getAllTasksHandler);
app.get('/todos', getAllTasksHandler);

// ─── Stage 2: GET single task ────────────────────────────────────────────────

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
async function getOneTaskHandler(req, res) {
  const task = await repo.getById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
}

app.get('/tasks/:id', getOneTaskHandler);
app.get('/todos/:id', getOneTaskHandler);

// ─── Stage 3: POST — create a new task ──────────────────────────────────────

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
async function createTaskHandler(req, res) {
  const { title } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const newTask = await repo.create(title.trim());
  res.status(201).json(newTask);
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
async function updateTaskHandler(req, res) {
  const { title, done } = req.body;
  const updated = await repo.update(req.params.id, { title, done });
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
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
 *       204:
 *         description: Task deleted successfully (no body)
 *       404:
 *         description: Task not found
 */
async function deleteTaskHandler(req, res) {
  const deleted = await repo.remove(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
}

app.delete('/tasks/:id', deleteTaskHandler);
app.delete('/todos/:id', deleteTaskHandler);

// ─── GET /stats ──────────────────────────────────────────────────────────────

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
app.get('/stats', async (req, res) => {
  const stats = await repo.getStats();
  res.json(stats);
});

// ─── GET /health ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check — pings the database
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Service and database are healthy
 *       503:
 *         description: Database unreachable
 */
app.get('/health', async (req, res) => {
  try {
    const pool = require('./src/db');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err.message });
  }
});

// ─── Utility routes (backward compatibility) ─────────────────────────────────
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, world!', timestamp: new Date().toISOString() });
});

app.get('/api/time', (req, res) => {
  res.json({ utc: new Date().toUTCString(), unix: Date.now() });
});

// ─── Start server ────────────────────────────────────────────────────────────
async function start() {
  try {
    await repo.initDb();   // create table + seed on first run
    app.listen(PORT, () => {
      console.log(`Server running    → http://localhost:${PORT}`);
      console.log(`Swagger Docs      → http://localhost:${PORT}/api-docs`);
      console.log(`Health check      → http://localhost:${PORT}/health`);
      console.log(`Database          → ${process.env.DATABASE_URL}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }
}

start();
