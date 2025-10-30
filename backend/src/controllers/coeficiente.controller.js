const { runAsync, allAsync, getAsync } = require('../config/database');

// Obtener todos los coeficientes
const getCoefficients = async (req, res) => {
  try {
    const data = await allAsync('SELECT * FROM category_coefficients ORDER BY category ASC');
    res.json(data);
  } catch (err) {
    console.error('Error obteniendo coeficientes:', err);
    res.status(500).json({ error: 'Error al obtener coeficientes' });
  }
};

// Crear o actualizar coeficiente (solo guarda, no recalcula precios)
const upsertCoefficient = async (req, res) => {
  try {
    const { category, coefficient } = req.body;
    if (!category || isNaN(coefficient)) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    await runAsync(
      `INSERT INTO category_coefficients (category, coefficient)
       VALUES (?, ?)
       ON CONFLICT(category) DO UPDATE SET coefficient = excluded.coefficient`,
      [category, coefficient]
    );

    res.json({ message: `Coeficiente guardado para ${category}` });
  } catch (err) {
    console.error('Error guardando coeficiente:', err);
    res.status(500).json({ error: 'Error al guardar coeficiente' });
  }
};

// Actualizar precios según coeficiente de categoría
const updatePricesByCoefficient = async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'Categoría requerida' });
    }

    const coef = await getAsync(
      'SELECT coefficient FROM category_coefficients WHERE category = ?',
      [category]
    );

    if (!coef) {
      return res.status(404).json({ error: 'Coeficiente no encontrado' });
    }

    const coefficient = parseFloat(coef.coefficient);
    const productos = await allAsync(
      'SELECT id, purchase_price FROM products WHERE category = ?',
      [category]
    );

    let updatedCount = 0;
    for (const p of productos) {
      if (!p.purchase_price || isNaN(p.purchase_price)) continue;
      const rawPrice = p.purchase_price * coefficient;
      const nuevoPrecio = Math.ceil(rawPrice / 50) * 50;
      await runAsync('UPDATE products SET sale_price = ? WHERE id = ?', [nuevoPrecio, p.id]);
      updatedCount++;
    }

    res.json({
      message: `Precios actualizados para ${updatedCount} productos de la categoría ${category}.`
    });
  } catch (err) {
    console.error('Error actualizando precios:', err);
    res.status(500).json({ error: 'Error al actualizar precios' });
  }
};

module.exports = { getCoefficients, upsertCoefficient, updatePricesByCoefficient };
