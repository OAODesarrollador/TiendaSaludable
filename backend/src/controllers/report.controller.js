// ============================================
// REPORT CONTROLLER (report.controller.js)
// ============================================

const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const { allAsync } = require('../config/database'); // mantiene tu helper existente

// ========================= Helpers de fecha =========================
const normalizePeriod = (p) => (p ?? '').toString().trim().toLowerCase();

const toISODate = (d) => {
  if (!d) return null;
  if (typeof d === 'string') {
    // aceptar 'YYYY-MM-DD', 'YYYY/MM/DD' o 'DD-MM-YYYY'
    const s = d.trim();
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(s)) {
      return s.replace(/\//g, '-').slice(0, 10);
    }
    // dd-mm-aaaa
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.replace(/\//g, '-').split('-');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const toLatinoDate = (d) => {
  if (!d) return '';
  // si viene 'YYYY-MM-DD' como texto, no generes invalid Date
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y}`;
  }
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
};

// ========================= Builders de consultas =========================
// Ventas: arma SQL + params según req.query
function buildSalesQuery(query) {
  const { period, start_date, end_date, category, product_id } = query;
  const p = normalizePeriod(period || 'month');

  const now = new Date();
  const today = toISODate(now);
  let dateCondition = '';
  const params = [];

  if (p === 'today') {
    dateCondition = 'AND DATE(s.created_at) = DATE(?)';
    params.push(today);
  } else if (p === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    dateCondition = 'AND s.created_at >= ?';
    params.push(weekAgo.toISOString());
  } else if (p === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);
    dateCondition = 'AND s.created_at >= ?';
    params.push(monthAgo.toISOString());
  } else if (p === 'year') {
    const yearAgo = new Date(now);
    yearAgo.setFullYear(now.getFullYear() - 1);
    dateCondition = 'AND s.created_at >= ?';
    params.push(yearAgo.toISOString());
  } else if (p === 'custom') {
    const s = toISODate(start_date);
    const e = toISODate(end_date);
    if (!s || !e) {
      const err = new Error('Debe especificar start_date y end_date en formato YYYY-MM-DD.');
      err.status = 422;
      throw err;
    }
    dateCondition = 'AND DATE(s.created_at) BETWEEN DATE(?) AND DATE(?)';
    params.push(s, e);
  } else {
    const err = new Error('Período inválido o no soportado.');
    err.status = 400;
    throw err;
  }

  let sql = `
    SELECT 
      s.id as sale_id,
      s.created_at,
      s.subtotal,
      s.tax,
      s.total,
      s.payment_method,
      si.product_id,
      si.product_name,
      si.quantity,
      si.unit_price,
      si.subtotal as item_subtotal,
      p.category
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
    WHERE 1=1 ${dateCondition}
  `;

  if (category) {
    sql += ' AND p.category = ?';
    params.push(category);
  }
  if (product_id) {
    sql += ' AND si.product_id = ?';
    params.push(product_id);
  }
  sql += ' ORDER BY s.created_at DESC';

  return { sql, params, period: p };
}

// ===== Libro mayor: Ventas + Notas de Crédito =====
function buildLedgerQuery(query) {
  const { period, start_date, end_date, category, product_id } = query;
  const normalized = (period || 'month').toLowerCase();

  // --- SQL para Ventas ---
    // --- SQL para Ventas ---
  const salesSql = `
    SELECT
      s.id             AS doc_id,
      s.id             AS sale_id,
      s.created_at     AS created_at,
      'SALE'           AS entry_type,
      si.product_id    AS product_id,
      si.product_name  AS product_name,
      si.quantity      AS quantity,
      si.unit_price    AS unit_price,
      si.subtotal      AS item_subtotal,
      /* 👇 descuento por renglón: bruto - neto */
      ((si.quantity * si.unit_price) - si.subtotal) AS item_discount_amount,
      p.category       AS category,
      s.payment_method AS payment_method,

      /* ✅ Total real del ticket (suma de subtotales con descuento) */
      (
        SELECT SUM(subtotal)
        FROM sale_items sx
        WHERE sx.sale_id = s.id
      ) AS doc_total,

      s.tax AS doc_tax
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
  `;

  // --- SQL para Notas de Crédito ---
  const refundsSql = `
    SELECT
      r.id             AS doc_id,
      r.sale_id        AS sale_id,
      r.created_at     AS created_at,
      'REFUND'         AS entry_type,
      ri.product_id    AS product_id,
      ri.product_name  AS product_name,

      /* Reverso contable: cantidades e importes en negativo */
      (ri.quantity * -1) AS quantity,
      ri.unit_price       AS unit_price,
      (ri.subtotal * -1)  AS item_subtotal,

      /* Descuento por renglón (bruto - neto) en negativo */
      (((ri.quantity * ri.unit_price) - ri.subtotal) * -1) AS item_discount_amount,

      p.category       AS category,

      /* Método de pago heredado de la venta original */
      s.payment_method AS payment_method,

      /* ✅ Total real negativo (suma de subtotales con descuento) */
      (
        SELECT SUM(subtotal) * -1
        FROM refund_items rx
        WHERE rx.refund_id = r.id
      ) AS doc_total,

      (r.tax * -1) AS doc_tax
    FROM refunds r
    INNER JOIN refund_items ri ON r.id = ri.refund_id
    LEFT JOIN products p ON ri.product_id = p.id
    LEFT JOIN sales s ON s.id = r.sale_id
  `;


  // --- Condiciones de fecha ---

const { sql: ssql, params: sparams } = buildSalesQuery({
  period,
  start_date,
  end_date,
  category,
  product_id
});

// 1) Extraer el fragmento entre WHERE … y ORDER BY de forma segura
const upper = ssql.toUpperCase();
const wIdx = upper.indexOf('WHERE');
const oIdx = upper.indexOf('ORDER BY');

let fragment = '';
if (wIdx !== -1) {
  fragment = ssql.substring(
    wIdx + 5,                       // salteamos la palabra WHERE (5)
    oIdx !== -1 ? oIdx : ssql.length
  );
}

// 2) Quitar un posible "1=1" inicial y normalizar espacios
fragment = fragment
  .replace(/^\s*1\s*=\s*1\s*/i, '') // fuera "1=1" sobrante
  .replace(/\s+/g, ' ')             // espacios a uno solo
  .trim();

// 3) Generar versiones por alias:
//    - Ventas usan s. y si.
//    - Notas usan r. y ri.
const whereSales   = fragment;                         // s., si., p.
const whereRefunds = fragment
  .replace(/\bs\./g,  'r.')
  .replace(/\bsi\./g, 'ri.');                          // p. se mantiene

// 4) SQL final sin dobles "1=1" y con alias correctos
const sql = `
  ${salesSql}
  WHERE 1=1 ${whereSales}
  UNION ALL
  ${refundsSql}
  WHERE 1=1 ${whereRefunds}
  ORDER BY created_at DESC
`;

// 5) Los placeholders (?) se duplican porque aplicamos los mismos filtros a ambas subconsultas
const params = [...sparams, ...sparams];

return { sql, params, period: normalized };
};

// Vencimientos: arma SQL + params según req.query
function buildExpiringQuery(query) {
  const period = normalizePeriod(query.period);
  let { start_date, end_date } = query;

  if (!period) {
    const err = new Error('Debe especificar un período.');
    err.status = 400;
    throw err;
  }

  start_date = toISODate(start_date);
  end_date = toISODate(end_date);

  const now = new Date();
  const today = toISODate(now);
  const params = [];
  let condition = '';

  if (period === 'today') {
    condition = 'substr(p.expiration_date,1,10) = ?';
    params.push(today);
  } else if (period === 'tomorrow') {
    const t = new Date(now);
    t.setDate(now.getDate() + 1);
    condition = 'substr(p.expiration_date,1,10) = ?';
    params.push(toISODate(t));
  } else if (period === 'week') {
    const w = new Date(now);
    w.setDate(now.getDate() + 7);
    condition = 'substr(p.expiration_date,1,10) BETWEEN ? AND ?';
    params.push(today, toISODate(w));
  } else if (period === 'month') {
    const firstDay = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastDay = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    condition = 'substr(p.expiration_date,1,10) BETWEEN ? AND ?';
    params.push(firstDay, lastDay);
  } else if (period === 'custom') {
    if (!start_date || !end_date) {
      const err = new Error('Debe enviar start_date y end_date en formato YYYY-MM-DD.');
      err.status = 422;
      throw err;
    }
    if (start_date > end_date) [start_date, end_date] = [end_date, start_date];
    condition = 'substr(p.expiration_date,1,10) BETWEEN ? AND ?';
    params.push(start_date, end_date);
  } else {
    const err = new Error('Período inválido o no soportado.');
    err.status = 400;
    throw err;
  }

  const sql = `
    SELECT p.id, p.sku, p.ean13, p.name, p.category, p.stock, p.min_stock, p.expiration_date
    FROM products p
    WHERE p.expiration_date IS NOT NULL
      AND ${condition}
    ORDER BY p.expiration_date ASC
  `;
  return { sql, params, period };
}

// ========================= Controladores: Ventas =========================
const getSalesReport = async (req, res) => {
  try {
    const { sql, params, period } = buildLedgerQuery(req.query);
    const data = await allAsync(sql, params);

    // Asientos individuales
    const ledger = data.map(r => ({
      ...r,
      debit: r.item_subtotal < 0 ? Math.abs(r.item_subtotal) : 0,
      credit: r.item_subtotal > 0 ? r.item_subtotal : 0
    }));

    // Totales y agrupadores
    const stats = {
      total_transactions: 0,
      total_items: 0,
      net_revenue: 0,
      total_debit: 0,
      total_credit: 0,
      avg_ticket: 0,
      by_category: {},
      by_product: {},
      by_payment_method: {},
      // ✅ Totales con IVA
      total_credit_gross: 0,
      total_debit_gross: 0,
      net_revenue_gross: 0
    };

    const seenDocs = new Set();

    ledger.forEach(row => {
      // --- Totales netos ---
      stats.total_items += row.quantity || 0;
      stats.net_revenue += row.item_subtotal || 0;
      stats.total_debit += row.debit || 0;
      stats.total_credit += row.credit || 0;

      // --- Agrupaciones ---
      const cat = row.category || 'Sin categoría';
      stats.by_category[cat] = stats.by_category[cat] || { revenue: 0, units: 0 };
      stats.by_category[cat].revenue += row.item_subtotal || 0;
      stats.by_category[cat].units += row.quantity || 0;

      const prod = row.product_name || 'Producto';
      stats.by_product[prod] = stats.by_product[prod] || { revenue: 0, units: 0 };
      stats.by_product[prod].revenue += row.item_subtotal || 0;
      stats.by_product[prod].units += row.quantity || 0;

      stats.by_payment_method[row.payment_method] =
        (stats.by_payment_method[row.payment_method] || 0) + (row.item_subtotal || 0);

      // --- Totales con IVA (solo una vez por documento) ---
      const key = `${row.entry_type}#${row.doc_id}`;
      if (!seenDocs.has(key)) {
        seenDocs.add(key);
        const gross = Number(row.doc_total || 0);
        if (gross < 0) stats.total_debit_gross += Math.abs(gross);
        else stats.total_credit_gross += gross;
        stats.net_revenue_gross += gross;
      }
    });

    stats.total_transactions = seenDocs.size;
    stats.avg_ticket = stats.total_transactions > 0 ? stats.net_revenue / stats.total_transactions : 0;

    return res.json({ data: ledger, stats, period });
  } catch (error) {
    console.error('Error generando reporte de ventas:', error);
    res.status(500).json({ error: error.message });
  }
};



// Exportar ventas CSV
const exportToCSV = async (req, res) => {
  try {
    const { sql, params } = buildLedgerQuery(req.query);
    const rows = await allAsync(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'No hay datos para exportar.' });
    }

    const shaped = rows.map(r => ({
      tipo: r.entry_type === 'REFUND' ? 'NOTA DE CRÉDITO' : 'VENTA',
      fecha: toLatinoDate(r.created_at),
      id_venta: r.sale_id,
      id_doc: r.doc_id,
      producto: r.product_name,
      categoria: r.category || 'Sin categoría',
      cantidad: r.quantity,                      // con signo
      precio_unitario: r.unit_price,
      importe: r.item_subtotal,                  // con signo
      debe: r.item_subtotal < 0 ? Math.abs(r.item_subtotal) : 0,
      haber: r.item_subtotal > 0 ? r.item_subtotal : 0,
      metodo_pago: r.payment_method
    }));

    const fields = [
      { label: 'Tipo', value: 'tipo' },
      { label: 'Fecha', value: 'fecha' },
      { label: 'ID Venta', value: 'id_venta' },
      { label: 'ID Documento', value: 'id_doc' },
      { label: 'Producto', value: 'producto' },
      { label: 'Categoría', value: 'categoria' },
      { label: 'Cantidad', value: 'cantidad' },
      { label: 'Precio Unitario', value: 'precio_unitario' },
      { label: 'Importe', value: 'importe' },
      { label: 'Debe', value: 'debe' },
      { label: 'Haber', value: 'haber' },
      { label: 'Método de Pago', value: 'metodo_pago' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(shaped);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exportando CSV de ventas:', error);
    const code = error.status || 500;
    return res.status(code).json({ error: error.message || 'Error al exportar CSV de ventas' });
  }
};

// Exportar ventas PDF
const exportToPDF = async (req, res) => {
  try {
    const { sql, params, period } = buildLedgerQuery(req.query);
    const rows = await allAsync(sql, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'No hay datos para exportar.' });
    }

    // Calculamos totales igual que en frontend
    const toNumber = (v) => (v == null ? 0 : Number(v) || 0);
    const sum = (arr, pick) => arr.reduce((acc, r) => acc + toNumber(pick(r)), 0);
    const totalDebe = sum(rows, r => r.item_subtotal < 0 ? Math.abs(r.item_subtotal) : 0);
    const totalHaber = sum(rows, r => r.item_subtotal > 0 ? r.item_subtotal : 0);
    const totalDescuento = sum(rows, r => Math.abs(r.item_discount_amount || 0));
    const totalFinal = totalHaber - totalDebe - totalDescuento;

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=reporte_ventas_${Date.now()}.pdf`);

    doc.pipe(res);

    // --- ENCABEZADO ---
    doc.fontSize(18).text(' Reporte de Ventas - Libro Mayor', { align: 'center' });
    const periodoLabel = (req.query.period === 'custom')
      ? `${toLatinoDate(req.query.start_date)} a ${toLatinoDate(req.query.end_date)}`
      : (req.query.period || period);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Período: ${periodoLabel}`, { align: 'center' });
    doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });
    doc.moveDown();

    // --- CABECERA DE TABLA ---
    const headers = ['Fecha', 'Tipo', 'Producto', 'Cant.', 'P. Unit.', 'Imp.c/desc.', 'Desc.', 'Debe', 'Haber'];
    const colWidths = [50, 40, 120, 40, 50, 55, 45, 45, 45];
    const startX = doc.x;
    const startY = doc.y;

    doc.font('Helvetica-Bold').fontSize(9);
    headers.forEach((h, i) => {
      doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, { width: colWidths[i], align: 'left' });
    });
    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(8);

    // --- FILAS ---
// --- FILAS (una línea por asiento, columnas alineadas) ---
// --- FILAS: una sola línea por asiento ---
rows.forEach((r) => {
  const tipo = r.entry_type === 'REFUND' ? 'NC' : 'VTA';
  const fila = [
    toLatinoDate(r.created_at),
    tipo,
    r.product_name,
    r.quantity,
    `$${Number(r.unit_price).toFixed(2)}`,
    `$${Number(r.item_subtotal).toFixed(2)}`,
    `$${Math.abs(Number(r.item_discount_amount || 0)).toFixed(2)}`,
    r.item_subtotal < 0 ? `$${Math.abs(r.item_subtotal).toFixed(2)}` : '-',
    r.item_subtotal > 0 ? `$${r.item_subtotal.toFixed(2)}` : '-'
  ];

  const y = doc.y; // fila base
  let x = startX;

  fila.forEach((texto, i) => {
    doc.text(String(texto), x, y, {
      width: colWidths[i],
      align: 'center'
    });
    x += colWidths[i];
  });

  doc.moveDown(0.4); // espacio fijo entre filas
});




    // --- TOTALES ---
  // --- TOTALES ALINEADOS A LA DERECHA ---
doc.moveDown(1);
doc.font('Helvetica-Bold').fontSize(10);

const rightX = doc.page.width - doc.page.margins.right - 300; // posición fija
const valueX = rightX + 150; // columna derecha de los montos

const totales = [
  ['Total Debe (NC):', totalDebe],
  ['Total Haber (Ventas):', totalHaber],
  ['Total Descuentos:', totalDescuento],
  ['Total Final :', totalFinal]
];

totales.forEach(([label, val]) => {
  const y = doc.y;
  doc.text(label, rightX, y, { width: 180, align: 'right' });
  doc.text(`$${val.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
  doc.moveDown(0.3);
});

doc.end(); // 🚨 importantísimo: cierra el stream


  } catch (error) {
    console.error('Error exportando PDF de ventas:', error);
    const code = error.status || 500;
    return res.status(code).json({ error: error.message || 'Error al exportar PDF de ventas' });
  }
};


// ========================= Controladores: Vencimientos =========================
const getExpiringProductsReport = async (req, res) => {
  try {
    const { sql, params, period } = buildExpiringQuery(req.query);
    const data = await allAsync(sql, params);

    return res.status(200).json({
      period,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error obteniendo productos próximos a vencer:', error);
    const code = error.status || 500;
    return res.status(code).json({ error: error.message || 'Error al generar reporte de vencimientos' });
  }
};

// Exportar vencimientos CSV
const exportExpiringCSV = async (req, res) => {
  try {
    const { sql, params } = buildExpiringQuery(req.query);
    const rows = await allAsync(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'No se encontraron productos próximos a vencer.' });
    }

    const fields = [
      { label: 'SKU', value: 'sku' },
      { label: 'Nombre', value: 'name' },
      { label: 'Categoría', value: 'category' },
      { label: 'Stock', value: 'stock' },
      { label: 'Vencimiento', value: (r) => toLatinoDate(r.expiration_date) }
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_vencimientos_${Date.now()}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exportando CSV de vencimientos:', error);
    const code = error.status || 500;
    return res.status(code).json({ error: error.message || 'Error al exportar CSV de vencimientos' });
  }
};

// Exportar vencimientos PDF
const exportExpiringPDF = async (req, res) => {
  try {
    const { sql, params, period } = buildExpiringQuery(req.query);
    const rows = await allAsync(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'No se encontraron productos próximos a vencer.' });
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=reporte_ventas_${Date.now()}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text('Reporte de Productos por Vencer', { align: 'center' });
    const label =
      period === 'custom'
        ? `${toLatinoDate(req.query.start_date)} a ${toLatinoDate(req.query.end_date)}`
        : period;
    doc.fontSize(10).text(`Período: ${label}`, { align: 'center' });
    doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(11);
    rows.slice(0, 100).forEach((p) => {
      doc.text(`${p.sku || '-'} | ${p.name} | ${p.category || '-'} | Stock: ${p.stock ?? 0} | Vence: ${toLatinoDate(p.expiration_date)}`);
    });
    if (rows.length > 100) doc.text(`... y ${rows.length - 100} productos más`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error exportando PDF de vencimientos:', error);
    const code = error.status || 500;
    return res.status(code).json({ error: error.message || 'Error al exportar PDF de vencimientos' });
  }
};

// ========================= Exports =========================
module.exports = {
  // Ventas
  getSalesReport,
  exportToCSV,
  exportToPDF,

  // Vencimientos
  getExpiringProductsReport,
  exportExpiringCSV,
  exportExpiringPDF
};
