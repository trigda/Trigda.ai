const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[db] DATABASE_URL is not set. Set it in your .env file (see .env.example). ' +
    'The server will start, but any route that touches the database will fail until it is configured.'
  );
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Most free Postgres providers (Neon, Supabase, Render) require SSL.
      // Set DATABASE_SSL=false to disable for a local Postgres install.
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null;

async function query(text, params) {
  if (!pool) {
    throw new Error('Database is not configured. Set DATABASE_URL in your environment.');
  }
  return pool.query(text, params);
}

module.exports = { pool, query };
