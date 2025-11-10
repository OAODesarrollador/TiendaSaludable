// =======================================================
// Configuración global del entorno y zona horaria (GMT-3)
// =======================================================
require('dotenv').config();
// backend/src/server.js - PRIMERA LÍNEA
process.env.TZ = 'America/Argentina/Buenos_Aires';
// Forzar formato de hora 24h en todas las salidas locales
process.env.LC_TIME = 'es_AR.UTF-8';
// Control horario global para toda la app
const { getCurrentARTimestamp } = require('./src/config/timezoneB');
global.getCurrentARTimestamp = getCurrentARTimestamp;


console.log('🌍 TZ configurado:', process.env.TZ);
console.log('⏰ Hora del sistema:', new Date().toString());

const express = require('express');

// =======================================================
// Dependencias
// =======================================================

const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const productRoutes = require('./src/routes/product.routes');
const saleRoutes = require('./src/routes/sale.routes');
const reportRoutes = require('./src/routes/report.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const importadorRoutes = require('./src/routes/importador.routes');
const cashRoutes = require('./src/routes/cash.routes');

// Inicializar base de datos
const db = require('./src/config/database');
db.initialize();

const app = express();

// ===========================================
// 🧩 Control inteligente de puerto y servidor
// ===========================================
const { execSync } = require("child_process");
const PORT = process.env.PORT || 5000;

// Función para cerrar procesos antiguos que usan el puerto
function freePort(port) {
  try {
    console.log(`🔍 Verificando si el puerto ${port} está en uso...`);
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = output.split("\n").filter(l => l.includes("LISTENING"));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid) {
          console.log(`⚠️  Cerrando proceso anterior (PID ${pid}) en puerto ${port}...`);
          execSync(`taskkill /PID ${pid} /F`);
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`);
    }
  } catch (err) {
    // Si no hay proceso, no hacer nada
  }
}

// 1️⃣ Liberar puerto antes de iniciar
freePort(PORT);

// 2️⃣ Iniciar servidor solo una vez
const server = app.listen(PORT, () => {
  console.log(`✅ Servidor backend escuchando en http://localhost:${PORT}`);
});

// 3️⃣ Manejo de errores
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`⚠️ El puerto ${PORT} sigue ocupado. Intentando cerrar y reintentar...`);
    try {
      freePort(PORT);
      setTimeout(() => {
        app.listen(PORT, () => {
          console.log(`✅ Servidor backend reiniciado en http://localhost:${PORT}`);
        });
      }, 1500);
    } catch (e) {
      console.error("❌ No se pudo liberar el puerto automáticamente:", e.message);
    }
  } else {
    console.error("❌ Error inesperado en el servidor:", err);
  }
});


// =======================================================
// Middlewares
// =======================================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Servir archivos estáticos (códigos de barras, PDFs)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================================================
// Rutas
// =======================================================
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importadorRoutes);
app.use('/api/coeficientes', require('./src/routes/coeficiente.routes'));
app.use('/api/cash', cashRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Servidor funcionando correctamente',
    hora_local: new Date().toLocaleString('es-AR', { timeZone: process.env.TZ }),
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
});



module.exports = app;
