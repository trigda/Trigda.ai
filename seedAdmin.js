require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Reads credentials from environment variables so nothing sensitive is
// ever typed into, or stored in, a source file.
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Str0ng!Pass' npm run seed-admin

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!pool) {
    console.error('DATABASE_URL is not set. Add it to your .env file first.');
    process.exit(1);
  }

  if (!email || !password) {
    console.error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables before running this script.\n' +
      'Example:\n  ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD=\'Str0ng!Pass1\' npm run seed-admin'
    );
    process.exit(1);
  }

  if (!PASSWORD_RULE.test(password)) {
    console.error(
      'Password is too weak. It needs 8+ characters with at least one uppercase letter, ' +
      'one lowercase letter, one number, and one special character.'
    );
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE admin_users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE email = $2',
        [passwordHash, email]
      );
      console.log(`Updated existing admin password for ${email}`);
    } else {
      await pool.query(
        'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3)',
        [email, passwordHash, 'admin']
      );
      console.log(`Created admin user ${email}`);
    }
    console.log('You can now log in at /admin/login');
  } catch (err) {
    console.error('Failed to seed admin user:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
