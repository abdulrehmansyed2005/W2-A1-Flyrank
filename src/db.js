'use strict';

/**
 * src/db.js
 * ─────────
 * Creates a single pg Pool shared by the whole app.
 * Reads DATABASE_URL from the environment (set via .env / docker compose).
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
