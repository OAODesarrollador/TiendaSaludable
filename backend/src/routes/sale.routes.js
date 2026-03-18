// ============================================
// SALE ROUTES (sale.routes.js)
// ============================================
const express = require('express');
const router = express.Router();
const {
  createSale,
  getAllSales,
  getSaleById,
  generateTicketPDF,
  generateRefundPDF, // 🆕 importar nueva función
  createRefund,        // ✅ Nuevo controlador: crear nota de crédito
  getRefundsBySale,    // ✅ Obtener todas las devoluciones de una venta
  getRefundById        // ✅ Obtener una nota de crédito por ID
} = require('../controllers/sale.controller');

const { verifyToken } = require('../middleware/auth');
const { checkRefundExists } = require('../controllers/sale.controller');



// ============================================
// Rutas de Ventas
// ============================================
router.post('/', verifyToken, createSale);
router.get('/', verifyToken, getAllSales);
router.get('/:id', verifyToken, getSaleById);
router.get('/:id/ticket', verifyToken, generateTicketPDF);

// ============================================
// Rutas de Notas de Crédito (Devoluciones)
// ============================================

// Crear nueva nota de crédito
router.post('/:id/refunds', verifyToken, createRefund);

// Obtener todas las devoluciones de una venta
router.get('/:id/refunds', verifyToken, getRefundsBySale);

// Obtener detalle de una nota de crédito específica
router.get('/refund/:refundId', verifyToken, getRefundById);

router.get('/:id/check-refund', verifyToken, checkRefundExists);

router.get('/refund/:id/pdf', verifyToken, generateRefundPDF);


module.exports = router;
