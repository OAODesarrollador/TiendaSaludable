const { runAsync, getAsync, allAsync } = require('../config/database');
const { generateEAN13, validateEAN13, generateBarcodeImage, generateBarcodeSVG } = require('../utils/ean13');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ExcelJS = require('exceljs');
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
      sale_price, // se recalculará automáticamente
      stock,
      min_stock,
      expiration_date,
      supplier
    } = req.body;

    // Validación de campos obligatorios mínimos
    if (!sku || !name || !category || !purchase_price) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Verificar duplicado de SKU
    const existingSKU = await getAsync('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existingSKU) {
      return res.status(400).json({ error: 'El SKU ya existe' });
    }

    // Generar EAN13 único
    let ean13;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      ean13 = generateEAN13();
      const existingEAN = await getAsync('SELECT id FROM products WHERE ean13 = ?', [ean13]);
      if (!existingEAN) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'No se pudo generar un código EAN-13 único' });
    }

    // 🔹 Obtener coeficiente de la categoría
    const coefRow = await getAsync(
      'SELECT coefficient FROM category_coefficients WHERE category = ?',
      [category]
    );
    const coef = coefRow ? parseFloat(coefRow.coefficient) : 1.0;

    // 🔹 Calcular precio de venta automáticamente (redondeo a múltiplos de 50)
    const purchase = parseFloat(purchase_price || 0);
    const autoSalePrice = Math.ceil((purchase * coef) / 50) * 50;

    // 🔹 Insertar producto en base de datos
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
      purchase,
      autoSalePrice,
      stock || 0,
      min_stock || 10,
      expiration_date || null,
      supplier || null
    ]);

    // 🔹 Crear imagen de código de barras
    const barcodeDir = path.join(__dirname, '../../uploads/barcodes');
    const barcodePath = path.join(barcodeDir, `${ean13}.png`);
    generateBarcodeImage(ean13, barcodePath);

    // 🔹 Sincronizar categoría con tabla category_coefficients
    await runAsync(
      `INSERT OR IGNORE INTO category_coefficients (category, coefficient)
       VALUES (?, 1.0)`,
      [category]
    );

    const newProduct = await getAsync('SELECT * FROM products WHERE id = ?', [result.id]);

    res.status(201).json({
      message: 'Producto creado exitosamente',
      product: {
        ...newProduct,
        sale_price: autoSalePrice
      }
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

    // ✅ Obtener producto actual
    const product = await getAsync('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // ✅ Preparar campos dinámicos
    const allowedFields = [
      'sku', 'ean13', 'name', 'category', 'description',
      'purchase_price', 'sale_price', 'stock', 'min_stock',
      'expiration_date', 'supplier', 'active'
    ];
    const fields = [];
    const values = [];

    // ✅ Calcular coeficiente
    const category = updates.category || product.category;
    const purchase = parseFloat(updates.purchase_price ?? product.purchase_price ?? 0);
    const coefRow = await getAsync(
      'SELECT coefficient FROM category_coefficients WHERE category = ?',
      [category]
    );
    const coef = coefRow ? parseFloat(coefRow.coefficient) : 1.0;

    // ✅ Si el usuario mandó un precio manual, se respeta
    let sale_price = updates.sale_price ?? product.sale_price;

    // Si no se envió sale_price pero se cambió el precio de compra, recalcular
    if (!updates.sale_price && updates.purchase_price) {
      sale_price = Math.ceil((purchase * coef) / 50) * 50;
    }

    // ✅ Cargar los campos modificables
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        const value =
          updates[field] === '' || updates[field] === null
            ? null
            : updates[field];
        fields.push(`${field} = ?`);
        values.push(value);
      }
    }

    // ✅ Incluir el precio final
    fields.push(`sale_price = ?`);
    values.push(sale_price);

    // ✅ Marcar fecha de actualización
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
    await runAsync(sql, values);

    // ✅ Sincronizar categoría en coeficientes
    await runAsync(
      `INSERT OR IGNORE INTO category_coefficients (category, coefficient)
       VALUES (?, ?)`,
      [category, coef]
    );

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
// Requiere estas dependencias arriba del archivo:


// ============================================
// Exportar productos a Excel (versión robusta con archivo temporal)
// ============================================
const exportProductsToExcel = async (req, res) => {
  try {
    const products = await allAsync(`
      SELECT sku, ean13, name, purchase_price, sale_price 
      FROM products
      WHERE active = 1
      ORDER BY name ASC
    `);

    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'No hay productos para exportar' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Productos');

    worksheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'EAN-13', key: 'ean13', width: 20 },
      { header: 'Nombre', key: 'name', width: 40 },
      { header: 'Precio Compra', key: 'purchase_price', width: 15 },
      { header: 'Precio Venta', key: 'sale_price', width: 15 }
    ];

    products.forEach((p) => worksheet.addRow(p));

    // Estilos mínimos
    worksheet.getRow(1).font = { bold: true };
    worksheet.getColumn('purchase_price').numFmt = '"$"#,##0.00';
    worksheet.getColumn('sale_price').numFmt = '"$"#,##0.00';

    // 1) Crear ruta temporal
    const tmpDir = os.tmpdir();
    const fileName = `productos_${Date.now()}.xlsx`;
    const tempPath = path.join(tmpDir, fileName);

    // 2) Escribir el archivo en disco
    await workbook.xlsx.writeFile(tempPath);

    // 3) Descargar el archivo (Express maneja cabeceras y stream binario)
    res.download(tempPath, 'productos.xlsx', (err) => {
      // 4) Borrar el temporal pase lo que pase
      fs.unlink(tempPath, () => {});
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Error al descargar Excel' });
      }
    });
  } catch (error) {
    console.error('Error exportando productos:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al exportar productos' });
    }
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
  getLowStockProducts,
  exportProductsToExcel
};
