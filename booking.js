const express = require('express');
const { query } = require('../config/db');
const { bookingLimiter } = require('../middleware/rateLimit');
const { verifyCsrfToken } = require('../middleware/csrf');
const { bookingValidationRules, handleValidationErrors, ALLOWED_SERVICES } = require('../utils/validators');
const { sendBookingNotification } = require('../services/email');
const { logSecurityEvent } = require('../utils/logger');

const router = express.Router();

router.get('/services', (req, res) => {
  res.json({ services: ALLOWED_SERVICES.filter((s) => s !== 'Not sure yet').concat('Not sure yet') });
});

router.post(
  '/booking',
  bookingLimiter,
  verifyCsrfToken,
  bookingValidationRules,
  handleValidationErrors,
  async (req, res) => {
    const {
      full_name,
      email,
      phone,
      company_name,
      service,
      appointment_date,
      appointment_time,
      issue_details,
      budget_context,
      idempotency_key,
    } = req.body;

    try {
      // Idempotency guard: a duplicated double-click submits the same key,
      // which the unique index rejects instead of creating a second row.
      const existing = await query('SELECT id FROM appointments WHERE idempotency_key = $1', [idempotency_key]);
      if (existing.rows.length > 0) {
        return res.status(200).json({
          success: true,
          bookingId: existing.rows[0].id,
          message: 'Booking already received.',
        });
      }

      let insertResult;
      try {
        insertResult = await query(
          `INSERT INTO appointments
            (full_name, email, phone, company_name, service, appointment_date, appointment_time, issue_details, budget_context, idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, full_name, email, phone, company_name, service, appointment_date, appointment_time, issue_details, created_at`,
          [full_name, email, phone, company_name, service, appointment_date, appointment_time, issue_details, budget_context || null, idempotency_key]
        );
      } catch (err) {
        if (err.code === '23505' && err.constraint === 'uq_appointments_email_slot') {
          return res.status(409).json({
            error: 'That time slot is no longer available for this email. Please choose a different date or time.',
          });
        }
        throw err;
      }

      const booking = insertResult.rows[0];

      await logSecurityEvent({
        eventType: 'booking_created',
        actorType: 'visitor',
        req,
        details: `Booking ${booking.id} for ${booking.service} on ${booking.appointment_date}`,
      });

      // The success response to the visitor never depends on the email
      // provider - the booking is already safely stored above.
      const emailResult = await sendBookingNotification(booking);
      await query(
        `UPDATE appointments SET notification_status = $1, notification_sent_at = $2 WHERE id = $3`,
        [emailResult.sent ? 'sent' : 'failed', emailResult.sent ? new Date() : null, booking.id]
      );

      return res.status(201).json({
        success: true,
        bookingId: booking.id,
        message: 'Booking Confirmed! Your appointment request has been received. We will contact you using the details you provided.',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[booking] failed:', err.message);
      return res.status(500).json({ error: 'Something went wrong while saving your booking. Please try again.' });
    }
  }
);

module.exports = router;
