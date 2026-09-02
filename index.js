require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const buildSessionMiddleware = require('./config/session');

const bookingRoutes = require('./routes/booking');
const chatbotRoutes = require('./routes/chatbot');
const adminAuthRoutes = require('./routes/adminAuth');
const adminDashboardRoutes = require('./routes/adminDashboard');
const miscRoutes = require('./routes/misc');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind Render's proxy, so req.ip / secure cookies resolve correctly.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Security headers -------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// --- Core middleware ----------------------------------------------------
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());
app.use(buildSessionMiddleware());

// Reject unexpected HTTP methods on the API surface.
app.use('/api', (req, res, next) => {
  const allowed = ['GET', 'POST'];
  if (!allowed.includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  next();
});

// --- Static public site --------------------------------------------------
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// --- Routes ---------------------------------------------------------------
app.use('/api', miscRoutes);
app.use('/api', bookingRoutes);
app.use('/api', chatbotRoutes);
app.use('/', adminAuthRoutes);
app.use('/', adminDashboardRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- 404 -------------------------------------------------------------------
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'), (err) => {
    if (err) res.status(404).send('Page not found.');
  });
});

// --- Error handler -----------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);
  if (req.originalUrl.startsWith('/api')) {
    return res.status(500).json({ error: 'Something went wrong.' });
  }
  res.status(500).send('Something went wrong.');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TRIGDA website running on http://localhost:${PORT}`);
});

module.exports = app;
