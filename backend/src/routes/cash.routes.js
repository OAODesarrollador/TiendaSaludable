// ============================================
// CASH ROUTES (cash.routes.js)
// ============================================
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

const {
  openCashSession,
  addCashMovement,
  closeCashSession,
  getTodaySession,
  getPendingCloseWarning,
  getCashReport
} = require('../controllers/cash.controller');

// Abrir caja del día (si ya cerraste la anterior)
router.post('/register', verifyToken, openCashSession);

// Agregar movimiento manual (ingreso/egreso)
router.post('/movement', verifyToken, addCashMovement);

// Cerrar caja del día
router.post('/close', verifyToken, closeCashSession);

// Obtener sesión de hoy
router.get('/session', verifyToken, getTodaySession);

// Aviso de cierre pendiente del día anterior
router.get('/pending-close', verifyToken, getPendingCloseWarning);

// Reporte de caja (JSON por defecto, ?format=csv|pdf)
router.get('/report', verifyToken, getCashReport);

module.exports = router;