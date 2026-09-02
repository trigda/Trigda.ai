const express = require('express');
const { query } = require('../config/db');
const { requireAdminAuth } = require('../middleware/auth');
const { verifyCsrfToken, ensureCsrfToken } = require('../middleware/csrf');
const { logSecurityEvent } = require('../utils/logger');

const router = express.Router();

const STATUS_VALUES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];

router.get('/admin', requireAdminAuth, (req, res) => res.redirect('/admin/dashboard'));

router.get('/admin/dashboard', requireAdminAuth, ensureCsrfToken, async (req, res) => {
  const { status, service, from, to } = req.query;
  const conditions = [];
  const params = [];

  if (status && STATUS_VALUES.includes(status)) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (service) {
    params.push(service);
    conditions.push(`service = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`appointment_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`appointment_date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const bookings = await query(
      `SELECT * FROM appointments ${where} ORDER BY appointment_date DESC, appointment_time DESC LIMIT 200`,
      params
    );
    const stats = await query(`SELECT status, COUNT(*)::int AS count FROM appointments GROUP BY status`);
    const chatStats = await query(
      `SELECT COUNT(*)::int AS total_sessions, COALESCE(SUM(message_count),0)::int AS total_messages FROM chatbot_sessions`
    );

    res.render('admin/dashboard', {
      bookings: bookings.rows,
      stats: stats.rows,
      chatStats: chatStats.rows[0],
      filters: { status: status || '', service: service || '', from: from || '', to: to || '' },
      statusValues: STATUS_VALUES,
      csrfToken: res.locals.csrfToken,
      adminEmail: req.session.adminEmail,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[admin dashboard] failed:', err.message);
    res.status(500).send('Could not load dashboard.');
  }
});

router.post('/admin/bookings/:id/status', requireAdminAuth, verifyCsrfToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const result = await query(
      `UPDATE appointments SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });

    await logSecurityEvent({
      eventType: 'admin_action',
      actorType: 'admin',
      actorId: req.session.adminId,
      req,
      details: `Updated booking ${id} status to ${status}`,
    });

    res.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[admin status update] failed:', err.message);
    res.status(500).json({ error: 'Could not update status.' });
  }
});

router.get('/admin/bookings/export', requireAdminAuth, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM appointments ORDER BY created_at DESC`);
    const headers = [
      'id', 'full_name', 'email', 'phone', 'company_name', 'service',
      'appointment_date', 'appointment_time', 'issue_details', 'status',
      'notification_status', 'created_at',
    ];
    const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    for (const row of result.rows) {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    }

    await logSecurityEvent({ eventType: 'admin_action', actorType: 'admin', actorId: req.session.adminId, req, details: 'Exported bookings CSV' });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="trigda-bookings.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[admin export] failed:', err.message);
    res.status(500).send('Could not export bookings.');
  }
});

router.get('/admin/logs', requireAdminAuth, async (req, res) => {
  try {
    const logs = await query(`SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 300`);
    res.render('admin/logs', { logs: logs.rows, adminEmail: req.session.adminEmail });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[admin logs] failed:', err.message);
    res.status(500).send('Could not load security logs.');
  }
});

module.exports = router;
