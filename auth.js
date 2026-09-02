const { logSecurityEvent } = require('../utils/logger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Blocks direct-URL access to admin pages/APIs when not authenticated.
// This is the server-side enforcement the spec requires - a visitor
// cannot reach admin data just by guessing a URL, regardless of what the
// front-end shows or hides.
function requireAdminAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }

  logSecurityEvent({
    eventType: 'admin_unauthorized_access',
    actorType: 'visitor',
    req,
    details: `Blocked attempt to reach ${req.originalUrl}`,
  });

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return res.redirect('/admin/login');
}

// Destroys the session server-side and clears the cookie so a logged-out
// browser cannot replay the old session to reach protected pages.
function destroySession(req, res, callback) {
  const sessionCookieName = 'trigda.sid';
  req.session.destroy((err) => {
    res.clearCookie(sessionCookieName);
    callback(err);
  });
}

module.exports = { requireAdminAuth, destroySession, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES };
