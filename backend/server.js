require('dotenv').config();

process.env.TZ = 'America/Argentina/Buenos_Aires';
process.env.LC_TIME = 'es_AR.UTF-8';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { execSync } = require('child_process');

const { getCurrentARTimestamp } = require('./src/config/timezoneB');
const db = require('./src/config/database');

const authRoutes = require('./src/routes/auth.routes');
const productRoutes = require('./src/routes/product.routes');
const saleRoutes = require('./src/routes/sale.routes');
const reportRoutes = require('./src/routes/report.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const importadorRoutes = require('./src/routes/importador.routes');
const cashRoutes = require('./src/routes/cash.routes');
const coeficienteRoutes = require('./src/routes/coeficiente.routes');
const saleTypesRoutes = require('./src/routes/saleTypes.routes');

global.getCurrentARTimestamp = getCurrentARTimestamp;

function freePort(port) {
  try {
    console.log(`🔍 Verificando si el puerto ${port} está en uso...`);
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = output.split('\n').filter((line) => line.includes('LISTENING'));
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
  } catch (_error) {
    // No había proceso usando el puerto.
  }
}

function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/import', importadorRoutes);
  app.use('/api/coeficientes', coeficienteRoutes);
  app.use('/api/cash', cashRoutes);
  app.use('/api/sale-types', saleTypesRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'OK',
      message: 'Servidor funcionando correctamente',
      hora_local: new Date().toLocaleString('es-AR', { timeZone: process.env.TZ }),
      timestamp: new Date().toISOString()
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error interno del servidor'
    });
  });

  return app;
}

function startServer(options = {}) {
  const port = options.port || process.env.PORT || 5000;
  const shouldFreePort = options.freePortBeforeStart !== false;

  console.log('🌍 TZ configurado:', process.env.TZ);
  console.log('⏰ Hora del sistema:', new Date().toString());

  db.initialize();

  const app = createApp();

  if (shouldFreePort) {
    freePort(port);
  }

  const server = app.listen(port, () => {
    console.log(`✅ Servidor backend escuchando en http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && shouldFreePort) {
      console.error(`⚠️ El puerto ${port} sigue ocupado. Intentando cerrar y reintentar...`);
      try {
        freePort(port);
        setTimeout(() => {
          app.listen(port, () => {
            console.log(`✅ Servidor backend reiniciado en http://localhost:${port}`);
          });
        }, 1500);
      } catch (error) {
        console.error('❌ No se pudo liberar el puerto automáticamente:', error.message);
      }
    } else {
      console.error('❌ Error inesperado en el servidor:', err);
    }
  });

  return { app, server };
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
