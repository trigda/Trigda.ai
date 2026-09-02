const { body, validationResult } = require('express-validator');

const ALLOWED_SERVICES = [
  'Website Development',
  'Lead Generation',
  'AI Chatbot & Automation',
  'Not sure yet',
];

const bookingValidationRules = [
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters.')
    .matches(/^[\p{L}\p{M}\s.'-]+$/u)
    .withMessage('Full name contains characters that are not allowed.'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail()
    .isLength({ max: 255 }),

  body('phone')
    .trim()
    .matches(/^[+0-9()\-\s]{7,30}$/)
    .withMessage('Please enter a valid phone number (digits, spaces, +, -, ( ) only).'),

  body('company_name')
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Company name must be between 2 and 150 characters (use "Individual / N/A" if none).'),

  body('service')
    .trim()
    .isIn(ALLOWED_SERVICES)
    .withMessage('Please select a valid service from the list.'),

  body('appointment_date')
    .isISO8601()
    .withMessage('Please select a valid date.')
    .custom((value) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const chosen = new Date(value);
      if (chosen < today) {
        throw new Error('Appointment date cannot be in the past.');
      }
      return true;
    }),

  body('appointment_time')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Please select a valid time.'),

  body('issue_details')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Please describe your project/issue in 10 to 2000 characters.'),

  body('budget_context')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('This field is too long.'),

  body('consent')
    .custom((value) => value === true || value === 'true' || value === 'on')
    .withMessage('You must agree to be contacted before booking.'),

  body('idempotency_key')
    .trim()
    .isLength({ min: 8, max: 100 })
    .withMessage('Missing submission token - please reload the page.'),
];

const adminLoginValidationRules = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 1 }).withMessage('Password is required.'),
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Please correct the highlighted fields.',
      fields: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = {
  ALLOWED_SERVICES,
  bookingValidationRules,
  adminLoginValidationRules,
  handleValidationErrors,
};
