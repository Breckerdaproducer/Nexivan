const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Public route to fetch current company settings (email, phone, whatsapp, address)
router.get('/', settingsController.getPublicSettings);

module.exports = router;
