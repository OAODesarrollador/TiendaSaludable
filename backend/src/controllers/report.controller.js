const { allAsync } = require('../config/database');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

// Obtener reporte de ventas
const getSalesReport = async (req, res) => {
  try {
    const { period, start_date, end_date, category, product_id } = req.query;
    
    let dateCondition = '';
    const params = [];
    
    // Filtro por período predefinido
    if (period) {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          dateCondition = 'AND DATE(s.created_at) = DATE(?)';
          params.push(startDate.toISOString());
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          dateCondition = 'AND s.created_at >= ?';
          params.push(startDate.toISOString());
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          dateCondition = 'AND s.created_at >= ?';
          params.push(startDate.toISOString());
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          dateCondition = 'AND s.created_at >= ?';
          params.push(startDate.toISOString());
          break;
      }
    }
    
    // Filtro por rango de fechas personalizado
    if (start_date && end_date) {
      dateCondition = 'AND DATE(s.created_at) BETWEEN DATE(?) AND DATE(?)';
      params.push(start_date, end_date);
    }
    
    // Query base
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
    
    // Filtro por categoría
    if (category) {
      sql += ' AND p.category = ?';
      params.push(category);
    }
    
    // Filtro por producto específico
    if (product_id) {
      sql += ' AND si.product_id = ?';
      params.push(product_id);
    }
    
    sql += ' ORDER BY s.created_at DESC';
    
    const data = await allAsync(sql, params);
    
    // Estadísticas agregadas
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
      stats.total_sales += row.item_subtotal;
      stats.total_items += row.quantity;
      stats.total_transactions.add(row.sale_id);
      
      // Por categoría
      if (!stats.by_category[row.category]) {
        stats.by_category[row.category] = { revenue: 0, units: 0 };
      }
      stats.by_category[row.category].revenue += row.item_subtotal;
      stats.by_category[row.category].units += row.quantity;
      
      // Por producto
      if (!stats.by_product[row.product_name]) {
        stats.by_product[row.product_name] = { revenue: 0, units: 0 };
      }
      stats.by_product[row.product_name].revenue += row.item_subtotal;
      stats.by_product[row.product_name].units += row.quantity;
      
      // Por método de pago
      if (!stats.by_payment_method[row.payment_method]) {
        stats.by_payment_method[row.payment_method] = 0;
      }
      stats.by_payment_method[row.payment_method] += row.total;
    });
    
    stats.total_revenue = Array.from(stats.total_transactions).reduce((sum, saleId) => {
      const sale = data.find(d => d.sale_id === saleId);
      return sum + (sale ? sale.total : 0);
    }, 0);
    
    stats.total_transactions = stats.total_transactions.size;
    stats.avg_ticket = stats.total_transactions > 0 ? stats.total_revenue / stats.total_transactions : 0;
    
    res.json({
      data,
      stats,
      period: period || 'custom',
      filters: { start_date, end_date, category, product_id }
    });
  } catch (error) {
    console.error('Error generando reporte:', error);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
};

// Exportar reporte a CSV
const exportToCSV = async (req, res) => {
  try {
    const { period, start_date, end_date, category } = req.query;
    
    // Reutilizar lógica del reporte
    const reportData = await getSalesReportData({ period, start_date, end_date, category });
    
    const fields = [
      { label: 'ID Venta', value: 'sale_id' },
      { label: 'Fecha', value: 'created_at' },
      { label: 'Producto', value: 'product_name' },
      { label: 'Categoría', value: 'category' },
      { label: 'Cantidad', value: 'quantity' },
      { label: 'Precio Unitario', value: 'unit_price' },
      { label: 'Subtotal', value: 'item_subtotal' },
      { label: 'Método Pago', value: 'payment_method' }
    ];
    
    const parser = new Parser({ fields });
    const csv = parser.parse(reportData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({ error: 'Error al exportar CSV' });
  }
};

// Exportar reporte a PDF
const exportToPDF = async (req, res) => {
  try {
    const { period, start_date, end_date } = req.query;
    
    const reportData = await getSalesReportData({ period, start_date, end_date });
    
    // Calcular totales
    const totalRevenue = reportData.reduce((sum, row) => sum + row.total, 0);
    const totalItems = reportData.reduce((sum, row) => sum + row.quantity, 0);
    
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${Date.now()}.pdf`);
    
    doc.pipe(res);
    
    // Título
    doc.fontSize(20).text('📊 Reporte de Ventas', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Período: ${period || `${start_date} - ${end_date}`}`, { align: 'center' });
    doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-AR')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Resumen
    doc.fontSize(14).text('Resumen', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total de ventas: ${reportData.length}`);
    doc.text(`Ingresos totales: $${totalRevenue.toFixed(2)}`);
    doc.text(`Unidades vendidas: ${totalItems}`);
    doc.moveDown(2);
    
    // Tabla (simplificada)
    doc.fontSize(12).text('Detalle de Ventas', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    
    reportData.slice(0, 30).forEach(row => {
      doc.text(`${new Date(row.created_at).toLocaleDateString()} - ${row.product_name}: $${row.item_subtotal.toFixed(2)}`);
    });
    
    if (reportData.length > 30) {
      doc.moveDown();
      doc.text(`... y ${reportData.length - 30} ventas más`);
    }
    
    doc.end();
  } catch (error) {
    console.error('Error exportando PDF:', error);
    res.status(500).json({ error: 'Error al exportar PDF' });
  }
};

// Función auxiliar para obtener datos del reporte
async function getSalesReportData(filters) {
  const { period, start_date, end_date, category } = filters;
  
  let dateCondition = '';
  const params = [];
  
  if (period) {
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        dateCondition = 'AND DATE(s.created_at) = DATE(?)';
        params.push(startDate.toISOString());
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        dateCondition = 'AND s.created_at >= ?';
        params.push(startDate.toISOString());
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        dateCondition = 'AND s.created_at >= ?';
        params.push(startDate.toISOString());
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        dateCondition = 'AND s.created_at >= ?';
        params.push(startDate.toISOString());
        break;
    }
  }
  
  if (start_date && end_date) {
    dateCondition = 'AND DATE(s.created_at) BETWEEN DATE(?) AND DATE(?)';
    params.push(start_date, end_date);
  }
  
  let sql = `
    SELECT 
      s.id as sale_id,
      s.created_at,
      s.total,
      si.product_name,
      si.quantity,
      si.unit_price,
      si.subtotal as item_subtotal,
      p.category,
      s.payment_method
    FROM sales s
    INNER JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
    WHERE 1=1 ${dateCondition}
  `;
  
  if (category) {
    sql += ' AND p.category = ?';
    params.push(category);
  }
  
  sql += ' ORDER BY s.created_at DESC';
  
  return await allAsync(sql, params);
}

module.exports = {
  getSalesReport,
  exportToCSV,
  exportToPDF
};