# TRIGDA Website

Full-stack website for TRIGDA (Gujranwala, Pakistan): marketing pages, a mini AI
chatbot with a 10-message/24-hour limit, an appointment booking system with
Gmail owner notifications, and a secure admin panel — built from
`TRIGDA_Website_Requirements_and_Security_Specification.pdf`.

**Stack:** Node.js + Express + PostgreSQL + EJS (admin views) + vanilla HTML/CSS/JS (public site).

- Public pages: Home, Services, About, Contact, Booking, Privacy, Terms (`/public`)
- API: booking, chatbot, CSRF token (`/server/routes`)
- Admin panel: login, dashboard, booking status, CSV export, security logs (`/admin/*`)
- Database: `appointments`, `chatbot_sessions`, `chatbot_messages`, `admin_users`, `security_logs`

---

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in at least `DATABASE_URL` and `SESSION_SECRET`. Everything
each variable does is explained inline in `.env.example`.

**Get a free PostgreSQL database** (any of these work, and the app just needs a
`DATABASE_URL` connection string):
- [Neon](https://neon.tech) — free tier, easiest for local dev
- [Supabase](https://supabase.com) — free tier
- Render PostgreSQL — free tier (see deployment section below; you can reuse the same database for local dev too)

Then create the tables and your admin login:

```bash
npm run migrate
ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="Str0ng!Passw0rd1" npm run seed-admin
```

Run it:

```bash
npm run dev        # auto-restarts on file changes
# or
npm start
```

Visit `http://localhost:3000`. Admin panel: `http://localhost:3000/admin/login`.

### Gmail notifications (optional locally, required for live bookings)

1. Turn on 2-Step Verification on the Gmail account.
2. Google Account → Security → **App passwords** → create one for "Mail".
3. Put that 16-character password in `.env` as `GMAIL_APP_PASSWORD`, and the
   Gmail address as `GMAIL_USER`.

Without this, bookings still save correctly — the notification email is just
marked `failed` in the database so nothing is lost.

### Chatbot AI (optional)

The chatbot works with **zero cost and no signup** out of the box: it matches
visitor questions against the approved knowledge base in
`server/services/knowledgeBase.js`. Add a free key from
[console.groq.com](https://console.groq.com) as `GROQ_API_KEY` for more
natural phrasing — it's still restricted to the same approved facts and hands
off to a human contact for anything else.

---

## 2. Push the code to GitHub

```bash
cd trigda-website
git init
git add .
git commit -m "TRIGDA website: booking, chatbot, admin panel, security"
```

Create an empty repository on GitHub (github.com → New repository — don't add
a README/gitignore there, since this project already has them), then:

```bash
git remote add origin https://github.com/<your-username>/trigda-website.git
git branch -M main
git push -u origin main
```

`.env` is already excluded via `.gitignore`, so no secrets are pushed.

---

## 3. Deploy live on Render (connected to your GitHub repo)

GitHub Pages only serves static files — it cannot run this Node.js/PostgreSQL
backend (booking storage, Gmail sending, admin login all need a real server).
Render deploys directly from your GitHub repo instead, so "live on GitHub"
in practice means: **code lives on GitHub, Render builds and hosts it from
there, and every `git push` redeploys automatically.**

1. **Create the database first:** Render Dashboard → New → **PostgreSQL** →
   free plan → create. Copy the **Internal Database URL** once it's ready.
2. **Create the web service:** Render Dashboard → New → **Web Service** →
   connect your GitHub account → select the `trigda-website` repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: Free is fine to start
3. **Environment variables:** in the web service → Environment tab, add every
   variable from `.env.example`:
   - `DATABASE_URL` → the Internal Database URL from step 1
   - `SESSION_SECRET`, `IP_HASH_SALT` → generate with
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `NODE_ENV` → `production`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OWNER_NOTIFICATION_EMAIL`
   - `GROQ_API_KEY`, `GROQ_MODEL` (optional)
4. **Deploy.** Render builds and starts the service and gives you a
   `https://trigda-website.onrender.com`-style URL. HTTPS is automatic.
5. **Run the migration once, against production**, from your own machine:
   ```bash
   DATABASE_URL="<the External Database URL from Render>" npm run migrate
   DATABASE_URL="<same>" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="Str0ng!Passw0rd1" npm run seed-admin
   ```
   (Use the **External** URL for this one-off step, since your machine is
   outside Render's private network — the web service itself keeps using the
   Internal URL, which is faster and free.)
6. Visit your Render URL, then `/admin/login` to confirm the admin panel works.

From here on, every `git push` to `main` redeploys automatically.

### Before/after going live: update the domain

`public/sitemap.xml` and `public/robots.txt` use a placeholder domain
(`https://trigda.com`). Once you have your real Render URL or custom domain,
update both files to match — otherwise search engines will index the wrong URLs.

### Custom domain (optional)

Render → your web service → Settings → Custom Domains → add your domain and
follow the DNS instructions shown there.

---

## 4. Project structure

```
public/                  Static marketing site (served directly by Express)
  index.html, services.html, about.html, contact.html,
  booking.html, privacy.html, terms.html, 404.html
  css/styles.css         Public site design
  css/admin.css          Admin panel design
  js/main.js             Nav toggle, small UI behavior
  js/booking.js          Booking form: validation display, CSRF, submit
  js/chatbot.js          Chat widget: counter, limit handling, send/receive

server/
  index.js               App entry: security headers, routing, error handling
  config/db.js           PostgreSQL pool
  config/session.js      express-session + Postgres-backed session store
  middleware/auth.js     Admin auth guard, session destroy, lockout constants
  middleware/csrf.js     Session-bound CSRF token issue/verify
  middleware/rateLimit.js Rate limits for booking, chatbot, admin login
  routes/booking.js      POST /api/booking (validation, idempotency, email)
  routes/chatbot.js      GET/POST /api/chatbot/* (10-msg/24h server-side limit)
  routes/adminAuth.js    Admin login/logout (bcrypt, lockout, session rotation)
  routes/adminDashboard.js  Bookings list/filter/status, CSV export, logs view
  routes/misc.js         CSRF token endpoint
  services/email.js      Gmail notification via nodemailer
  services/aiClient.js   Optional Groq call, always falls back safely
  services/knowledgeBase.js  Approved facts the chatbot is restricted to
  utils/validators.js    express-validator rules (booking, admin login)
  utils/logger.js        Writes to security_logs (IP hashed, never raw)
  db/schema.sql           Full table definitions
  db/migrate.js           Applies schema.sql
  db/seedAdmin.js          Creates/updates the admin login from env vars
  views/admin/            EJS templates: login, dashboard, security logs
```

## 5. Security checklist (from the spec) — implemented

- [x] Passwords hashed with bcrypt, never stored or logged in plain text
- [x] Failed admin login lockout (5 attempts → 15-minute lock), generic error message
- [x] Session ID regenerated on login (session fixation protection); destroyed on logout
- [x] HttpOnly, SameSite cookies; `Secure` flag enforced when `NODE_ENV=production`
- [x] CSRF tokens required on every state-changing request
- [x] express-validator on every input field; parameterized SQL everywhere (no string-built queries)
- [x] Rate limiting on booking, chatbot, and admin login endpoints
- [x] Server-enforced 10-message/24-hour chatbot limit (independent of the browser)
- [x] Security headers via Helmet, including a Content-Security-Policy
- [x] `security_logs` table records login attempts, bookings, admin actions, unauthorized access — IPs are salted-hashed, never stored raw
- [x] Admin pages/APIs reject direct-URL access without a valid session
- [x] No prices published on the public site
- [x] Booking success never depends on the email provider being up (email failure is logged and retryable, booking is still saved)

## 6. Manual test checklist (from the spec, section 17)

Run through these once against your deployed URL before calling it done:
booking with a valid submission, an invalid email, a past date, a missing
field, and a rapid double-click; chatbot messages 1–10, message 11 (blocked),
and a manual DB edit of `window_started_at` to confirm the 24-hour reset;
a SQL-injection-style string and an XSS string in the issue field (both
should be stored/displayed safely, never executed); an unauthenticated
request to `/admin/dashboard`; five wrong admin passwords in a row; and
logging out then reloading `/admin/dashboard`.
