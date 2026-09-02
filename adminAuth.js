const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { adminLoginLimiter } = require('../middleware/rateLimit');
const { verifyCsrfToken, ensureCsrfToken } = require('../middleware/csrf');
const { adminLoginValidationRules, handleValidationErrors } = require('../utils/validators');
const { destroySession, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } = require('../middleware/auth');
const { logSecurityEvent } = require('../utils/logger');

const router = express.Router();

router.get('/admin/login', ensureCsrfToken, (req, res) => {
  if (req.session?.adminId) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null, csrfToken: res.locals.csrfToken });
});

router.post(
  '/admin/login',
  adminLoginLimiter,
  verifyCsrfToken,
  adminLoginValidationRules,
  async (req, res) => {
    const errors = require('express-validator').validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/login', {
        error: 'Please enter a valid email and password.',
        csrfToken: res.locals.csrfToken,
      });
    }

    const { email, password } = req.body;

    try {
      const result = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
      const genericError = 'Invalid email or password.';

      if (result.rows.length === 0) {
        // Same generic message as a wrong password - we never reveal
        // whether an email exists in the system.
        await logSecurityEvent({ eventType: 'login_failed', actorType: 'admin', req, details: `email not found: ${email}` });
        return res.status(401).render('admin/login', { error: genericError, csrfToken: res.locals.csrfToken });
      }

      const admin = result.rows[0];

      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        await logSecurityEvent({ eventType: 'login_blocked_locked', actorType: 'admin', actorId: admin.id, req });
        return res.status(423).render('admin/login', {
          error: `Account temporarily locked due to repeated failed attempts. Try again after ${new Date(admin.locked_until).toLocaleTimeString()}.`,
          csrfToken: res.locals.csrfToken,
        });
      }

      const passwordMatches = await bcrypt.compare(password, admin.password_hash);

      if (!passwordMatches) {
        const failedAttempts = admin.failed_attempts + 1;
        const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
        await query(
          `UPDATE admin_users SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
          [failedAttempts, shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null, admin.id]
        );
        await logSecurityEvent({ eventType: 'login_failed', actorType: 'admin', actorId: admin.id, req });
        return res.status(401).render('admin/login', { error: genericError, csrfToken: res.locals.csrfToken });
      }

      // Reset failure counters and rotate the session ID on every successful
      // login - this prevents session fixation attacks.
      await query(
        `UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
        [admin.id]
      );

      req.session.regenerate((err) => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error('[admin login] session regenerate failed:', err.message);
          return res.status(500).render('admin/login', { error: 'Login failed. Please try again.', csrfToken: res.locals.csrfToken });
        }
        req.session.adminId = admin.id;
        req.session.adminEmail = admin.email;
        logSecurityEvent({ eventType: 'login_success', actorType: 'admin', actorId: admin.id, req });
        res.redirect('/admin/dashboard');
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[admin login] failed:', err.message);
      res.status(500).render('admin/login', { error: 'Something went wrong. Please try again.', csrfToken: res.locals.csrfToken });
    }
  }
);

router.post('/admin/logout', (req, res) => {
  const adminId = req.session?.adminId;
  destroySession(req, res, () => {
    if (adminId) logSecurityEvent({ eventType: 'logout', actorType: 'admin', actorId: adminId, req });
    res.redirect('/admin/login');
  });
});

module.exports = router;
