// ==============================================
// RUTAS DE REPORTES - Tienda Natural
// ==============================================
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

const {
  // --- Reportes de Ventas ---
  getSalesReport,
  getMonthlySalesReport,
  getSalesAnalysisReport,
  exportSalesAnalysisExcel,
  exportCSV,                 // 👈 usa los alias exportados por el controller
  exportPDF,                 // 👈 idem
  exportExcel,
  exportMonthlySalesPDF,
  exportMonthlySalesExcel,

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
  exportProductsListingExcel,

  // --- Reportes de Gastos ---
  getRestockExpensesReport,
  getRestockExpenseConcepts,
  exportRestockExpensesExcel
} = require("../controllers/report.controller");


// 📊 REPORTES DE VENTAS
router.get("/sales", verifyToken, getSalesReport);
router.get("/sales/monthly", verifyToken, getMonthlySalesReport);
router.get("/sales/analysis", verifyToken, getSalesAnalysisReport);
router.get("/sales/analysis/export/excel", verifyToken, exportSalesAnalysisExcel);
router.get("/sales/export/csv", verifyToken, exportCSV);
router.get("/sales/export/pdf", verifyToken, exportPDF);
router.get("/sales/export/excel", verifyToken, exportExcel);
router.get("/sales/monthly/export/pdf", verifyToken, exportMonthlySalesPDF);
router.get("/sales/monthly/export/excel", verifyToken, exportMonthlySalesExcel);

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

// 💸 REPORTES DE GASTOS
router.get("/expenses/restock/concepts", verifyToken, getRestockExpenseConcepts);
router.get("/expenses/restock", verifyToken, getRestockExpensesReport);
router.get("/expenses/restock/export/excel", verifyToken, exportRestockExpensesExcel);


// ======================================================
module.exports = router;
