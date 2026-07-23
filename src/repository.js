'use strict';

/**
 * src/repository.js
 * ─────────────────
 * Postgres repository — the ONLY module that talks to the database.
 * Routes and handlers never import pg directly; they call these functions.
 *
 * Swap storage? Replace this file. Routes stay identical. That's the point.
 *
 * Table shape (created in initDb below):
 *   id    SERIAL PRIMARY KEY
 *   title TEXT    NOT NULL
 *   done  BOOLEAN NOT NULL DEFAULT false
 */

const pool = require('./db');

// ─── Bootstrap ───────────────────────────────────────────────────────────────

/**
 * initDb()
 * Called once at startup:
 *   1. Creates the tasks table if it doesn't exist.
 *   2. Seeds three example rows — only when the table is empty (first run).
 */
async function initDb() {
  // 1. Create table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         SERIAL  PRIMARY KEY,
      title      TEXT    NOT NULL,
      done       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 2. Seed only on first run
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM tasks');
  if (parseInt(rows[0].count, 10) === 0) {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO tasks (title, done, created_at, updated_at) VALUES
         ($1, false, $2, $3),
         ($4, false, $5, $6),
         ($7, false, $8, $9)`,
      [
        'Buy groceries', now, now,
        'Walk the dog',  now, now,
        'Read a book',   now, now,
      ]
    );
    console.log('✅ Seeded 3 example tasks into Postgres.');
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * getAll(search, done) → Task[]
 * Supports optional ?search= and ?done= query filters.
 */
async function getAll(search, done) {
  const conditions = [];
  const params     = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`title ILIKE $${params.length}`);
  }

  if (done !== undefined) {
    params.push(done === 'true');
    conditions.push(`done = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM tasks ${where} ORDER BY title ASC`,
    params
  );
  return rows;
}

/**
 * getById(id) → Task | null
 */
async function getById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * create(title) → Task
 * RETURNING * gives us back the inserted row — id included — in one round-trip.
 */
async function create(title) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, done, created_at, updated_at)
     VALUES ($1, false, NOW(), NOW())
     RETURNING *`,
    [title]
  );
  return rows[0];
}

/**
 * update(id, { title, done }) → Task | null
 */
async function update(id, { title, done }) {
  // Fetch existing first so we can merge partial updates
  const existing = await getById(id);
  if (!existing) return null;

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDone  = done  !== undefined ? Boolean(done)  : existing.done;

  const { rows } = await pool.query(
    `UPDATE tasks
     SET title = $1, done = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [newTitle, newDone, id]
  );
  return rows[0] || null;
}

/**
 * remove(id) → boolean  (true = deleted, false = not found)
 */
async function remove(id) {
  const result = await pool.query(
    'DELETE FROM tasks WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

/**
 * getStats() → { total, completed, pending }
 */
async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)                        AS total,
      COUNT(*) FILTER (WHERE done)    AS completed,
      COUNT(*) FILTER (WHERE NOT done) AS pending
    FROM tasks
  `);
  const r = rows[0];
  return {
    total:     parseInt(r.total,     10),
    completed: parseInt(r.completed, 10),
    pending:   parseInt(r.pending,   10),
  };
}

module.exports = { initDb, getAll, getById, create, update, remove, getStats };
