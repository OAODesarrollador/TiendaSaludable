require('dotenv').config();
const { db } = require('../config/database');

console.log('🔧 Iniciando migración de base de datos...');

const run = (query) =>
  new Promise((resolve, reject) => {
    db.run(query, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

(async () => {
  try {
    db.serialize(async () => {
      // Activar claves foráneas
      await run('PRAGMA foreign_keys = ON');

      console.log('➡️ Creando tabla de coeficientes si no existe...');
      await run(`
        CREATE TABLE IF NOT EXISTS category_coefficients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT UNIQUE NOT NULL,
          coefficient REAL DEFAULT 1.0,
          FOREIGN KEY (category) REFERENCES products(category)
        )
      `);

      console.log('➡️ Agregando índice de categoría (si no existe)...');
      await run(`
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)
      `);

      console.log('➡️ Verificando tipo de columna stock...');
      await run(`
        ALTER TABLE products RENAME TO products_old
      `);

      // Crear nueva tabla con stock REAL y min_stock REAL si fuera necesario
      await run(`
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

      console.log('➡️ Migrando datos desde tabla original...');
      await run(`
        INSERT OR IGNORE INTO products (
          id, sku, ean13, name, category, description,
          purchase_price, sale_price, stock, min_stock,
          supplier, expiration_date, active, created_at, updated_at
        )
        SELECT
          id, sku, ean13, name, category, description,
          purchase_price, sale_price, stock, min_stock,
          supplier, expiration_date, active, created_at, updated_at
        FROM products_old
      `);

      console.log('➡️ Eliminando tabla antigua...');
      await run(`DROP TABLE products_old`);

      console.log('➡️ Insertando coeficientes por categoría...');
      await new Promise((resolve, reject) => {
        db.all('SELECT DISTINCT category FROM products', [], async (err, rows) => {
          if (err) return reject(err);
          for (const row of rows) {
            await run(
              `INSERT OR IGNORE INTO category_coefficients (category, coefficient) VALUES (?, ?)`,
              [row.category, 1.0]
            );
          }
          resolve();
        });
      });

      console.log('✅ Migración completada sin pérdida de datos.');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
})();
