const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Public site-wide search
router.get('/', searchController.searchSite);

module.exports = router;
