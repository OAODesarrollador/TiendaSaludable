// ============================================
// DASHBOARD ROUTES (dashboard.routes.js)
// ============================================
const express5 = require('express');
const router5 = express5.Router();
const { getDashboardStats } = require('../controllers/dashboard.controller');
const { verifyToken: verifyToken5 } = require('../middleware/auth');

router5.get('/stats', verifyToken5, getDashboardStats);

module.exports = router5;