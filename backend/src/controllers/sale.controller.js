const { db, runAsync, getAsync, allAsync } = require('../config/database');
const PDFDocument = require('pdfkit');

// Crear nueva venta (procesar ticket)
const createSale = async (req, res) => {
  try {
    const { items, payment_method = 'efectivo' } = req.body;
    const userId = req.user.id;
    
    // Validaciones
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay productos en la venta' });
    }
    
    // Iniciar transacción
    await runAsync('BEGIN TRANSACTION');
    
    try {
      let subtotal = 0;
      const saleItems = [];
      
      // Verificar stock y calcular totales
      for (const item of items) {
        const product = await getAsync(
          'SELECT id, name, sale_price, stock FROM products WHERE id = ? AND active = 1',
          [item.product_id]
        );
        
        if (!product) {
          await runAsync('ROLLBACK');
          return res.status(400).json({ 
            error: `Producto ID ${item.product_id} no encontrado` 
          });
        }
        
        if (product.stock < item.quantity) {
          await runAsync('ROLLBACK');
          return res.status(400).json({ 
            error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` 
          });
        }
        
        const itemSubtotal = product.sale_price * item.quantity;
        subtotal += itemSubtotal;
        
        saleItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.sale_price,
          subtotal: itemSubtotal
        });
        
        // Descontar del stock
        await runAsync(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, product.id]
        );
      }
      
      // Calcular impuestos y total
      const taxRate = parseFloat(process.env.IVA_RATE || 21) / 100;
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      // Insertar venta
      const saleResult = await runAsync(
        'INSERT INTO sales (user_id, subtotal, tax, total, payment_method) VALUES (?, ?, ?, ?, ?)',
        [userId, subtotal, tax, total, payment_method]
      );
      
      const saleId = saleResult.id;
      
      // Insertar items de la venta
      for (const item of saleItems) {
        await runAsync(
          `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [saleId, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal]
        );
      }
      
      await runAsync('COMMIT');
      
      // Obtener venta completa con items
      const sale = await getAsync('SELECT * FROM sales WHERE id = ?', [saleId]);
      const saleItemsFromDb = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
      
      res.status(201).json({
        message: 'Venta procesada exitosamente',
        sale: { ...sale, items: saleItemsFromDb }
      });
    } catch (error) {
      await runAsync('ROLLBACK');
      console.error('Error en transacción de venta:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error creando venta:', error);
    res.status(500).json({ error: 'Error al procesar la venta' });
  }
};

// Obtener todas las ventas
const getAllSales = async (req, res) => {
  try {
    const { start_date, end_date, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT s.*, u.full_name as seller_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (start_date) {
      sql += ' AND DATE(s.created_at) >= DATE(?)';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(s.created_at) <= DATE(?)';
      params.push(end_date);
    }
    
    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const sales = await allAsync(sql, params);
    
    // Obtener items para cada venta
    for (const sale of sales) {
      sale.items = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    }
    
    res.json(sales);
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
};

// Obtener venta por ID
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await getAsync(`
      SELECT s.*, u.full_name as seller_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE s.id = ?
    `, [id]);
    
    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    sale.items = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    
    res.json(sale);
  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
};

// Generar PDF del ticket
const generateTicketPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await getAsync(`
      SELECT s.*, u.full_name as seller_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE s.id = ?
    `, [id]);
    
    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const items = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    
    // Crear PDF
    const doc = new PDFDocument({ size: [226.77, 841.89], margin: 20 }); // Ancho 80mm (ticket térmico)
    
    // Headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket_${id}.pdf`);
    
    doc.pipe(res);
    
    // Encabezado
    doc.fontSize(16).text('🌿 Tienda Natural', { align: 'center' });
    doc.fontSize(10).text('Productos Naturales y Dietéticos', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);
    
    // Información de la venta
    doc.fontSize(9).text(`Ticket #${sale.id}`, { align: 'left' });
    doc.fontSize(8).text(`Fecha: ${new Date(sale.created_at).toLocaleString('es-AR')}`, { align: 'left' });
    doc.text(`Vendedor: ${sale.seller_name}`, { align: 'left' });
    doc.text(`Pago: ${sale.payment_method.toUpperCase()}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);
    
    // Items
    doc.fontSize(8);
    items.forEach(item => {
      doc.text(item.product_name, { continued: false });
      doc.text(
        `  ${item.quantity} x $${item.unit_price.toFixed(2)} = $${item.subtotal.toFixed(2)}`,
        { align: 'left' }
      );
      doc.moveDown(0.3);
    });
    
    doc.moveDown(0.5);
    doc.text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);
    
    // Totales
    doc.fontSize(9);
    doc.text(`Subtotal: $${sale.subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`IVA (${process.env.IVA_RATE}%): $${sale.tax.toFixed(2)}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(11).text(`TOTAL: $${sale.total.toFixed(2)}`, { align: 'right', bold: true });
    
    doc.moveDown(1);
    doc.fontSize(8).text('¡Gracias por su compra!', { align: 'center' });
    doc.text('Vuelva pronto', { align: 'center' });
    
    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: 'Error al generar ticket PDF' });
  }
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  generateTicketPDF
};