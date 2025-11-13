// ============================================
// DASHBOARD ROUTES (dashboard.routes.js)
// ============================================
const express5 = require('express');
const router5 = express5.Router();
const { getDashboardStats, getSalesTimeline } = require('../controllers/dashboard.controller');
const { verifyToken: verifyToken5 } = require('../middleware/auth');

// 📊 Estadísticas generales del dashboard
router5.get('/stats', verifyToken5, getDashboardStats);

// 📈 Gráfico de ventas por período
router5.get('/timeline', verifyToken5, getSalesTimeline);

module.exports = router5;
