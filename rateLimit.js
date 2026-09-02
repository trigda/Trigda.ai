const rateLimit = require('express-rate-limit');

// Booking form: generous enough for real visitors, tight enough to stop scripted spam.
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts from this network. Please try again shortly.' },
});

// Chatbot: this is a *secondary* guard. The real 10-message/24-hour rule is
// enforced in server/routes/chatbot.js against the database, which cannot be
// bypassed by clearing cookies or editing browser JavaScript. This limiter
// just stops rapid-fire scripted hammering of the endpoint itself.
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Admin login: strict, since this guards the whole admin surface.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait before trying again.' },
});

module.exports = { bookingLimiter, chatbotLimiter, adminLoginLimiter };
