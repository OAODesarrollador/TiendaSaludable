const express = require('express');
const router = express.Router();
const { getCoefficients, upsertCoefficient, updatePricesByCoefficient } = require('../controllers/coeficiente.controller');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, getCoefficients);
router.post('/', verifyToken, isAdmin, upsertCoefficient);
router.post('/actualizar-precios', verifyToken, isAdmin, updatePricesByCoefficient);

module.exports = router;
