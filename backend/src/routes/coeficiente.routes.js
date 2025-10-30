const express = require('express');
const router = express.Router();
const { getCoefficients, upsertCoefficient, updatePricesByCoefficient } = require('../controllers/coeficiente.controller');

router.get('/', getCoefficients);
router.post('/', upsertCoefficient);
router.post('/actualizar-precios', updatePricesByCoefficient);

module.exports = router;
