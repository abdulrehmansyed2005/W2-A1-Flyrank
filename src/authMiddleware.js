'use strict';

// ─── Auth Middleware ─────────────────────────────────────────────────────────
// Reusable Express middleware that:
//   1. Reads the Authorization: Bearer <token> header
//   2. Verifies the token with Supabase (a real network call — can't be faked)
//   3. Attaches the verified user to req.user and calls next()
//   4. Returns 401 for any missing, malformed, or invalid/expired token
//
// Usage: apply to any route you want protected, e.g.
//   app.get('/protected/profile', requireAuth, profileHandler);
// ────────────────────────────────────────────────────────────────────────────

const supabase = require('./supabaseClient');

async function requireAuth(req, res, next) {
  // ── 1. Extract token from header ──────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.slice(7).trim(); // strip "Bearer "

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // ── 2. Verify token with Supabase ─────────────────────────────────────────
  // getUser() makes a real network call to Supabase — a forged token cannot
  // pass this check. It also handles expiry automatically.
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── 3. Attach user and continue ───────────────────────────────────────────
  req.user = data.user;
  next();
}

module.exports = { requireAuth };
