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
  exportExcel,

  // --- Reportes de Vencimientos ---
  getExpiringProductsReport, // 👈 nombre real que exporta el controller
  exportExpiringCSV,
  exportExpiringPDF,
  exportExpiringExcel,

  // --- Reportes de Descuentos ---
  getDiscountSales,
  exportDiscountCSV,
  exportDiscountPDF,
  exportDiscountExcel,

  // --- Reportes de Productos ---
  getProductsListingReport,
  exportProductsListingCSV,
  exportProductsListingPDF,
  exportProductsListingExcel
} = require("../controllers/report.controller");


// 📊 REPORTES DE VENTAS
router.get("/sales", verifyToken, getSalesReport);
router.get("/sales/export/csv", verifyToken, exportCSV);
router.get("/sales/export/pdf", verifyToken, exportPDF);
router.get("/sales/export/excel", verifyToken, exportExcel);

// 🕒 REPORTES DE VENCIMIENTOS
router.get("/expiring", verifyToken, getExpiringProductsReport);
router.get("/expiring/export/csv", verifyToken, exportExpiringCSV);
router.get("/expiring/export/pdf", verifyToken, exportExpiringPDF);
router.get("/expiring/export/excel", verifyToken, exportExpiringExcel);

// 💸 REPORTES DE DESCUENTOS
router.get("/discounts", verifyToken, getDiscountSales);
router.get("/discounts/export/csv", verifyToken, exportDiscountCSV);
router.get("/discounts/export/pdf", verifyToken, exportDiscountPDF);
router.get("/discounts/export/excel", verifyToken, exportDiscountExcel);

// 📦 REPORTES DE PRODUCTOS
router.get("/products", verifyToken, getProductsListingReport);
router.get("/products/export/csv", verifyToken, exportProductsListingCSV);
router.get("/products/export/pdf", verifyToken, exportProductsListingPDF);
router.get("/products/export/excel", verifyToken, exportProductsListingExcel);


// ======================================================
module.exports = router;
