// ============================================
// SALE ROUTES (sale.routes.js)
// ============================================
const express3 = require('express');
const router3 = express3.Router();
const {
  createSale,
  getAllSales,
  getSaleById,
  generateTicketPDF
} = require('../controllers/sale.controller');
const { verifyToken: verifyToken3 } = require('../middleware/auth');

router3.post('/', verifyToken3, createSale);
router3.get('/', verifyToken3, getAllSales);
router3.get('/:id', verifyToken3, getSaleById);
router3.get('/:id/ticket', verifyToken3, generateTicketPDF);

module.exports = router3;