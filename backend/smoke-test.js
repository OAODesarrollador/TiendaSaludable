const fs = require('fs');
const path = require('path');

const BACKEND_DIR = __dirname;
const SOURCE_DB = path.join(BACKEND_DIR, 'database', 'tienda.db');
const TEMP_ROOT = path.join(BACKEND_DIR, '.tmp-smoke');
if (!fs.existsSync(TEMP_ROOT)) {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
}
const TEMP_DIR = fs.mkdtempSync(path.join(TEMP_ROOT, 'run-'));
const TEMP_DB = path.join(TEMP_DIR, 'tienda-smoke.db');
const PORT = 5051;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const TEST_DATE = '2099-01-15';

fs.copyFileSync(SOURCE_DB, TEMP_DB);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Esperar a que levante.
    }

    await sleep(500);
  }

  throw new Error('El backend no respondió al health check.');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return data;
}

async function requestStatus(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.status;
}

async function run() {
  process.env.DB_PATH = TEMP_DB;
  process.env.PORT = String(PORT);
  const { startServer } = require('./server');
  const { server } = startServer({ port: PORT, freePortBeforeStart: false });

  try {
    await waitForHealth();

    const login = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const headers = {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json'
    };

    const open = await requestJson(`${BASE_URL}/cash/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        opening_amount: 1000,
        date: TEST_DATE
      })
    });

    const product = await requestJson(`${BASE_URL}/products/1`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });

    const sale = await requestJson(`${BASE_URL}/sales`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          {
            product_id: 1,
            quantity: 1,
            price: Number(product.sale_price),
            discount: 0,
            discountType: 'percentage'
          }
        ],
        payment_method: 'debito'
      })
    });

    await requestStatus(`${BASE_URL}/sales/${sale.sale.id}/ticket`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });

    const refund = await requestJson(`${BASE_URL}/sales/${sale.sale.id}/refunds`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [{ product_id: 1, quantity: 1 }],
        reason: 'Smoke test'
      })
    });

    await requestStatus(`${BASE_URL}/sales/refund/${refund.refund.id}/pdf`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });

    const cashReport = await requestJson(
      `${BASE_URL}/cash/report?period=custom&start_date=${TEST_DATE}&end_date=${TEST_DATE}`,
      {
        headers: { Authorization: `Bearer ${login.token}` }
      }
    );

    const close = await requestJson(`${BASE_URL}/cash/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.token}` }
    });

    if (!open.session || !sale.sale || !refund.refund || !close.session) {
      throw new Error('Faltan datos esperados en el flujo crítico.');
    }

    if (!Array.isArray(cashReport.sessions) || cashReport.sessions.length === 0) {
      throw new Error('El reporte de caja no devolvió sesiones.');
    }

    console.log(
      JSON.stringify(
        {
          login_user: login.user.username,
          opened_session_date: open.session.date,
          sale_id: sale.sale.id,
          refund_id: refund.refund.id,
          closed_session: close.session.closed
        },
        null,
        2
      )
    );
  } finally {
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }

    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (_error) {
      // Limpieza best-effort.
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
