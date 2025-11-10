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
const PORT = process.env.PORT || 5000;

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

// =======================================================
// Iniciar servidor
// =======================================================
app.listen(PORT, () => {
  console.log(`\n🌿 Servidor iniciado en http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}\n`);
});

module.exports = app;
