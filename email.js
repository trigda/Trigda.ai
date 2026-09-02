const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    // eslint-disable-next-line no-console
    console.warn(
      '[email] GMAIL_USER / GMAIL_APP_PASSWORD not set. Booking notifications will be marked failed until configured.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password, never the real account password
    },
  });
  return transporter;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sends the owner notification for a new booking.
 * Never throws - caller decides how to record success/failure so that a
 * booking is always saved even if the email provider is down.
 */
async function sendBookingNotification(booking) {
  const t = getTransporter();
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL || 'talhabinsaeed36@gmail.com';

  if (!t) {
    return { sent: false, reason: 'Email transport not configured' };
  }

  const subject = `New TRIGDA Appointment Booking - ${booking.full_name} - ${booking.appointment_date} ${booking.appointment_time}`;

  const rows = [
    ['Name', booking.full_name],
    ['Email', booking.email],
    ['Phone', booking.phone],
    ['Company', booking.company_name],
    ['Service', booking.service],
    ['Date', booking.appointment_date],
    ['Time', booking.appointment_time],
    ['Issue / Details', booking.issue_details],
    ['Submitted At', booking.created_at],
    ['Booking ID', booking.id],
  ];

  const htmlRows = rows
    .map(([label, value]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#0F1B33;">${escapeHtml(label)}</td><td style="padding:6px 12px;color:#333;">${escapeHtml(String(value ?? ''))}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#234E9C;">New Appointment Booking</h2>
      <table style="border-collapse:collapse;width:100%;">${htmlRows}</table>
      <p style="margin-top:16px;color:#666;font-size:13px;">Sent automatically by the TRIGDA website booking system.</p>
    </div>`;

  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n');

  try {
    await t.sendMail({
      from: `"TRIGDA Website" <${process.env.GMAIL_USER}>`,
      to: ownerEmail,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendBookingNotification };
