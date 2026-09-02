const crypto = require('crypto');
const { query } = require('../config/db');

// Privacy-conscious IP handling: we never store a raw IP. We store a salted
// hash (for abuse-pattern correlation) plus a coarse masked form (for human
// review), matching the spec's "ip_hash_or_mask" field.
function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || 'trigda-default-salt-change-me';
  return crypto.createHash('sha256').update(salt + ip).digest('hex').slice(0, 32);
}

function maskIp(ip) {
  if (!ip) return null;
  if (ip.includes('.')) {
    // IPv4: zero out the last octet
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(':')) {
    // IPv6: keep first 3 groups only
    return ip.split(':').slice(0, 3).join(':') + '::';
  }
  return 'unknown';
}

function summarizeUserAgent(ua) {
  if (!ua) return null;
  return ua.slice(0, 255);
}

/**
 * Writes a row to security_logs. Never throws - a logging failure must
 * never break the visitor-facing request.
 */
async function logSecurityEvent({ eventType, actorType, actorId = null, req = null, details = null }) {
  try {
    const ip = req ? (req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress) : null;
    const ipMasked = maskIp(ip);
    const ipHash = hashIp(ip);
    const ua = req ? summarizeUserAgent(req.headers['user-agent']) : null;

    await query(
      `INSERT INTO security_logs (event_type, actor_type, actor_id, ip_hash_or_mask, user_agent_summary, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventType, actorType, actorId, ipHash ? `${ipHash} (${ipMasked})` : null, ua, details]
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[security_logs] failed to write log entry:', err.message);
  }
}

module.exports = { logSecurityEvent, hashIp, maskIp };
