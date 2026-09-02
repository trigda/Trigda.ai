const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const { chatbotLimiter } = require('../middleware/rateLimit');
const { verifyCsrfToken } = require('../middleware/csrf');
const { findAnswer, FALLBACK_ANSWER } = require('../services/knowledgeBase');
const { getAiAnswer } = require('../services/aiClient');
const { logSecurityEvent } = require('../utils/logger');

const router = express.Router();

const MESSAGE_LIMIT = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHAT_COOKIE = 'trigda_chat_sid';
const LIMIT_MESSAGE =
  'You have reached the 10-message limit for this chat window. Your chat access will reset automatically after 24 hours. For immediate help, please schedule a consultation or contact TRIGDA.';

function getOrCreateCookieSessionId(req, res) {
  let sessionId = req.cookies?.[CHAT_COOKIE];
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie(CHAT_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 35 * 24 * 60 * 60 * 1000, // cookie outlives the 24h counting window itself
    });
  }
  return sessionId;
}

async function loadOrResetSession(sessionId) {
  const existing = await query('SELECT * FROM chatbot_sessions WHERE session_id = $1', [sessionId]);

  if (existing.rows.length === 0) {
    const created = await query(
      `INSERT INTO chatbot_sessions (session_id, message_count, window_started_at, last_message_at, status)
       VALUES ($1, 0, now(), now(), 'active') RETURNING *`,
      [sessionId]
    );
    return created.rows[0];
  }

  const row = existing.rows[0];
  const windowAge = Date.now() - new Date(row.window_started_at).getTime();

  if (windowAge >= WINDOW_MS) {
    const reset = await query(
      `UPDATE chatbot_sessions
       SET message_count = 0, window_started_at = now(), last_message_at = now(), status = 'active', updated_at = now()
       WHERE session_id = $1 RETURNING *`,
      [sessionId]
    );
    return reset.rows[0];
  }

  return row;
}

// GET current usage - lets the widget show "N / 10 messages used" on load
// without spending a message.
router.get('/chatbot/status', async (req, res) => {
  try {
    const sessionId = getOrCreateCookieSessionId(req, res);
    const session = await loadOrResetSession(sessionId);
    res.json({
      messageCount: session.message_count,
      limit: MESSAGE_LIMIT,
      status: session.status,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chatbot/status] failed:', err.message);
    res.status(500).json({ error: 'Could not load chat status.' });
  }
});

router.post('/chatbot/message', chatbotLimiter, verifyCsrfToken, async (req, res) => {
  const userMessage = (req.body?.message || '').toString().trim();

  if (!userMessage) {
    return res.status(400).json({ error: 'Please type a question.' });
  }
  if (userMessage.length > 500) {
    return res.status(400).json({ error: 'Please keep questions under 500 characters.' });
  }

  try {
    const sessionId = getOrCreateCookieSessionId(req, res);
    const session = await loadOrResetSession(sessionId);

    // Server-side enforcement: this check cannot be bypassed by editing
    // the browser's displayed counter or calling the API directly.
    if (session.message_count >= MESSAGE_LIMIT) {
      if (session.status !== 'limited') {
        await query(`UPDATE chatbot_sessions SET status = 'limited', updated_at = now() WHERE session_id = $1`, [sessionId]);
      }
      return res.status(429).json({
        limited: true,
        message: LIMIT_MESSAGE,
        messageCount: session.message_count,
        limit: MESSAGE_LIMIT,
      });
    }

    await query(
      `INSERT INTO chatbot_messages (session_id, sender, content) VALUES ($1, 'visitor', $2)`,
      [sessionId, userMessage]
    );

    // Answer strictly from the approved knowledge base; the AI layer (if
    // configured) is instructed to stay within the same facts and to hand
    // off with FALLBACK_ANSWER when uncertain - never to invent details.
    let answer = await getAiAnswer(userMessage);
    if (!answer) {
      const kbEntry = findAnswer(userMessage);
      answer = kbEntry ? kbEntry.answer : FALLBACK_ANSWER;
    }

    await query(
      `INSERT INTO chatbot_messages (session_id, sender, content) VALUES ($1, 'assistant', $2)`,
      [sessionId, answer]
    );

    const newCount = session.message_count + 1;
    const newStatus = newCount >= MESSAGE_LIMIT ? 'limited' : 'active';
    await query(
      `UPDATE chatbot_sessions SET message_count = $1, last_message_at = now(), status = $2, updated_at = now() WHERE session_id = $3`,
      [newCount, newStatus, sessionId]
    );

    if (newStatus === 'limited') {
      await logSecurityEvent({ eventType: 'chatbot_limit_reached', actorType: 'visitor', req, details: `session ${sessionId}` });
    }

    return res.json({
      answer,
      messageCount: newCount,
      limit: MESSAGE_LIMIT,
      limited: newStatus === 'limited',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chatbot/message] failed:', err.message);
    return res.status(500).json({ error: 'The assistant is temporarily unavailable. Please try again in a moment.' });
  }
});

module.exports = router;
