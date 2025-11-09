// diagnostic-timezone.js
// Ejecutar con: node diagnostic-timezone.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ajusta la ruta a tu base de datos
const DB_PATH = path.join(__dirname, '../../database/tienda.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos\n');
});

console.log('='.repeat(60));
console.log('🔍 DIAGNÓSTICO DE ZONA HORARIA - SQLITE');
console.log('='.repeat(60));

// 1. Verificar zona horaria del sistema
console.log('\n📍 1. ZONA HORARIA DEL SISTEMA:');
console.log('-'.repeat(60));
const now = new Date();
console.log('Date.now():', now.toISOString());
console.log('Date local:', now.toString());
console.log('Timezone offset (minutos):', now.getTimezoneOffset());
console.log('Timezone offset (horas):', now.getTimezoneOffset() / 60);
console.log('process.env.TZ:', process.env.TZ || '(no configurado)');

// 2. Verificar hora de SQLite
console.log('\n⏰ 2. HORA ACTUAL EN SQLITE:');
console.log('-'.repeat(60));

db.get("SELECT datetime('now') as utc_time", (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log("datetime('now') [UTC]:", row.utc_time);
  }
});

db.get("SELECT datetime('now', 'localtime') as local_time", (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log("datetime('now', 'localtime'):", row.local_time);
  }
});

// 3. Ver cómo SQLite guarda CURRENT_TIMESTAMP
console.log('\n💾 3. PRUEBA DE INSERCIÓN CON CURRENT_TIMESTAMP:');
console.log('-'.repeat(60));

db.run(`
  CREATE TEMP TABLE IF NOT EXISTS test_timestamps (
    id INTEGER PRIMARY KEY,
    created_default DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_manual TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creando tabla temporal:', err);
    return;
  }

  const manualTime = new Date().toISOString();
  
  db.run(`
    INSERT INTO test_timestamps (created_manual) 
    VALUES (?)
  `, [manualTime], function(err) {
    if (err) {
      console.error('Error insertando:', err);
      return;
    }

    db.get(`
      SELECT 
        created_default,
        created_manual,
        datetime(created_default) as created_default_formatted,
        datetime(created_manual) as created_manual_formatted
      FROM test_timestamps 
      WHERE id = ?
    `, [this.lastID], (err, row) => {
      if (err) {
        console.error('Error consultando:', err);
      } else {
        console.log('\nResultados de la inserción:');
        console.log('  created_default (CURRENT_TIMESTAMP):', row.created_default);
        console.log('  created_manual (desde Node.js):', row.created_manual);
        console.log('  Diferencia detectada:', compareTimes(row.created_default, row.created_manual));
      }

      // 4. Verificar ventas reales
      checkRealSales();
    });
  });
});

// 4. Verificar última venta real
function checkRealSales() {
  console.log('\n📊 4. ÚLTIMA VENTA REGISTRADA:');
  console.log('-'.repeat(60));
  
  db.get(`
    SELECT 
      id,
      created_at,
      datetime(created_at) as created_formatted
    FROM sales 
    ORDER BY id DESC 
    LIMIT 1
  `, (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else if (!row) {
      console.log('⚠️  No hay ventas registradas aún');
    } else {
      console.log('ID:', row.id);
      console.log('created_at (raw):', row.created_at);
      console.log('created_at (formatted):', row.created_formatted);
      console.log('Parseado en Node.js:', new Date(row.created_at).toString());
      console.log('ISO desde Node.js:', new Date(row.created_at).toISOString());
    }

    // 5. Resumen y recomendaciones
    showRecommendations();
  });
}

// Comparar tiempos
function compareTimes(time1, time2) {
  try {
    const d1 = new Date(time1);
    const d2 = new Date(time2);
    const diffMs = Math.abs(d1 - d2);
    const diffHours = diffMs / (1000 * 60 * 60);
    return `${diffHours.toFixed(2)} horas`;
  } catch (e) {
    return 'No se pudo calcular';
  }
}

// Mostrar recomendaciones
function showRecommendations() {
  console.log('\n💡 5. RECOMENDACIONES:');
  console.log('='.repeat(60));
  
  const offset = new Date().getTimezoneOffset() / 60;
  
  if (offset !== 3) {
    console.log('⚠️  PROBLEMA DETECTADO:');
    console.log(`   Tu servidor NO está en zona horaria de Argentina (GMT-3)`);
    console.log(`   Offset actual: GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`);
    console.log('\n📋 SOLUCIÓN:');
    console.log('   1. Configurar TZ en el servidor:');
    console.log('      export TZ="America/Argentina/Buenos_Aires"');
    console.log('   2. O en tu app Node.js (antes de importar modules):');
    console.log('      process.env.TZ = "America/Argentina/Buenos_Aires";');
    console.log('   3. Reiniciar la aplicación');
  } else {
    console.log('✅ Zona horaria del servidor: Correcta (GMT-3)');
    console.log('\n📋 PASOS SIGUIENTES:');
    console.log('   1. Si SQLite guarda en UTC, ajusta al insertar:');
    console.log("      datetime('now', 'localtime')");
    console.log('   2. Si guardas desde Node.js, NO uses .toISOString()');
    console.log('   3. Usa el formato: YYYY-MM-DD HH:mm:ss (local)');
  }

  console.log('\n' + '='.repeat(60));
  
  db.close((err) => {
    if (err) {
      console.error('Error cerrando DB:', err);
    }
    process.exit(0);
  });
}