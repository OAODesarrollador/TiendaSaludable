// ============================================
// REPORT ROUTES (report.routes.js)
// ============================================
const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  exportToCSV,
  exportToPDF,
  getExpiringProductsReport,
  exportExpiringCSV,
  exportExpiringPDF
} = require('../controllers/report.controller');
const { verifyToken } = require('../middleware/auth');

// Ventas
router.get('/sales', verifyToken, getSalesReport);
router.get('/export/csv', verifyToken, exportToCSV);
router.get('/export/pdf', verifyToken, exportToPDF);

// Vencimientos
router.get('/expiring', verifyToken, getExpiringProductsReport);
router.get('/export/expiring-csv', verifyToken, exportExpiringCSV);
router.get('/export/expiring-pdf', verifyToken, exportExpiringPDF);

module.exports = router;
