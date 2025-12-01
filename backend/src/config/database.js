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

// Ajuste global de zona horaria
const { getCurrentARTimestamp } = require('./timezoneB'); // ⚠️ ajusta la ruta si está en otro directorio
process.env.TZ = 'America/Argentina/Buenos_Aires';

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
// =========================
// 🔄 Auto-migrador de tablas + backup automático
// =========================
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.db`);
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`🗃️ Backup automático creado: ${backupPath}`);
  } catch (err) {
    console.error('⚠️ No se pudo crear el backup:', err.message);
  }
}

async function autoMigrate() {
  console.log('🔍 Iniciando verificación automática de estructura...');
  createBackup();

  const tablesToMigrate = {
    products: [
      { name: 'min_stock', type: 'REAL DEFAULT 10' },
      { name: 'active', type: 'INTEGER DEFAULT 1' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ],
    sales: [
      { name: 'payment_method', type: "TEXT DEFAULT 'efectivo'" },
      { name: 'created_at', type: 'DATETIME NOT NULL' } // controlado desde Node
    ],
    sale_items: [
      { name: 'discount', type: 'REAL DEFAULT 0' },
      { name: 'discount_type', type: "TEXT DEFAULT 'percentage'" }
    ],
    cash_sessions: [
      { name: 'closed_at', type: 'TEXT' }
    ],
    category_coefficients: [
      { name: 'coefficient', type: 'REAL DEFAULT 1.0' }
    ],
        sale_commissions: [
      { name: 'payment_method', type: "TEXT" },
      { name: 'base_amount', type: "REAL DEFAULT 0" },
      { name: 'commission_rate', type: "REAL DEFAULT 0" },
      { name: 'commission_amount', type: "REAL DEFAULT 0" },
      { name: 'created_at', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" }
    ],
    cash_movements: [
      { name: 'type', type: "TEXT" },
      { name: 'concept', type: "TEXT" },
      { name: 'payment_method', type: "TEXT" },
      { name: 'user_id', type: "INTEGER" },
      { name: 'created_at', type: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
      { name: 'date', type: "TEXT" }
    ]
  };


  for (const [table, columns] of Object.entries(tablesToMigrate)) {
    const existingCols = await allAsync(`PRAGMA table_info(${table})`);
    const existingNames = existingCols.map(c => c.name);

    for (const col of columns) {
      if (!existingNames.includes(col.name)) {
        console.log(`🧩 Migrando tabla ${table}: agregando columna ${col.name}`);
        await runAsync(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  }

  console.log('✅ Migración incremental completada correctamente.');
}

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
        stock REAL DEFAULT 0,
        min_stock REAL DEFAULT 10,
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

    // Tabla de coeficientes por categoría
    db.run(`
      CREATE TABLE IF NOT EXISTS category_coefficients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT UNIQUE NOT NULL,
        coefficient REAL DEFAULT 1.0
      )
    `);

    // Tabla de comisiones por venta
db.run(`
  CREATE TABLE IF NOT EXISTS sale_commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    base_amount REAL NOT NULL,
    commission_rate REAL NOT NULL,
    commission_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
  )
`);
// Tabla de movimientos de caja
// Tabla de movimientos de caja
db.run(`
  CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    type TEXT NOT NULL,                       -- 'ingreso', 'egreso', 'commission'
    concept TEXT NOT NULL,
    amount REAL NOT NULL,                     -- positivo = ingreso, negativo = egreso
    payment_method TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    date TEXT,
    FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE
  )
`);



    console.log('✅ Tablas inicializadas correctamente');

    // 🔧 Inicialización automática de coeficientes
    db.all('SELECT DISTINCT category FROM products', [], (err, rows) => {
      if (!err && rows.length > 0) {
        rows.forEach((r) => {
          db.run(
            'INSERT OR IGNORE INTO category_coefficients (category, coefficient) VALUES (?, ?)',
            [r.category, 1.0]
          );
        });
      }
    });

    // Ejecutar migración automática al final
    setTimeout(async () => {
      try {
        console.log('🕒 Zona horaria aplicada:', process.env.TZ);
        console.log('⏰ Hora local:', global.getCurrentARTimestamp());
        await autoMigrate();
      } catch (err) {
        console.error('⚠️ Error en migración automática:', err);
      }
    }, 1500);
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

module.exports = {
  db,
  initialize,
  runAsync,
  getAsync,
  allAsync
};

