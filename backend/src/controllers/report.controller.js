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
    const { sql, params, period } = buildSalesQuery(req.query);
    const data = await allAsync(sql, params);

    const stats = {
      total_sales: 0,
      total_revenue: 0,
      total_items: 0,
      total_transactions: new Set(),
      avg_ticket: 0,
      by_category: {},
      by_product: {},
      by_payment_method: {}
    };

    data.forEach(row => {
      stats.total_sales += row.item_subtotal || 0;
      stats.total_items += row.quantity || 0;
      stats.total_transactions.add(row.sale_id);

      const cat = row.category || 'Sin categoría';
      stats.by_category[cat] = stats.by_category[cat] || { revenue: 0, units: 0 };
      stats.by_category[cat].revenue += row.item_subtotal || 0;
      stats.by_category[cat].units += row.quantity || 0;

      const prod = row.product_name || 'Producto';
      stats.by_product[prod] = stats.by_product[prod] || { revenue: 0, units: 0 };
      stats.by_product[prod].revenue += row.item_subtotal || 0;
      stats.by_product[prod].units += row.quantity || 0;

      stats.by_payment_method[row.payment_method] =
        (stats.by_payment_method[row.payment_method] || 0) + (row.total || 0);
    });

    stats.total_revenue = Array.from(stats.total_transactions).reduce((sum, saleId) => {
      const sale = data.find(d => d.sale_id === saleId);
      return sum + (sale ? sale.total || 0 : 0);
    }, 0);

    stats.total_transactions = stats.total_transactions.size;
    stats.avg_ticket = stats.total_transactions > 0 ? stats.total_revenue / stats.total_transactions : 0;

    return res.json({
      data,
      stats,
      period,
      filters: {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        category: req.query.category,
        product_id: req.query.product_id
      }
    });
  } catch (error) {
    console.error('Error generando reporte de ventas:', error);
    const code = error.status || 500;
    return res.status(code).json({ error: error.message || 'Error al generar reporte de ventas' });
  }
};

// Exportar ventas CSV
const exportToCSV = async (req, res) => {
  try {
    const { sql, params } = buildSalesQuery(req.query);
    const rows = await allAsync(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'No hay datos de ventas para exportar.' });
    }

    const fields = [
      { label: 'ID Venta', value: 'sale_id' },
      { label: 'Fecha', value: (r) => toLatinoDate(r.created_at) },
      { label: 'Producto', value: 'product_name' },
      { label: 'Categoría', value: 'category' },
      { label: 'Cantidad', value: 'quantity' },
      { label: 'Precio Unitario', value: 'unit_price' },
      { label: 'Subtotal', value: 'item_subtotal' },
      { label: 'Método de Pago', value: 'payment_method' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

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
    const { sql, params, period } = buildSalesQuery(req.query);
    const rows = await allAsync(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'No hay datos de ventas para exportar.' });
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${Date.now()}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('📊 Reporte de Ventas', { align: 'center' });
    const label =
      period === 'custom'
        ? `${toLatinoDate(req.query.start_date)} a ${toLatinoDate(req.query.end_date)}`
        : period;
    doc.fontSize(10).text(`Período: ${label}`, { align: 'center' });
    doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });
    doc.moveDown();

    rows.slice(0, 100).forEach((r) => {
      doc.fontSize(9).text(
        `${toLatinoDate(r.created_at)} | ${r.product_name} | Cant: ${r.quantity} | $${(r.item_subtotal || 0).toFixed(2)}`
      );
    });
    if (rows.length > 100) doc.text(`... y ${rows.length - 100} registros más`, { align: 'center' });

    doc.end();
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
    res.setHeader('Content-Disposition', `attachment; filename=reporte_vencimientos_${Date.now()}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('📅 Reporte de Productos por Vencer', { align: 'center' });
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
