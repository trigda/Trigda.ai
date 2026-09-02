const crypto = require('crypto');

// Lightweight session-bound CSRF protection. A token is generated per
// session and must be echoed back (header or body) on any state-changing
// request. This avoids the deprecated `csurf` package while giving the
// same guarantee: a third-party site cannot forge a POST on a visitor's
// behalf because it cannot read the token out of our session.

function ensureCsrfToken(req, res, next) {
  if (!req.session) return next(new Error('Session must be initialized before CSRF middleware'));
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrfToken(req, res, next) {
  const tokenFromClient = req.headers['x-csrf-token'] || req.body?._csrf;
  const tokenFromSession = req.session?.csrfToken;

  if (
    !tokenFromClient ||
    !tokenFromSession ||
    tokenFromClient.length !== tokenFromSession.length ||
    !crypto.timingSafeEqual(Buffer.from(tokenFromClient), Buffer.from(tokenFromSession))
  ) {
    return res.status(403).json({ error: 'Invalid or missing security token. Please refresh the page and try again.' });
  }
  next();
}

module.exports = { ensureCsrfToken, verifyCsrfToken };
