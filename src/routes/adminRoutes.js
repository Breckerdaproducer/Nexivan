const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const statsController = require('../controllers/statsController');
const trackingController = require('../controllers/trackingController');
const contactController = require('../controllers/contactController');
const settingsController = require('../controllers/settingsController');

// All routes here require admin authorization
router.use(requireAdminAuth);

// 1. Dashboard Metrics
router.get('/stats', statsController.getDashboardStats);

// 2. Shipments CRUD
router.get('/shipments', trackingController.getAllShipments);
router.post('/shipments', trackingController.createShipment);
router.get('/shipments/:id', trackingController.getShipmentById);
router.put('/shipments/:id', trackingController.updateShipment);
router.delete('/shipments/:id', trackingController.deleteShipment);

// 3. Shipment Checkpoints
router.post('/shipments/:id/checkpoints', trackingController.addCheckpoint);
router.delete('/shipments/:id/checkpoints/:checkpointId', trackingController.deleteCheckpoint);

// 4. Contact Messages
router.get('/messages', contactController.getAllMessages);
router.put('/messages/:id/status', contactController.updateMessageStatus);
router.delete('/messages/:id', contactController.deleteMessage);

// 5. Company Settings (Dynamic Contact Info)
router.get('/settings', settingsController.getAdminSettings);
router.put('/settings', settingsController.updateSettings);
router.post('/settings', settingsController.updateSettings);

module.exports = router;
