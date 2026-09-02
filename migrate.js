require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  if (!pool) {
    console.error('DATABASE_URL is not set. Add it to your .env file first.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('Running migration against the configured database...');
  try {
    await pool.query(schema);
    console.log('Migration complete. Tables are ready:');
    console.log('  - appointments');
    console.log('  - chatbot_sessions');
    console.log('  - chatbot_messages');
    console.log('  - admin_users');
    console.log('  - security_logs');
    console.log('\nNext step: npm run seed-admin  (creates your first admin login)');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
