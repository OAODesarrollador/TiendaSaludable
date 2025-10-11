require('dotenv').config();
const { db } = require('../config/database');

/**
 * Script para inicializar la base de datos
 * Crea todas las tablas necesarias
 */

const initializeDatabase = () => {
  console.log('🔧 Inicializando base de datos...\n');

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Habilitar claves foráneas
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('❌ Error habilitando foreign keys:', err);
          reject(err);
          return;
        }
      });

      console.log('👤 Creando tabla de usuarios...');
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creando tabla users:', err);
          reject(err);
          return;
        }
        console.log('✅ Tabla users creada');
      });

      console.log('📦 Creando tabla de productos...');
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creando tabla products:', err);
          reject(err);
          return;
        }
        console.log('✅ Tabla products creada');
      });

      console.log('💰 Creando tabla de ventas...');
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creando tabla sales:', err);
          reject(err);
          return;
        }
        console.log('✅ Tabla sales creada');
      });

      console.log('📝 Creando tabla de detalle de ventas...');
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
      `, (err) => {
        if (err) {
          console.error('❌ Error creando tabla sale_items:', err);
          reject(err);
          return;
        }
        console.log('✅ Tabla sale_items creada');
      });

      console.log('🔍 Creando índices...');
      db.run('CREATE INDEX IF NOT EXISTS idx_products_ean13 ON products(ean13)', (err) => {
        if (err) console.error('⚠️ Error creando índice ean13:', err);
      });

      db.run('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at)', (err) => {
        if (err) console.error('⚠️ Error creando índice sales_date:', err);
      });

      db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)', (err) => {
        if (err) console.error('⚠️ Error creando índice category:', err);
        console.log('✅ Índices creados');
        console.log('\n✅ Base de datos inicializada correctamente\n');
        console.log('📊 Puedes ejecutar "npm run seed" para cargar datos de ejemplo\n');
        resolve();
        process.exit(0);
      });
    });
  });
};

// Ejecutar
initializeDatabase().catch((err) => {
  console.error('❌ Error inicializando base de datos:', err);
  process.exit(1);
});