require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');
const { generateEAN13, generateBarcodeImage } = require('./ean13');

// Helper para ejecutar consultas con promesas
const runAsync = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID });
    });
  });
};

// =========================
// 1️⃣ Inicializar Base de Datos
// =========================
const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');

      // Tabla de usuarios
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT DEFAULT 'vendedor',
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabla de productos
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          ean13 TEXT UNIQUE,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          purchase_price REAL NOT NULL,
          sale_price REAL NOT NULL,
          stock REAL DEFAULT 0,
          min_stock REAL DEFAULT 10,
          supplier TEXT,
          expiration_date DATE,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabla de ventas
      db.run(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          subtotal REAL NOT NULL,
          tax REAL NOT NULL,
          total REAL NOT NULL,
          payment_method TEXT DEFAULT 'efectivo',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Tabla de ítems de venta
      db.run(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL,
          discount REAL DEFAULT 0,
          discount_type TEXT DEFAULT 'percentage',
          subtotal REAL NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // Tabla de devoluciones
      db.run(`
        CREATE TABLE IF NOT EXISTS refunds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          reason TEXT,
          subtotal REAL,
          tax REAL,
          total REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(sale_id) REFERENCES sales(id)
        )
      `);

      // Ítems de devolución
      db.run(`
        CREATE TABLE IF NOT EXISTS refund_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          refund_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY(refund_id) REFERENCES refunds(id),
          FOREIGN KEY(product_id) REFERENCES products(id)
        )
      `);

      // Tabla de coeficientes por categoría (NUEVA)
      db.run(`
        CREATE TABLE IF NOT EXISTS category_coefficients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT UNIQUE NOT NULL,
          coefficient REAL DEFAULT 1.0,
          FOREIGN KEY (category) REFERENCES products(category)
        )
      `);

      // Índices para mejorar rendimiento de consultas
      db.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_products_ean13 ON products(ean13)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);

      resolve();
    });
  });
};

// =========================
// 2️⃣ Generar fecha de vencimiento aleatoria
// =========================
const generateExpirationDate = (minMonths = 3, maxMonths = 24) => {
  const today = new Date();
  const months = Math.floor(Math.random() * (maxMonths - minMonths + 1)) + minMonths;
  const expirationDate = new Date(today);
  expirationDate.setMonth(expirationDate.getMonth() + months);
  return expirationDate.toISOString().split('T')[0];
};

// =========================
// 3️⃣ Seed principal
// =========================
const seedDatabase = async () => {
  try {
    console.log('🌱 Inicializando base de datos...');
    await initializeDatabase();
    console.log('✅ Tablas listas\n');

    // Usuarios
    console.log('👤 Creando usuarios...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const vendedorPassword = await bcrypt.hash('vendedor123', 10);
    await runAsync(`
      INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES
      ('admin', ?, 'Administrador', 'admin'),
      ('vendedor', ?, 'Juan Pérez', 'vendedor')
    `, [adminPassword, vendedorPassword]);
    console.log('✅ Usuarios creados\n');

    // Productos
    console.log('📦 Creando productos...');
    const products = [
      { name: 'Harina Integral', category: 'Alimentos', purchase: 850, sale: 0, stock: 120 },
      { name: 'Aceite de Coco', category: 'Aceites', purchase: 2300, sale: 0, stock: 60 },
      { name: 'Yerba Orgánica', category: 'Infusiones', purchase: 1900, sale: 0, stock: 80 },
      { name: 'Miel Pura', category: 'Dulces', purchase: 2100, sale: 0, stock: 40 },
      { name: 'Granola Natural', category: 'Cereales', purchase: 1200, sale: 0, stock: 50 },
    ];

    const barcodeDir = path.join(__dirname, '../../uploads/barcodes');
    if (!fs.existsSync(barcodeDir)) fs.mkdirSync(barcodeDir, { recursive: true });

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const sku = `PROD-${String(i + 1).padStart(4, '0')}`;
      const ean13 = generateEAN13();
      const expirationDate = generateExpirationDate(6, 18);

      // Cálculo de precio de venta redondeado (coeficiente base 1.0)
      const salePrice = Math.ceil(product.purchase * 1.0 / 50) * 50;

      await runAsync(`
        INSERT INTO products (
          sku, ean13, name, category, description,
          purchase_price, sale_price, stock, min_stock, supplier, expiration_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sku, ean13, product.name, product.category,
        `${product.name} de excelente calidad.`,
        product.purchase, salePrice, product.stock, 10,
        'Proveedor Natural SA', expirationDate
      ]);

      const barcodePath = path.join(barcodeDir, `${ean13}.png`);
      generateBarcodeImage(ean13, barcodePath);
      console.log(`   ✓ ${product.name} (${product.category}) — $${salePrice}`);
    }

    console.log('\n✅ Productos creados con EAN-13\n');

    // Coeficientes por categoría
    console.log('⚙️ Inicializando coeficientes por categoría...');
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT category FROM products', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.category));
      });
    });

    for (const category of categories) {
      await runAsync(
        `INSERT OR IGNORE INTO category_coefficients (category, coefficient) VALUES (?, ?)`,
        [category, 1.0]
      );
    }

    console.log(`✅ ${categories.length} categorías inicializadas con coeficiente 1.0\n`);

    // Venta de ejemplo
    console.log('💰 Creando ventas de ejemplo...');
    const sale = await runAsync(`
      INSERT INTO sales (user_id, subtotal, tax, total, payment_method)
      VALUES (?, ?, ?, ?, ?)`,
      [1, 1000, 210, 1210, 'efectivo']
    );

    await runAsync(`
      INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, discount_type, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [sale.id, 1, 'Harina Integral', 2, 500, 0, 'percentage', 1000]);

    console.log('✅ Ventas de ejemplo creadas');
    console.log('\n🎉 Seed completado correctamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
};

seedDatabase();
