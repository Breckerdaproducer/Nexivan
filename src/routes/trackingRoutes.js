const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');

// Public tracking lookup
router.get('/:trackingNumber', trackingController.trackShipment);
router.get('/', trackingController.trackShipment);

module.exports = router;
