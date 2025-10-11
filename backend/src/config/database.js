const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/tienda.db';
const dbDir = path.dirname(dbPath);

// Crear directorio si no existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
  } else {
    console.log('✅ Conectado a SQLite');
  }
});

// Habilitar claves foráneas
db.run('PRAGMA foreign_keys = ON');

// Inicializar tablas
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
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 10,
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

    // Tabla de detalle de ventas
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

    // Índices para mejorar rendimiento
    db.run('CREATE INDEX IF NOT EXISTS idx_products_ean13 ON products(ean13)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');

    console.log('✅ Tablas inicializadas correctamente');
  });
};

// Función helper para promesas
const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
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

module.exports = {
  db,
  initialize,
  runAsync,
  getAsync,
  allAsync
};