const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // ← AÑADIR ESTA LÍNEA
const importController = require('../controllers/import.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');

// Crear el directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/', verifyToken, isAdmin, upload.single('file'), importController.importCsv);
router.post(
  "/update-prices-matched",
  verifyToken,
  isAdmin,
  upload.single("file"),
  importController.updatePricesMatched
);
router.post("/preview", verifyToken, isAdmin, upload.single("file"), importController.previewCsv);


module.exports = router;
