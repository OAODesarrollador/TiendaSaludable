// ============================================
// PRODUCT ROUTES (product.routes.js)
// ============================================
const express2 = require('express');
const router2 = express2.Router();
const {
  getAllProducts,
  getProductById,
  getProductByEAN,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getBarcodeImage,
  getLowStockProducts
} = require('../controllers/product.controller');
const { verifyToken: verifyToken2, isAdmin } = require('../middleware/auth');
const { exportProductsToExcel } = require('../controllers/product.controller');

router2.get('/export', verifyToken2, exportProductsToExcel);

router2.get('/', verifyToken2, getAllProducts);
router2.get('/categories', verifyToken2, getCategories);
router2.get('/low-stock', verifyToken2, getLowStockProducts);
router2.get('/ean/:ean13', verifyToken2, getProductByEAN);
router2.get('/barcode/:ean13', getBarcodeImage);
router2.get('/:id', verifyToken2, getProductById);
router2.post('/', verifyToken2, isAdmin, createProduct);
router2.put('/:id', verifyToken2, isAdmin, updateProduct);
router2.delete('/:id', verifyToken2, isAdmin, deleteProduct);

module.exports = router2;