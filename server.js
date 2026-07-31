'use strict';

// Load .env before anything else so all env vars are available
require('dotenv').config();

const express      = require('express');
const swaggerUi    = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const rateLimit    = require('express-rate-limit');

// ─── Repository (the ONLY place that talks to Postgres) ──────────────────────
const repo = require('./src/repository');

// ─── Supabase client & auth middleware ───────────────────────────────────────
const supabase            = require('./src/supabaseClient');
const { requireAuth }     = require('./src/authMiddleware');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ─── Rate limiter for login (stretch goal) ────────────────────────────────────
// Limits POST /auth/login to 5 attempts per 15 minutes per IP.
// Returns 429 on excessive requests — brute-force protection lives at the gate.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// ─── Swagger Setup ───────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlyRank Tasks & Auth API',
      version: '4.0.0',
      description:
        'A secure CRUD + Auth API — backed by PostgreSQL and Supabase Auth. ' +
        'Sign up, log in, and use the 🔒 Authorize button to test protected endpoints. ' +
        'Start with: npm run dev',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Paste the access_token from POST /auth/login here. ' +
            'Format: Bearer <your_jwt>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Something went wrong' },
          },
        },
      },
    },
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true },
}));

// ─────────────────────────────────────────────────────────────────────────────
//  SWAGGER SCHEMA DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

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
 *         updated_at:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 1
 *         title: Buy groceries
 *         done: false
 *         created_at: "2025-01-01T00:00:00.000Z"
 *         updated_at: "2025-01-01T00:00:00.000Z"
 *
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "550e8400-e29b-41d4-a716-446655440000"
 *         email: "user@example.com"
 *         created_at: "2025-01-01T00:00:00.000Z"
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         access_token:
 *           type: string
 *           description: JWT to use as Bearer token in protected routes
 *         refresh_token:
 *           type: string
 *           description: Long-lived token to get a fresh access_token without re-login
 *         token_type:
 *           type: string
 *           example: bearer
 *         expires_in:
 *           type: integer
 *           description: Seconds until access_token expires (default 3600 = 1 hour)
 */

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Sign up, log in, log out, and token refresh
 *   - name: Public
 *     description: Open endpoints — no token required
 *   - name: Protected
 *     description: Private endpoints — requires Authorization Bearer token
 *   - name: Tasks
 *     description: Task management (CRUD)
 *   - name: Stats
 *     description: Database statistics
 */

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 1 — AUTH ROUTES: Sign Up & Log In
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Create a new user account
 *     tags: [Auth]
 *     description: |
 *       Registers a new user with Supabase Auth. Supabase hashes the password —
 *       your server never sees or stores credentials directly.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Missing email or password, or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  // Validate inputs — never trust the client
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Supabase gives us descriptive errors (e.g. "Password should be at least 6 characters")
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({
    message: 'User created successfully',
    user: {
      id:         data.user.id,
      email:      data.user.email,
      created_at: data.user.created_at,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate and receive a JWT
 *     tags: [Auth]
 *     description: |
 *       Validates credentials against Supabase and returns an access_token (JWT).
 *       Copy the access_token and click the **Authorize** 🔒 button above to unlock
 *       protected routes. Rate-limited to 5 attempts per 15 minutes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful — use access_token as Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts — try again in 15 minutes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  const { session } = data;
  return res.status(200).json({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    token_type:    session.token_type,
    expires_in:    session.expires_in,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 4 — LOGOUT (protected: uses requireAuth middleware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: End the user's session
 *     tags: [Auth]
 *     description: |
 *       Signs the user out from Supabase. Requires a valid Bearer token.
 *       **Note on stateless JWTs**: the token technically remains valid for its
 *       remaining lifespan — this is a known trade-off with stateless JWT auth.
 *       Refresh tokens are invalidated server-side.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out successfully (no body)
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/auth/logout', requireAuth, async (req, res) => {
  await supabase.auth.signOut();
  return res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
//  STRETCH — REFRESH TOKEN ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Exchange a refresh token for a new access token
 *     tags: [Auth]
 *     description: |
 *       Access tokens are short-lived (1 hour by default) to limit the damage
 *       if they are stolen — an attacker's stolen token self-destructs quickly.
 *       The refresh token lets the client stay logged in without re-entering credentials.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: The refresh_token received from POST /auth/login
 *     responses:
 *       200:
 *         description: New access_token issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing or invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });

  if (error || !data?.session) {
    return res.status(400).json({ error: 'Invalid or expired refresh token' });
  }

  const { session } = data;
  return res.status(200).json({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    token_type:    session.token_type,
    expires_in:    session.expires_in,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 2 — PUBLIC ROUTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /public/info:
 *   get:
 *     summary: Public information — no auth required
 *     tags: [Public]
 *     description: An open endpoint anyone can reach. No token needed.
 *     responses:
 *       200:
 *         description: Public welcome message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Welcome stranger! This info is public."
 */
app.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 3 + 4 — PROTECTED PROFILE ROUTE (uses requireAuth middleware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /protected/profile:
 *   get:
 *     summary: Read private profile data
 *     tags: [Protected]
 *     description: |
 *       Returns the authenticated user's profile. Token is verified with Supabase
 *       via the `requireAuth` middleware — forged or expired tokens get 401.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user's profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Missing, malformed, or invalid/expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/protected/profile', requireAuth, (req, res) => {
  const { id, email, created_at } = req.user;
  res.status(200).json({
    message: 'Welcome to your profile!',
    user: { id, email, created_at },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 4 — SECOND PROTECTED ROUTE (same middleware, zero new auth code)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /protected/dashboard:
 *   get:
 *     summary: User dashboard — private data
 *     tags: [Protected]
 *     description: |
 *       Another protected route using the exact same `requireAuth` middleware.
 *       Adding protection to a new route = one word: `requireAuth`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data for authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user_id:
 *                   type: string
 *                 stats:
 *                   type: object
 *       401:
 *         description: Missing, malformed, or invalid/expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.status(200).json({
    message:  'Welcome to your dashboard!',
    user_id:  req.user.id,
    stats: {
      last_sign_in: req.user.last_sign_in_at,
      provider:     req.user.app_metadata?.provider ?? 'email',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  STRETCH — 403 ADMIN ROUTE
//  401 = "I don't know who you are" (no/bad token)
//  403 = "I know exactly who you are — and no."
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /protected/admin:
 *   get:
 *     summary: Admin-only route (demonstrates 401 vs 403)
 *     tags: [Protected]
 *     description: |
 *       **Demonstrates the 401 vs 403 distinction:**
 *       - `401 Unauthorized` — no token or bad token (the guard doesn't know you)
 *       - `403 Forbidden` — valid token, but you are not an admin (the guard knows you, and says no)
 *
 *       In this demo all users get 403 — to become an admin, set
 *       `app_metadata.role = "admin"` via the Supabase service role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin access granted
 *       401:
 *         description: No or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Authenticated but not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/protected/admin', requireAuth, (req, res) => {
  const role = req.user.app_metadata?.role;

  if (role !== 'admin') {
    // 401 = "who are you?" — 403 = "I know you, and no."
    return res.status(403).json({
      error: 'Forbidden — admin access only. You are authenticated, but not authorised.',
    });
  }

  res.status(200).json({ message: 'Welcome, admin!', user_id: req.user.id });
});

// ─────────────────────────────────────────────────────────────────────────────
//  EXISTING TASK ROUTES (A1–A3, unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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
 *         description: Filter tasks by title (case-insensitive)
 *       - in: query
 *         name: done
 *         schema:
 *           type: boolean
 *         description: Filter by completion status
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
 *             required: [title]
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
 *         description: Task updated
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
 *     responses:
 *       204:
 *         description: Task deleted (no body)
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

// ─── GET /stats ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Return task statistics from the database
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Task counts
 */
app.get('/stats', async (req, res) => {
  const stats = await repo.getStats();
  res.json(stats);
});

// ─── GET /health ──────────────────────────────────────────────────────────────

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

// ─── Utility routes (backward compatibility) ──────────────────────────────────
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, world!', timestamp: new Date().toISOString() });
});

app.get('/api/time', (req, res) => {
  res.json({ utc: new Date().toUTCString(), unix: Date.now() });
});

// ─── Start server ─────────────────────────────────────────────────────────────
async function start() {
  // Try to connect to PostgreSQL — non-fatal if Docker isn't running.
  // Auth routes (Supabase) always work; task routes need Docker/Postgres.
  try {
    await repo.initDb();
    console.log('  🐘 PostgreSQL        → connected (task routes active)');
  } catch (err) {
    console.warn('  ⚠️  PostgreSQL not available — task routes disabled. Start Docker to enable them.');
    console.warn('     (' + err.message + ')');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('  ✅ Server running    → http://localhost:' + PORT);
    console.log('  📚 Swagger Docs      → http://localhost:' + PORT + '/docs');
    console.log('  🔒 Auth endpoints    → /auth/signup  /auth/login  /auth/logout');
    console.log('  🏠 Public            → /public/info');
    console.log('  🔐 Protected         → /protected/profile  /protected/dashboard  /protected/admin');
    console.log('  🩺 Health check      → http://localhost:' + PORT + '/health');
    console.log('');
    console.log('  Connected to Supabase → ' + process.env.SUPABASE_URL);
    console.log('');
  });
}

start();
