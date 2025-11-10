// Zona horaria local
process.env.TZ = 'America/Argentina/Buenos_Aires';


const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 📦 Ruta de la base de datos
const dbPath = process.env.DB_PATH || './database/tienda.db';
const dbDir = path.dirname(dbPath);

// Crear directorio si no existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Conexión a SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
  } else {
    console.log(`✅ Conectado a SQLite → ${dbPath}`);
  }
});

// Activar claves foráneas (solo para las relaciones válidas)
db.run('PRAGMA foreign_keys = ON');

// =========================
//  Inicialización de tablas
// =========================
const initialize = () => {
  db.serialize(() => {
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
        stock REAL DEFAULT 0,              -- ✅ ahora permite decimales
        min_stock REAL DEFAULT 10,         -- ✅ permite decimales
        supplier TEXT,
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

    // Detalle de ventas
    db.run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // ✅ Nueva tabla de coeficientes por categoría (sin foreign key)
    db.run(`
      CREATE TABLE IF NOT EXISTS category_coefficients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT UNIQUE NOT NULL,
        coefficient REAL DEFAULT 1.0
      )
    `);

    // Índices para optimizar consultas
    db.run('CREATE INDEX IF NOT EXISTS idx_products_ean13 ON products(ean13)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
    db.run('CREATE INDEX IF NOT EXISTS idx_coeff_category ON category_coefficients(category)');

    console.log('✅ Tablas inicializadas correctamente');

    // 🔧 Inicialización automática de coeficientes
    db.all('SELECT DISTINCT category FROM products', [], (err, rows) => {
      if (err) {
        console.error('⚠️ Error inicializando coeficientes:', err.message);
      } else if (rows.length > 0) {
        rows.forEach((r) => {
          db.run(
            'INSERT OR IGNORE INTO category_coefficients (category, coefficient) VALUES (?, ?)',
            [r.category, 1.0]
          );
        });
        console.log(`⚙️ Coeficientes inicializados para ${rows.length} categorías existentes.`);
      } else {
        console.log('ℹ️ No se encontraron categorías para inicializar coeficientes.');
      }
    });
  });
};

// =========================
//  Helpers Promesas Async
// =========================
const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Exportar conexión y utilidades
module.exports = {
  db,
  initialize,
  runAsync,
  getAsync,
  allAsync
};
