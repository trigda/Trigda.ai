const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');

function buildSessionMiddleware() {
  if (!process.env.SESSION_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('[session] SESSION_SECRET is not set. Using an insecure default - set this in production.');
  }

  const store = pool
    ? new pgSession({
        pool,
        tableName: 'session', // auto-created on first run
        createTableIfMissing: true,
      })
    : undefined; // falls back to in-memory store if DB isn't configured (dev-only)

  return session({
    store,
    name: 'trigda.sid',
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true, // sliding inactivity timeout
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // requires HTTPS in production
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutes of inactivity logs an admin out
    },
  });
}

module.exports = buildSessionMiddleware;
