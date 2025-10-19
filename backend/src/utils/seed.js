require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');
const { generateEAN13, generateBarcodeImage } = require('./ean13');

// Función para ejecutar queries con promesas
const runAsync = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID });
    });
  });
};

// Inicializar base de datos (tablas)
const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');

      // Usuarios
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

      // Productos
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
          stock INTEGER DEFAULT 0,
          min_stock INTEGER DEFAULT 10,
          supplier TEXT,
          expiration_date DATE,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ventas
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

      // Items de venta
      db.run(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // Devoluciones (nota de crédito)
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

      // Items de devolución
      db.run(`
        CREATE TABLE IF NOT EXISTS refund_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          refund_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY(refund_id) REFERENCES refunds(id),
          FOREIGN KEY(product_id) REFERENCES products(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

// Función para generar fecha de vencimiento aleatoria
const generateExpirationDate = (minMonths = 3, maxMonths = 24) => {
  const today = new Date();
  const months = Math.floor(Math.random() * (maxMonths - minMonths + 1)) + minMonths;
  const expirationDate = new Date(today);
  expirationDate.setMonth(expirationDate.getMonth() + months);
  return expirationDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
};

// Seed principal
const seedDatabase = async () => {
  try {
    console.log('🌱 Inicializando base de datos y creando tablas...');
    await initializeDatabase();
    console.log('✅ Tablas listas\n');

    // 1️⃣ Usuarios
    console.log('👤 Creando usuarios...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const vendedorPassword = await bcrypt.hash('vendedor123', 10);

    await runAsync(`
      INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES
      ('admin', ?, 'Administrador', 'admin'),
      ('vendedor', ?, 'Juan Pérez', 'vendedor')
    `, [adminPassword, vendedorPassword]);
    console.log('✅ Usuarios creados\n');

    // 2️⃣ Productos
    console.log('📦 Creando productos...');
    const products = [
      { name: 'Varios', category: 'Varios', purchase: 1, sale: 2, stock: 10000 },
      
    ];

    const barcodeDir = path.join(__dirname, '../../uploads/barcodes');
    if (!fs.existsSync(barcodeDir)) fs.mkdirSync(barcodeDir, { recursive: true });

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const sku = `PROD-${String(i + 1).padStart(4, '0')}`;
      const ean13 = generateEAN13();
      const expirationDate = generateExpirationDate(3, 24);

      await runAsync(`
        INSERT INTO products (
          sku, ean13, name, category, description,
          purchase_price, sale_price, stock, min_stock, supplier, expiration_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sku, ean13, product.name, product.category,
        `${product.name} de alta calidad, origen controlado`,
        product.purchase, product.sale, product.stock, 10,
        'Proveedor Natural SA', expirationDate
      ]);

      const barcodePath = path.join(barcodeDir, `${ean13}.png`);
      generateBarcodeImage(ean13, barcodePath);

      console.log(`   ✓ ${product.name} (EAN: ${ean13}, Vence: ${expirationDate})`);
    }

    console.log(`\n✅ ${products.length} productos creados con códigos EAN-13 y fechas de vencimiento\n`);

    // 3️⃣ Crear ventas de ejemplo
    console.log('💰 Creando ventas de ejemplo...');
    const salesCount = 1;

    for (let i = 0; i < salesCount; i++) {
      const subtotal = Math.floor(Math.random() * 4500) + 500;
      const tax = subtotal * 0.21;
      const total = subtotal + tax;

      const sale = await runAsync(`
        INSERT INTO sales (user_id, subtotal, tax, total, payment_method, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        Math.random() > 0.5 ? 1 : 2,
        subtotal,
        tax,
        total,
        Math.random() > 0.5 ? 'efectivo' : 'tarjeta',
        new Date().toISOString()
      ]);

      const itemsCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < itemsCount; j++) {
        const productId = Math.floor(Math.random() * products.length) + 1;
        const quantity = Math.floor(Math.random() * 3) + 1;
        const unitPrice = products[productId - 1].sale;
        const itemSubtotal = unitPrice * quantity;

        await runAsync(`
          INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          sale.id, productId, products[productId - 1].name,
          quantity, unitPrice, itemSubtotal
        ]);

        // Actualizar stock
        await runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, productId]);
      }
    }

    console.log(`✅ ${salesCount} ventas creadas con stock actualizado`);

    console.log('\n🎉 Seed completado exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
};

// Ejecutar seed
seedDatabase();