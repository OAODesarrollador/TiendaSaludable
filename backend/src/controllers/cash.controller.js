// ============================================
// CASH CONTROLLER (control de caja diario)
// ============================================
const { runAsync, getAsync, allAsync } = require('../config/database');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');


const db = require("../config/database");

const { getCurrentARTimestamp, getCurrentARDate } = require('../config/timezoneB');

// --------------------------------------------
// Helpers
// --------------------------------------------
// TZ-safe: si es "YYYY-MM-DD" lo dejamos tal cual (no lo reparseamos con Date)
// si es Date/fecha válida, devolvemos la fecha local sin tocar horas.
const toISODate = (d = new Date()) => {
  if (typeof d === 'string') {
    // aceptar "YYYY-MM-DD" y normalizar a 10 chars por si viene con tiempo
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toLatinoDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split('-');
    return `${day}-${m}-${y}`;
  }
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
};

const isSaleMovementConcept = (concept) => /^Venta #\d+/i.test(String(concept || '').trim());
const isRefundMovementConcept = (concept) => /^Nota de crédito #/i.test(String(concept || '').trim());
// --------------------------------------------
// Bootstrapping: asegurar tablas
// --------------------------------------------
async function ensureCashTables() {
  await runAsync('PRAGMA foreign_keys = ON');
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
    created_at TEXT NOT NULL
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
    created_at TEXT NOT NULL,
    date TEXT,
    FOREIGN KEY (session_id) REFERENCES cash_sessions(id)
  )
`);


}
ensureCashTables();
// --------------------------------------------
// Core queries
// --------------------------------------------
async function getSessionByDate(dateStr) {
  const date = toISODate(dateStr);
  return await getAsync(`SELECT * FROM cash_sessions WHERE date = ?`, [date]);
}

async function createSession({ date, opening_amount, carried_balance = 0 }) {
  const ds = toISODate(date);
  const createdAt = getCurrentARTimestamp();
  
  await runAsync(
    `INSERT INTO cash_sessions (date, opening_amount, carried_balance, closed, created_at)
    VALUES (?, ?, ?, 0, ?)`,
    [ds, Number(opening_amount || 0), Number(carried_balance || 0), createdAt]
  );

  return await getSessionByDate(ds);
}

async function getLastClosedSession() {
  return await getAsync(
    `SELECT * FROM cash_sessions WHERE closed = 1 ORDER BY date DESC LIMIT 1`
  );
}
async function getOpenSession() {
  // Devuelve la última sesión que no esté cerrada, sin depender del formato de fecha
  return await getAsync(
    `SELECT * FROM cash_sessions WHERE closed = 0 ORDER BY id DESC LIMIT 1`
  );
}
// --------------------------------------------
// API: apertura
// --------------------------------------------
const openCashSession = async (req, res) => {
  try {
    // 🕒 Usar la fecha enviada desde el front (si existe) o la fecha local Argentina
    const date =
      req.body.date && req.body.date.length === 10
        ? req.body.date
        : getCurrentARDate();

    // ⚠️ Prevenir duplicados o sesiones abiertas
    const alreadyOpen = await getOpenSession();
    if (alreadyOpen) {
      return res.status(409).json({
        error: `Ya existe una caja abierta (${alreadyOpen.date}). Cerrala antes de abrir una nueva.`
      });
    }

    const existing = await getSessionByDate(date);
    if (existing && existing.closed === 0) {
      return res.status(409).json({ error: "La caja del día ya está abierta." });
    }
    if (existing && existing.closed === 1) {
      return res.status(409).json({ error: "La caja del día ya fue cerrada." });
    }

    // 🧮 Calcular saldo transportado desde la última caja cerrada
    const last = await getLastClosedSession();
    const carried = last ? Number(last.closing_amount || 0) : 0;

    const opening = Number(req.body?.opening_amount ?? carried);

    const session = await createSession({
      date, // ✅ ahora 100% en horario argentino
      opening_amount: opening,
      carried_balance: carried
    });

    console.log(`✅ Caja abierta correctamente con fecha: ${date}`);
    return res.status(201).json({ message: "Caja abierta", session });
  } catch (err) {
    console.error("openCashSession:", err);
    return res.status(500).json({ error: "Error al abrir la caja" });
  }
};

// --------------------------------------------
// API: movimiento manual
// --------------------------------------------
const addCashMovement = async (req, res) => {
  try {
    const { type, concept, amount, payment_method } = req.body;
    const user_id = req.user?.id || null;

    if (!['ingreso', 'egreso'].includes(type)) {
      return res.status(422).json({ error: 'type debe ser ingreso o egreso' });
    }
    if (!concept || !amount) {
      return res.status(422).json({ error: 'concept y amount son obligatorios' });
    }

    const session = await getOpenSession();
    if (!session) {
      return res.status(409).json({ error: 'No hay caja abierta. Abra la caja para registrar movimientos.' });
    }

    // 🕒 Obtener la fecha exacta de la caja abierta, según timezone argentino
    const fechaCaja = session.date; // la fecha con la que se abrió la caja
    const fechaHoraAR = getCurrentARTimestamp(); // timestamp AR actual

    // Insertar movimiento usando la fecha de la caja (no la del sistema)
    await runAsync(
      `INSERT INTO cash_movements (session_id, type, concept, amount, payment_method, user_id, created_at, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, type, concept, Math.abs(Number(amount)), payment_method || null, user_id, fechaHoraAR, fechaCaja]
    );

    return res.status(201).json({ message: 'Movimiento registrado correctamente con fecha de la caja abierta' });
  } catch (err) {
    console.error('addCashMovement:', err);
    return res.status(500).json({ error: 'Error al registrar movimiento' });
  }
};

// --------------------------------------------
// Helpers públicos para ventas / devoluciones
// --------------------------------------------

async function recordSaleIncome({ total, sale_id, payment_method, user_id }) {
  const session = await getOpenSession();
  if (!session) {
    throw new Error(
      'No hay caja abierta hoy. Debe abrir caja antes de registrar ingresos de ventas.'
    );
  }

  const fechaAR = getCurrentARTimestamp();

  await runAsync(
    `INSERT INTO cash_movements (session_id, type, concept, amount, payment_method, user_id, created_at, date)
     VALUES (?, 'ingreso', ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      `Venta #${sale_id}`,
      Math.abs(Number(total)),
      payment_method || null,
      user_id || null,
      fechaAR,
      session.date,
    ]
  );
}

async function recordRefundExpense({ total, sale_id, refund_id, user_id }) {
  const session = await getOpenSession();
  if (!session) {
    throw new Error(
      'No hay caja abierta hoy. Debe abrir caja antes de registrar notas de crédito.'
    );
  }

  const fechaAR = getCurrentARTimestamp();

  await runAsync(
    `INSERT INTO cash_movements (session_id, type, concept, amount, payment_method, user_id, created_at, date)
     VALUES (?, 'egreso', ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      `Nota de crédito #${refund_id} (Venta #${sale_id})`,
      Math.abs(Number(total)),
      'efectivo',
      user_id || null,
      fechaAR,
      session.date,
    ]
  );
}

// --------------------------------------------
// API: cierre
// --------------------------------------------
const closeCashSession = async (req, res) => {
  try {
    const session = await getOpenSession();
    if (!session) {
      return res.status(404).json({ error: 'No hay caja abierta para cerrar.' });
    }

    const rows = await allAsync(
      `SELECT type, SUM(amount) as total FROM cash_movements WHERE session_id = ? GROUP BY type`,
      [session.id]
    );
    const income = Number((rows.find(r => r.type === 'ingreso')?.total) || 0);
    const expense = Number((rows.find(r => r.type === 'egreso')?.total) || 0);

    const closing = Number(session.opening_amount) + income - expense;

    const fechaCierreAR = getCurrentARTimestamp();

    await runAsync(
      `UPDATE cash_sessions
      SET total_income = ?, total_expense = ?, closing_amount = ?, carried_balance = ?, closed = 1, closed_at = ?
      WHERE id = ?`,      
      [income, expense, closing, closing, fechaCierreAR, session.id],
    );
    
    

    const closed = await getAsync(`SELECT * FROM cash_sessions WHERE id = ?`, [session.id]);
    session.closed_at = fechaCierreAR;
    return res.json({ message: 'Caja cerrada', session: closed });
  } catch (err) {
    console.error('closeCashSession:', err);
    return res.status(500).json({ error: 'Error al cerrar caja' });
  }
};

// --------------------------------------------
// API: sesión actual y pendientes
// --------------------------------------------
const getTodaySession = async (_req, res) => {
  try {
    // Si hay una sesión abierta (aunque sea de ayer), devolver esa
    const open = await getOpenSession();
    if (open) {
      return res.json({ date: toISODate(open.date), session: open });
    }

    // Si no hay abierta, devolver la de hoy (si existe)
    const date = getCurrentARDate();
    const s = await getSessionByDate(date);
    return res.json({ date, session: s || null });
  } catch (err) {
    console.error("getTodaySession:", err);
    return res.status(500).json({ error: "Error al obtener sesión" });
  }
};

const getPendingCloseWarning = async (_req, res) => {
  try {
    const today = getCurrentARDate();
    const yesterdayDate = new Date(`${today}T12:00:00`);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toISODate(yesterdayDate);
    const y = await getSessionByDate(yesterday);
    if (y && y.closed === 0) {
      return res.json({ pending: true, message: `Falta cerrar la caja del ${toLatinoDate(yesterday)}.` });
    }
    return res.json({ pending: false });
  } catch (err) {
    console.error('getPendingCloseWarning:', err);
    return res.status(500).json({ error: 'Error al verificar cierre pendiente' });
  }
};

// --------------------------------------------
// API: reporte (JSON / CSV / PDF)
// --------------------------------------------
function buildPeriodRange({ period, start_date, end_date }) {
  const now = new Date();
  const today = toISODate(now);
  if (!period || period === 'today') {
    return { start: today, end: today };
  }
  if (period === 'week') {
    const w = new Date(now);
    w.setDate(now.getDate() - 7);
    return { start: toISODate(w), end: today };
  }
  if (period === 'month') {
    const m = new Date(now);
    m.setMonth(now.getMonth() - 1);
    return { start: toISODate(m), end: today };
  }
  if (period === 'year') {
    const y = new Date(now);
    y.setFullYear(now.getFullYear() - 1);
    return { start: toISODate(y), end: today };
  }
  if (period === 'custom') {
    return { start: start_date, end: end_date };
  }
  return { start: today, end: today };
}

// ✅ Versión corregida de queryCashRange — soporta día, semana, mes, año y personalizados
// ✅ VERSIÓN CORREGIDA CON TZ ARG Y FILTRO FIJO DE FECHAS


async function queryCashRange({ start, end }) {
  const startDate = (start || getCurrentARDate()).slice(0, 10);
  const endDate = (end || getCurrentARDate()).slice(0, 10);

  // 🔹 Filtramos sin confiar en SQLite DATE(), sino por rango textual fijo
  const sessions = await allAsync(
    `SELECT *
     FROM cash_sessions
     WHERE date(date) BETWEEN ? AND ?
     ORDER BY date ASC`,
    [startDate, endDate]
  );

  const movements = await allAsync(
      `SELECT
        m.*,
        s.date
     FROM cash_movements m
     INNER JOIN cash_sessions s ON s.id = m.session_id
     WHERE date(s.date) BETWEEN ? AND ?
     ORDER BY s.date ASC, m.created_at ASC`,
    [startDate, endDate]
  );

  return { sessions, movements };
}

const getCashReport = async (req, res) => {
  try {
    const { period, start_date, end_date, format } = req.query;

    // 1) Rango de fechas
    const range = buildPeriodRange({ period, start_date, end_date });
    const { sessions, movements } = await queryCashRange(range);

    // 2) Ventas + Notas de crédito dentro del rango
    const sales = await allAsync(
      `
      SELECT 
        s.id,
        DATE(s.created_at) AS date,
        s.total AS amount,
        s.payment_method,
        'venta' AS type
      FROM sales s
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      
      UNION ALL
      
      SELECT 
        r.id,
        DATE(r.created_at) AS date,
        (r.total * -1) AS amount,
        'nota de crédito' AS payment_method,
        'nota_credito' AS type
      FROM refunds r
      WHERE DATE(r.created_at) BETWEEN ? AND ?
      
      ORDER BY date ASC
    `,
      [range.start, range.end, range.start, range.end]
    );

    // 3) Totales de movimientos por sesión (ingresos / egresos)
    const liveBySession = {};
    for (const m of movements) {
      const sid = m.session_id;
      if (!liveBySession[sid]) {
        liveBySession[sid] = { income: 0, expense: 0, refund: 0 };
      }

      if (m.type === "ingreso" && !isSaleMovementConcept(m.concept)) {
        liveBySession[sid].income += Number(m.amount || 0);
        continue;
      }

      if (m.type === "egreso" && isRefundMovementConcept(m.concept)) {
        liveBySession[sid].refund += Number(m.amount || 0);
        continue;
      }

      if (m.type === "egreso") {
        liveBySession[sid].expense += Number(m.amount || 0);
      }
    }

    // 4) Totales de ventas por día y método de pago
    const salesTotals = {};
    const refundsTotals = {};
    for (const s of sales) {
      const d = s.date.slice(0, 10);
      const metodo = (s.payment_method || "sin_especificar").toLowerCase();
      const amount = Number(s.amount || 0);

      if ((s.type || '').toLowerCase() === 'venta') {
        if (!salesTotals[d]) salesTotals[d] = { total: 0 };
        if (!salesTotals[d][metodo]) salesTotals[d][metodo] = 0;

        salesTotals[d][metodo] += amount;
        salesTotals[d].total += amount;
        continue;
      }

      if ((s.type || '').toLowerCase() === 'nota_credito') {
        refundsTotals[d] = (refundsTotals[d] || 0) + Math.abs(amount);
      }
    }

    // 5) Resumen por sesión (base contable)
    const summary = sessions.map((s) => {
      const live = liveBySession[s.id] || { income: 0, expense: 0, refund: 0 };

      const opening = Number(s.opening_amount || 0);
      const income = live.income;
      const refundsTotal = Number(refundsTotals[s.date] || live.refund || 0);
      const expense = Number(live.expense || 0) + refundsTotal;

      // Ventas de ese día (incluye total por método)
      const daySales = salesTotals[s.date] || {};
      const salesTotal = daySales.total || 0;

      // Cierre contable del día
      const closing = opening + income + salesTotal - expense;

      return {
        date: s.date,
        opening,
        income,
        expense,          // ingresos menos egresos reales (incluye comisiones + NC)
        salesTotal,
        salesByMethod: daySales,
        closing,
        total: closing,
      };
    });

    // 6) Formatos CSV / PDF (igual que antes)
    if (format === "csv") {
      const parser = new Parser({
        fields: [
          { label: "Fecha", value: (row) => toLatinoDate(row.date) },
          { label: "Apertura", value: "opening" },
          { label: "Ingresos", value: "income" },
          { label: "Egresos", value: "expense" },
          { label: "Cierre", value: "closing" },
        ],
      });
      const csv = parser.parse(summary);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=cash_${Date.now()}.csv`
      );
      return res.send(csv);
    }

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=cash_${Date.now()}.pdf`
      );
      doc.pipe(res);

      doc.fontSize(16).text("Reporte de Caja", { align: "center" });
      doc
        .fontSize(10)
        .text(
          `Período: ${toLatinoDate(range.start)} a ${toLatinoDate(range.end)}`,
          { align: "center" }
        );
      doc.moveDown();

      doc.fontSize(11).text("Resumen diario:", { underline: true });
      doc.moveDown(0.5);

      const headers = ["Fecha", "Apertura", "Ingresos", "Egresos", "Cierre"];
      const widths = [90, 90, 90, 90, 90];
      let x = doc.x;
      let y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: widths[i], align: "center" });
        x += widths[i];
      });
      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(9);

      summary.forEach((r) => {
        const row = [
          toLatinoDate(r.date),
          `$${r.opening.toFixed(2)}`,
          `$${r.income.toFixed(2)}`,
          `$${r.expense.toFixed(2)}`,
          `$${r.closing.toFixed(2)}`,
        ];
        let x0 = doc.x;
        const y0 = doc.y;
        row.forEach((txt, i) => {
          doc.text(String(txt), x0, y0, { width: widths[i], align: "center" });
          x0 += widths[i];
        });
        doc.moveDown(0.4);
      });

      doc.addPage();
      doc.fontSize(11).text("Movimientos:", { underline: true });
      doc.moveDown(0.5);
      movements.forEach((m) => {
        doc.text(
          `${toLatinoDate(m.date)} | ${m.type.toUpperCase()} | $${Number(
            m.amount
          ).toFixed(2)} | ${m.concept}${
            m.payment_method ? " | " + m.payment_method : ""
          }`
        );
      });

      doc.end();
      return;
    }

    // 7) Respuesta JSON por defecto (para React)
    return res.json({
      range,
      sessions: summary,
      summary,
      movements,
      sales,
      salesTotals,
      creditNotesTotal: Object.values(refundsTotals).reduce((acc, amount) => acc + Number(amount || 0), 0),
    });
  } catch (err) {
    console.error("getCashReport:", err);
    return res
      .status(500)
      .json({ error: "Error al generar reporte de caja" });
  }
};




module.exports = {
  openCashSession,
  addCashMovement,
  closeCashSession,
  getTodaySession,
  getPendingCloseWarning,
  getCashReport,
  recordSaleIncome,
  recordRefundExpense,
  ensureCashTables,
};
