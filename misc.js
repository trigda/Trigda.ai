const express = require('express');
const { ensureCsrfToken } = require('../middleware/csrf');

const router = express.Router();

router.get('/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

module.exports = router;
