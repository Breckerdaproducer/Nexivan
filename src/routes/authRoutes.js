const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdminAuth } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAdminAuth, authController.getMe);
router.post('/password', requireAdminAuth, authController.updatePassword);

module.exports = router;
