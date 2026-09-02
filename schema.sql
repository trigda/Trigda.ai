-- TRIGDA Website Database Schema
-- PostgreSQL. Run via `npm run migrate`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 10.1 appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  service VARCHAR(80) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  issue_details TEXT NOT NULL,
  budget_context TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','confirmed','completed','cancelled')),
  idempotency_key VARCHAR(100) UNIQUE,
  notification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending','sent','failed')),
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments(email);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Duplicate-slot guard: same email + date + time should not be double booked
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_email_slot
  ON appointments(email, appointment_date, appointment_time)
  WHERE status != 'cancelled';

-- 10.2 chatbot_sessions
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(64) UNIQUE NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','limited','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_session_id ON chatbot_sessions(session_id);

-- 10.3 chatbot_messages
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(64) NOT NULL REFERENCES chatbot_sessions(session_id) ON DELETE CASCADE,
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('visitor','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON chatbot_messages(session_id);

-- 10.4 admin_users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10.5 security_logs
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(60) NOT NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('visitor','admin','system')),
  actor_id VARCHAR(100),
  ip_hash_or_mask VARCHAR(100),
  user_agent_summary VARCHAR(255),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);

-- express-session store (connect-pg-simple) creates its own "session" table
-- automatically on first run (see server/config/session.js), no manual step needed.
