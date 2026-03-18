process.env.TZ = 'America/Argentina/Buenos_Aires';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const configuredDbPath = process.env.DB_PATH || './database/tienda.db';
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.resolve(__dirname, '..', '..', configuredDbPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log(`Conectado a SQLite -> ${dbPath}`);
  }
});

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.db`);

  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Backup automático creado: ${backupPath}`);
  } catch (error) {
    console.error('No se pudo crear el backup:', error.message);
  }
}

async function ensureColumn(table, name, type) {
  const columns = await allAsync(`PRAGMA table_info(${table})`);
  const exists = columns.some((column) => column.name === name);

  if (!exists) {
    console.log(`Migrando ${table}: agregando columna ${name}`);
    await runAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

async function ensureBaseSchema() {
  await runAsync('PRAGMA foreign_keys = ON');

  await runAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runAsync(`
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

  await runAsync(`
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

  await runAsync(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'efectivo',
      sale_type_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (sale_type_id) REFERENCES sale_types(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'percentage',
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      reason TEXT,
      subtotal REAL,
      tax REAL,
      total REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS refund_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (refund_id) REFERENCES refunds(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS category_coefficients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT UNIQUE NOT NULL,
      coefficient REAL DEFAULT 1.0
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS sale_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_name TEXT UNIQUE NOT NULL,
      description TEXT,
      commission_rate REAL DEFAULT 0,
      active INTEGER DEFAULT 1
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      opening_amount REAL NOT NULL,
      closing_amount REAL,
      total_income REAL DEFAULT 0,
      total_expense REAL DEFAULT 0,
      carried_balance REAL DEFAULT 0,
      closed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      concept TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      date TEXT,
      FOREIGN KEY (session_id) REFERENCES cash_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

async function migrateCanonicalDatabase() {
  createBackup();

  await ensureBaseSchema();

  await ensureColumn('products', 'expiration_date', 'DATE');
  await ensureColumn('sale_items', 'discount', 'REAL DEFAULT 0');
  await ensureColumn('sale_items', 'discount_type', "TEXT DEFAULT 'percentage'");
  await ensureColumn('sales', 'sale_type_id', 'INTEGER');
  await ensureColumn('sales', 'order_discount_amount', 'REAL DEFAULT 0');
  await ensureColumn('sales', 'order_discount_type', 'TEXT');
  await ensureColumn('sales', 'order_discount_value', 'REAL DEFAULT 0');
  await ensureColumn('cash_sessions', 'closed_at', 'DATETIME');
  await ensureColumn('cash_movements', 'payment_method', 'TEXT');
  await ensureColumn('cash_movements', 'user_id', 'INTEGER');
  await ensureColumn('cash_movements', 'date', 'TEXT');

  await runAsync(`
    UPDATE cash_movements
    SET date = (
      SELECT cash_sessions.date
      FROM cash_sessions
      WHERE cash_sessions.id = cash_movements.session_id
    )
    WHERE date IS NULL OR TRIM(date) = ''
  `);

  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category)
  `);
  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_products_ean13
    ON products(ean13)
  `);
  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_sales_date
    ON sales(created_at)
  `);
  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_cash_movements_session
    ON cash_movements(session_id)
  `);
  console.log('Migración sobre base canónica completada.');
}

const initialize = () => {
  migrateCanonicalDatabase().catch((error) => {
    console.error('Error inicializando estructura SQLite:', error);
  });
};

module.exports = {
  db,
  initialize,
  runAsync,
  getAsync,
  allAsync
};
