const { runAsync, getAsync, allAsync } = require('../config/database');
const { generateEAN13, validateEAN13, generateBarcodeImage, generateBarcodeSVG } = require('../utils/ean13');
const path = require('path');

// Obtener todos los productos
const getAllProducts = async (req, res) => {
  try {
    const { active, category, search } = req.query;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (active !== undefined) {
      sql += ' AND active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR ean13 LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ' ORDER BY name ASC';

    const products = await allAsync(sql, params);
    res.json(products);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// Obtener producto por ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getAsync('SELECT * FROM products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// Buscar producto por EAN-13
const getProductByEAN = async (req, res) => {
  try {
    const { ean13 } = req.params;

    if (!validateEAN13(ean13)) {
      return res.status(400).json({ error: 'Código EAN-13 inválido' });
    }

    const product = await getAsync('SELECT * FROM products WHERE ean13 = ? AND active = 1', [ean13]);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error buscando producto por EAN:', error);
    res.status(500).json({ error: 'Error al buscar producto' });
  }
};

// Crear nuevo producto
const createProduct = async (req, res) => {
  try {
    const {
      sku,
      name,
      category,
      description,
      purchase_price,
      sale_price,
      stock,
      min_stock,
      expiration_date,
      supplier
    } = req.body;

    if (!sku || !name || !category || !purchase_price || !sale_price) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const existingSKU = await getAsync('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existingSKU) {
      return res.status(400).json({ error: 'El SKU ya existe' });
    }

    let ean13;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      if (!ean13 || ean13 === '') {
        ean13 = generateEAN13();
      }

      const existingEAN = await getAsync('SELECT id FROM products WHERE ean13 = ?', [ean13]);
      if (!existingEAN) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'No se pudo generar un código EAN-13 único' });
    }

    const sql = `
      INSERT INTO products (
        sku, ean13, name, category, description, 
        purchase_price, sale_price, stock, min_stock, expiration_date, supplier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await runAsync(sql, [
      sku,
      ean13,
      name,
      category,
      description || null,
      purchase_price,
      sale_price,
      stock || 0,
      min_stock || 10,
      expiration_date || null,
      supplier || null
    ]);

    const barcodeDir = path.join(__dirname, '../../uploads/barcodes');
    const barcodePath = path.join(barcodeDir, `${ean13}.png`);
    generateBarcodeImage(ean13, barcodePath);

    const newProduct = await getAsync('SELECT * FROM products WHERE id = ?', [result.id]);

    res.status(201).json({
      message: 'Producto creado exitosamente',
      product: newProduct
    });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// Actualizar producto
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const product = await getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const allowedFields = [
      'name', 'ean13', 'category', 'description', 'purchase_price', 
      'sale_price', 'stock', 'min_stock', 'expiration_date', 'supplier', 'active'
    ];

    const fields = [];
    const values = [];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        // Si el campo viene vacío, lo guardamos como NULL (SQLite-friendly)
        const value =
          updates[field] === '' || updates[field] === null
            ? null
            : updates[field];
        fields.push(`${field} = ?`);
        values.push(value);
      }
    }


    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
    await runAsync(sql, values);

    const updatedProduct = await getAsync('SELECT * FROM products WHERE id = ?', [id]);

    res.json({
      message: 'Producto actualizado exitosamente',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// Eliminar producto (soft delete)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await runAsync('UPDATE products SET active = 0 WHERE id = ?', [id]);

    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

// Obtener categorías únicas
const getCategories = async (req, res) => {
  try {
    const categories = await allAsync('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category');
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

// Obtener SVG del código de barras
const getBarcodeImage = async (req, res) => {
  try {
    const { ean13 } = req.params;

    if (!validateEAN13(ean13)) {
      return res.status(400).json({ error: 'Código EAN-13 inválido' });
    }

    const svg = generateBarcodeSVG(ean13);

    if (!svg) {
      return res.status(500).json({ error: 'Error generando código de barras' });
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error('Error generando código de barras:', error);
    res.status(500).json({ error: 'Error al generar código de barras' });
  }
};

// Productos con stock bajo
const getLowStockProducts = async (req, res) => {
  try {
    const products = await allAsync(`
      SELECT * FROM products 
      WHERE active = 1 AND stock <= min_stock 
      ORDER BY stock ASC
    `);

    res.json(products);
  } catch (error) {
    console.error('Error obteniendo productos con stock bajo:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductByEAN,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getBarcodeImage,
  getLowStockProducts
};
