// ============================================
// DASHBOARD CONTROLLER (dashboard.controller.js)
// ============================================
const { allAsync } = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Ventas de hoy
    const todaySales = await allAsync(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM sales
      WHERE DATE(created_at) = DATE(?)
    `, [today.toISOString()]);
    
    // Ventas del mes
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthSales = await allAsync(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM sales
      WHERE created_at >= ?
    `, [firstDayOfMonth.toISOString()]);
    
    // Productos con stock bajo
    const lowStock = await allAsync(`
      SELECT COUNT(*) as count
      FROM products
      WHERE active = 1 AND stock <= min_stock
    `);
    
    // Total de productos activos
    const totalProducts = await allAsync(`
      SELECT COUNT(*) as count
      FROM products
      WHERE active = 1
    `);
    
    // Productos más vendidos (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Productos más vendidos (últimos 30 días)
// ============================================
// 📊 Top 15 productos más vendidos (últimos 30 días)
// ============================================
const topProducts = await allAsync(`
  SELECT 
    si.product_name,
    SUM(si.quantity) AS total_sold,
    SUM(si.subtotal) AS total_revenue
  FROM sale_items si
  INNER JOIN sales s ON si.sale_id = s.id
  WHERE DATE(s.created_at) >= DATE('now', '-30 day')
  GROUP BY si.product_id, si.product_name
  ORDER BY total_sold DESC
  LIMIT 15
`);


    
    // Ventas por categoría (últimos 30 días)
    const salesByCategory = await allAsync(`
      SELECT 
        p.category,
        COUNT(DISTINCT si.sale_id) as transactions,
        SUM(si.quantity) as units_sold,
        SUM(si.subtotal) as revenue
      FROM sale_items si
      INNER JOIN products p ON si.product_id = p.id
      INNER JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ?
      GROUP BY p.category
      ORDER BY revenue DESC
    `, [thirtyDaysAgo.toISOString()]);
    
    // Últimas ventas
    const recentSales = await allAsync(`
      SELECT 
        s.id,
        s.total,
        s.created_at,
        u.full_name as seller_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT 10
    `);

    // Ventas por método de pago (últimos 30 días)
const salesByPaymentMethod = await allAsync(`
  SELECT 
    payment_method,
    COUNT(*) AS count,
    SUM(total) AS total_revenue
  FROM sales
  WHERE DATE(created_at) >= DATE('now', '-30 day')
  GROUP BY payment_method
  ORDER BY total_revenue DESC
`);

    res.json({
      today: {
        sales: todaySales[0].count || 0,
        revenue: todaySales[0].revenue || 0
      },
      month: {
        sales: monthSales[0].count || 0,
        revenue: monthSales[0].revenue || 0
      },
      inventory: {
        total_products: totalProducts[0].count || 0,
        low_stock_count: lowStock[0].count || 0
      },
      top_products: topProducts,
      sales_by_category: salesByCategory,
      recent_sales: recentSales,
      sales_by_payment: salesByPaymentMethod
    });
  } catch (error) {
    console.error('Error obteniendo stats del dashboard:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// ============================================
// 📊 Ventas por período (línea de tiempo)
// ============================================
const getSalesTimeline = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Debe especificar fecha de inicio y fin' });
    }

    const sales = await allAsync(`
      SELECT 
        DATE(created_at) as date,
        SUM(total) as total_revenue,
        COUNT(*) as total_sales
      FROM sales
      WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [start_date, end_date]);

    res.json(sales);
  } catch (error) {
    console.error('Error obteniendo gráfico de ventas por período:', error);
    res.status(500).json({ error: 'Error al generar gráfico de ventas' });
  }
};

module.exports = { getDashboardStats, getSalesTimeline };