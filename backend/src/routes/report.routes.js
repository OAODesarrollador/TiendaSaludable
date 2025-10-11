// ============================================
// REPORT ROUTES (report.routes.js)
// ============================================
const express4 = require('express');
const router4 = express4.Router();
const {
  getSalesReport,
  exportToCSV,
  exportToPDF
} = require('../controllers/report.controller');
const { verifyToken: verifyToken4 } = require('../middleware/auth');

router4.get('/sales', verifyToken4, getSalesReport);
router4.get('/export/csv', verifyToken4, exportToCSV);
router4.get('/export/pdf', verifyToken4, exportToPDF);

module.exports = router4;