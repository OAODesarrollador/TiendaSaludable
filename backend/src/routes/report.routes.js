// ==============================================
// RUTAS DE REPORTES - Tienda Natural
// ==============================================
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

const {
  // --- Reportes de Ventas ---
  getSalesReport,
  exportCSV,                 // 👈 usa los alias exportados por el controller
  exportPDF,                 // 👈 idem

  // --- Reportes de Vencimientos ---
  getExpiringProductsReport, // 👈 nombre real que exporta el controller
  exportExpiringCSV,
  exportExpiringPDF,

  // --- Reportes de Descuentos ---
  getDiscountSales,
  exportDiscountCSV,
  exportDiscountPDF
} = require("../controllers/report.controller");


// 📊 REPORTES DE VENTAS
router.get("/sales", verifyToken, getSalesReport);
router.get("/sales/export/csv", verifyToken, exportCSV);
router.get("/sales/export/pdf", verifyToken, exportPDF);

// 🕒 REPORTES DE VENCIMIENTOS
router.get("/expiring", verifyToken, getExpiringProductsReport);
router.get("/expiring/export/csv", verifyToken, exportExpiringCSV);
router.get("/expiring/export/pdf", verifyToken, exportExpiringPDF);

// 💸 REPORTES DE DESCUENTOS
router.get("/discounts", verifyToken, getDiscountSales);
router.get("/discounts/export/csv", verifyToken, exportDiscountCSV);
router.get("/discounts/export/pdf", verifyToken, exportDiscountPDF);


// ======================================================
module.exports = router;
