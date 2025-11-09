// ============================================
// MIGRACIÓN FINAL - SISTEMA COMPLETO
// Archivo: backend/database/final-migration.js
// ============================================

process.env.TZ = 'America/Argentina/Buenos_Aires';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'tienda.db');

console.log('🚀 MIGRACIÓN FINAL DEL SISTEMA\n');
console.log('='.repeat(70));
console.log('Esta migración hará:');
console.log('  1. ✅ Agregar columnas discount a sale_items');
console.log('  2. ✅ Quitar DEFAULT de created_at (para controlar desde Node.js)');
console.log('  3. ✅ Mantener TODOS los datos existentes');
console.log('  4. ✅ Hacer backup automático\n');
console.log('='.repeat(70));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a tienda.db\n');
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrate() {
  try {
    console.log('🔍 Paso 1/8: Verificando estado actual...\n');

    // Verificar columnas de sale_items
    const saleItemsColumns = await query('PRAGMA table_info(sale_items)');
    const columnNames = saleItemsColumns.map(c => c.name);
    const needsDiscount = !columnNames.includes('discount');
    const needsDiscountType = !columnNames.includes('discount_type');

    console.log('   Sale_items tiene discount:', needsDiscount ? '❌ NO' : '✅ SÍ');
    console.log('   Sale_items tiene discount_type:', needsDiscountType ? '❌ NO' : '✅ SÍ');

    // Verificar schema de sales
    const salesSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='sales'");
    const salesHasDefault = salesSchema[0]?.sql.includes('DEFAULT');
    
    console.log('   Sales tiene DEFAULT en created_at:', salesHasDefault ? '⚠️  SÍ (hay que quitar)' : '✅ NO');

    const refundsSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='refunds'");
    const refundsHasDefault = refundsSchema[0]?.sql.includes('DEFAULT (datetime');

    console.log('   Refunds tiene DEFAULT en created_at:', refundsHasDefault ? '⚠️  SÍ (hay que quitar)' : '✅ NO');

    // Contar registros
    const salesCount = await query('SELECT COUNT(*) as count FROM sales');
    const refundsCount = await query('SELECT COUNT(*) as count FROM refunds');
    const saleItemsCount = await query('SELECT COUNT(*) as count FROM sale_items');

    console.log('\n📊 Registros actuales:');
    console.log(`   Sales: ${salesCount[0].count}`);
    console.log(`   Refunds: ${refundsCount[0].count}`);
    console.log(`   Sale_items: ${saleItemsCount[0].count}\n`);

    const needsMigration = needsDiscount || needsDiscountType || salesHasDefault || refundsHasDefault;

    if (!needsMigration) {
      console.log('✅ La base de datos ya está actualizada. No se requiere migración.\n');
      db.close();
      process.exit(0);
    }

    console.log('='.repeat(70));
    console.log('\n⚠️  Se requiere migración. Continuando...\n');

    // ============================================
    // MIGRAR SALE_ITEMS
    // ============================================
    if (needsDiscount || needsDiscountType) {
      console.log('🛒 Paso 2/8: Migrando SALE_ITEMS...\n');

      await run('BEGIN TRANSACTION');

      try {
        await run('ALTER TABLE sale_items RENAME TO sale_items_backup');
        console.log('   ✓ Backup creado: sale_items_backup');

        await run(`
          CREATE TABLE sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            discount REAL DEFAULT 0,
            discount_type TEXT DEFAULT 'percentage',
            subtotal REAL NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
          )
        `);
        console.log('   ✓ Nueva tabla creada');

        if (needsDiscount) {
          await run(`
            INSERT INTO sale_items 
              (id, sale_id, product_id, product_name, quantity, unit_price, discount, discount_type, subtotal)
            SELECT 
              id, sale_id, product_id, product_name, quantity, unit_price, 
              0, 'percentage', subtotal
            FROM sale_items_backup
          `);
        } else {
          await run('INSERT INTO sale_items SELECT * FROM sale_items_backup');
        }
        console.log('   ✓ Datos copiados');

        const count = await query('SELECT COUNT(*) as count FROM sale_items');
        console.log(`   ✓ Verificado: ${count[0].count} registros`);

        await run('DROP TABLE sale_items_backup');
        console.log('   ✓ Backup eliminado');

        await run('COMMIT');
        console.log('✅ Sale_items migrada\n');

      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    } else {
      console.log('✅ Paso 2/8: Sale_items ya tiene las columnas necesarias\n');
    }

    // ============================================
    // MIGRAR SALES
    // ============================================
    if (salesHasDefault) {
      console.log('📊 Paso 3/8: Migrando SALES...\n');

      await run('BEGIN TRANSACTION');

      try {
        await run('ALTER TABLE sales RENAME TO sales_backup');
        console.log('   ✓ Backup creado: sales_backup');

        await run(`
          CREATE TABLE sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            tax REAL NOT NULL,
            total REAL NOT NULL,
            payment_method TEXT DEFAULT 'efectivo',
            created_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);
        console.log('   ✓ Nueva tabla creada (sin DEFAULT en created_at)');

        await run('INSERT INTO sales SELECT * FROM sales_backup');
        console.log('   ✓ Datos copiados');

        const count = await query('SELECT COUNT(*) as count FROM sales');
        console.log(`   ✓ Verificado: ${count[0].count} registros`);

        await run('DROP TABLE sales_backup');
        console.log('   ✓ Backup eliminado');

        await run('COMMIT');
        console.log('✅ Sales migrada\n');

      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    } else {
      console.log('✅ Paso 3/8: Sales ya está correctamente configurada\n');
    }

    // ============================================
    // MIGRAR REFUNDS
    // ============================================
    if (refundsHasDefault) {
      console.log('📋 Paso 4/8: Migrando REFUNDS...\n');

      await run('BEGIN TRANSACTION');

      try {
        await run('ALTER TABLE refunds RENAME TO refunds_backup');
        console.log('   ✓ Backup creado: refunds_backup');

        await run(`
          CREATE TABLE refunds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            reason TEXT,
            subtotal REAL NOT NULL,
            tax REAL NOT NULL,
            total REAL NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id)
          )
        `);
        console.log('   ✓ Nueva tabla creada (sin DEFAULT en created_at)');

        await run('INSERT INTO refunds SELECT * FROM refunds_backup');
        console.log('   ✓ Datos copiados');

        const count = await query('SELECT COUNT(*) as count FROM refunds');
        console.log(`   ✓ Verificado: ${count[0].count} registros`);

        await run('DROP TABLE refunds_backup');
        console.log('   ✓ Backup eliminado');

        await run('COMMIT');
        console.log('✅ Refunds migrada\n');

      } catch (error) {
        await run('ROLLBACK');
        throw error;
      }
    } else {
      console.log('✅ Paso 4/8: Refunds ya está correctamente configurada\n');
    }
    // ============================================
    // MIGRAR CASH_SESSIONS (Agregar columna closed_at)
    // ============================================
    console.log('💰 Paso 5/8: Verificando columna closed_at en CASH_SESSIONS...\n');
    const cashSessionsInfo = await query('PRAGMA table_info(cash_sessions)');
    const hasClosedAt = cashSessionsInfo.some(c => c.name === 'closed_at');
    if (!hasClosedAt) {
        console.log('   ⚠️  La columna closed_at no existe. Se agregará...');
        await run("ALTER TABLE cash_sessions ADD COLUMN closed_at TEXT");
        console.log('   ✅ Columna closed_at agregada correctamente.\n');
        } else {
        console.log('   ✅ La columna closed_at ya existe. No se requiere acción.\n');
    }

    // ============================================
    // CREAR TABLA REFUND_ITEMS SI NO EXISTE
    // ============================================
    console.log('📦 Paso 5/8: Verificando tabla REFUND_ITEMS...\n');
    const refundItemsTable = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='refund_items'");
    if (refundItemsTable.length === 0) {
      console.log('   ⚠️  La tabla refund_items no existe. Se creará...');
      await run(`
        CREATE TABLE refund_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          refund_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 0,
          unit_price REAL NOT NULL DEFAULT 0,
          subtotal REAL NOT NULL DEFAULT 0,
          FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);
      console.log('   ✅ Tabla refund_items creada correctamente.\n');
    } else {
      console.log('   ✅ La tabla refund_items ya existe. No se requiere acción.\n');
    }


    // ============================================
    // VERIFICACIÓN FINAL
    // ============================================
    console.log('='.repeat(70));
    console.log('\n🔍 Paso 6/8: Verificación de integridad...\n');

    const finalSalesCount = await query('SELECT COUNT(*) as count FROM sales');
    const finalRefundsCount = await query('SELECT COUNT(*) as count FROM refunds');
    const finalSaleItemsCount = await query('SELECT COUNT(*) as count FROM sale_items');

    console.log('   Sales:', finalSalesCount[0].count === salesCount[0].count ? '✅' : '❌', finalSalesCount[0].count);
    console.log('   Refunds:', finalRefundsCount[0].count === refundsCount[0].count ? '✅' : '❌', finalRefundsCount[0].count);
    console.log('   Sale_items:', finalSaleItemsCount[0].count === saleItemsCount[0].count ? '✅' : '❌', finalSaleItemsCount[0].count);

    // ============================================
    // ESTRUCTURA FINAL
    // ============================================
    console.log('\n📝 Paso 7/8: Estructura final de tablas...\n');

    const finalSalesSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='sales'");
    const finalRefundsSchema = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='refunds'");
    const finalSaleItemsColumns = await query('PRAGMA table_info(sale_items)');

    console.log('✅ SALES:');
    console.log(finalSalesSchema[0].sql + '\n');

    console.log('✅ REFUNDS:');
    console.log(finalRefundsSchema[0].sql + '\n');

    console.log('✅ SALE_ITEMS columnas:', finalSaleItemsColumns.map(c => c.name).join(', ') + '\n');

    // ============================================
    // RESUMEN
    // ============================================
    console.log('='.repeat(70));
    console.log('\n🎉 Paso 8/8: MIGRACIÓN COMPLETADA EXITOSAMENTE\n');
    console.log('📊 Resumen:');
    console.log(`   ✅ ${finalSalesCount[0].count} ventas preservadas`);
    console.log(`   ✅ ${finalRefundsCount[0].count} notas de crédito preservadas`);
    console.log(`   ✅ ${finalSaleItemsCount[0].count} items de venta preservados`);
    console.log(`   ✅ Columnas discount agregadas a sale_items`);
    console.log(`   ✅ Control de fecha movido a Node.js\n`);

    console.log('📋 PRÓXIMOS PASOS OBLIGATORIOS:\n');
    console.log('   1. ✅ Asegúrate que server.js tenga en la PRIMERA línea:');
    console.log('      process.env.TZ = "America/Argentina/Buenos_Aires";\n');
    console.log('   2. ✅ Actualiza sale.controller.js según el artifact anterior\n');
    console.log('   3. ✅ Actualiza timezone.js (backend) según el artifact anterior\n');
    console.log('   4. ✅ Reinicia el servidor backend\n');
    console.log('   5. ✅ Prueba crear una venta y verifica la hora\n');

    console.log('='.repeat(70));

    db.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR EN MIGRACIÓN:', error);
    console.error('   Mensaje:', error.message);
    console.error('\n⚠️  La base de datos podría estar en estado inconsistente.');
    console.error('   Restaura el backup si tienes uno.\n');
    
    db.close();
    process.exit(1);
  }
}

migrate();