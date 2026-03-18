// ============================================
// SALE CONTROLLER (versión corregida con timezone fix)
// ============================================

const { db, runAsync, getAsync, allAsync } = require('../config/database');
const PDFDocument = require('pdfkit');

const { formatFechaHoraAR, getCurrentARTimestamp } = require('../config/timezoneB');
const {
  recordSaleIncome
} = require('./cash.controller');



// ============================================
// CREAR NUEVA VENTA
// ============================================
const createSale = async (req, res) => {
  try {
    const {
      items,
      payment_method = 'efectivo',
      order_discount = 0,
      order_discount_amount,
      order_discount_type = null,
      order_discount_value = 0
    } = req.body;
    
    const validPayments = ['efectivo', 'qr', 'qrmp', 'transferencia', 'debito', 'tarjeta_credito'];

    if (!validPayments.includes(payment_method)) {
      return res.status(400).json({ error: 'Método de pago no válido' });
    }

    const userId = req.user?.id || 1;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay productos en la venta' });
    }

    const openCashSession = await getAsync(
      `SELECT id, date FROM cash_sessions WHERE closed = 0 ORDER BY id DESC LIMIT 1`
    );

    if (!openCashSession) {
      return res.status(409).json({
        error: 'No hay caja abierta. Abra la caja antes de registrar una venta.'
      });
    }

    await runAsync('BEGIN TRANSACTION');

    try {
      let subtotal = 0;
      const saleItems = [];

      for (const item of items) {
        const product = await getAsync(
          'SELECT id, name, stock FROM products WHERE id = ? AND active = 1',
          [item.product_id]
        );

        if (!product) {
          await runAsync('ROLLBACK');
          return res.status(400).json({ error: `Producto ID ${item.product_id} no encontrado` });
        }

        if (product.stock < item.quantity) {
          await runAsync('ROLLBACK');
          return res.status(400).json({ error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` });
        }

        const unit_price = parseFloat(item.price) || 0;
        const qty = parseFloat(item.quantity) || 0;
        const discountType = item.discountType || 'percentage';
        const discountValue = parseFloat(item.discount) || 0;

        let discountAmount = 0;
        if (discountType === 'percentage') {
          discountAmount = (unit_price * qty * discountValue) / 100;
        } else if (discountType === 'fixed') {
          discountAmount = discountValue;
        }

        const itemSubtotal = (unit_price * qty) - discountAmount;
        subtotal += itemSubtotal;

        saleItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          unit_price,
          discount: discountValue,
          discount_type: discountType,
          subtotal: itemSubtotal
        });

        await runAsync('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, product.id]);
      }

      const requestedOrderDiscount = Number(
        order_discount_amount ?? order_discount ?? 0
      );
      const safeOrderDiscount = Math.max(
        0,
        Math.min(Number.isFinite(requestedOrderDiscount) ? requestedOrderDiscount : 0, subtotal)
      );

      const subtotalWithDiscounts = subtotal - safeOrderDiscount;
      const taxRate = parseFloat(process.env.IVA_RATE || 21) / 100;
      const totalNoTax = subtotalWithDiscounts / (1 + taxRate);
      const tax = subtotalWithDiscounts - totalNoTax;
      const total = totalNoTax + tax;
      const createdAt = getCurrentARTimestamp();
      console.log('🕒 Guardando venta con fecha:', createdAt);  
      const saleResult = await runAsync(
        `INSERT INTO sales (
          user_id,
          subtotal,
          tax,
          total,
          payment_method,
          created_at,
          order_discount_amount,
          order_discount_type,
          order_discount_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          totalNoTax,
          tax,
          total,
          payment_method,
          createdAt,
          safeOrderDiscount,
          safeOrderDiscount > 0 ? order_discount_type : null,
          safeOrderDiscount > 0 ? Number(order_discount_value || 0) : 0
        ]
      );

      const saleId = saleResult.id;

      for (const item of saleItems) {
        await runAsync(
          `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, discount_type, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            item.product_id,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.discount,
            item.discount_type,
            item.subtotal
          ]
        );
      }

      await recordSaleIncome({
        total,
        sale_id: saleId,
        payment_method,
        user_id: userId
      });


      await runAsync('COMMIT');

      const sale = await getAsync('SELECT * FROM sales WHERE id = ?', [saleId]);
      const saleItemsFromDb = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);

      // ✅ NO convertir a ISO - dejar fecha como viene de SQLite
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

    if (String(error.message || '').includes('No hay caja abierta')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Error al procesar la venta' });
  }
};

// ============================================
// OBTENER TODAS LAS VENTAS Y NOTAS DE CRÉDITO
// ============================================
const getAllSales = async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.query;

    const sales = await allAsync(
      `
      SELECT 
        s.id,
        s.created_at,
        u.full_name AS seller_name,
        s.subtotal,
        s.tax,
        s.total,
        s.payment_method,
        'Venta' AS type
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE DATE(s.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [start_date || '1900-01-01', end_date || '2100-12-31', parseInt(limit), parseInt(offset)]
    );

    const refunds = await allAsync(
      `
      SELECT 
        r.id,
        r.sale_id,
        r.created_at,
        u.full_name AS seller_name,
        (r.subtotal * -1) AS subtotal,
        (r.tax * -1) AS tax,
        (r.total * -1) AS total,
        'Nota de Crédito' AS payment_method,
        'Nota de Crédito' AS type
      FROM refunds r
      LEFT JOIN sales s ON r.sale_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE DATE(r.created_at) BETWEEN DATE(?) AND DATE(?)
      ORDER BY r.created_at DESC
      `,
      [start_date || '1900-01-01', end_date || '2100-12-31']
    );

    const combined = [...sales, ...refunds].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    for (const record of combined) {
      if (record.type === 'Venta') {
        record.items = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [record.id]);
      } else if (record.type === 'Nota de Crédito') {
        record.items = await allAsync(
          `SELECT * FROM refund_items WHERE refund_id = ? ORDER BY id ASC`,
          [record.id]
        );
      }
    }

    // ✅ NO convertir a ISO - dejar fechas como vienen de SQLite
    res.json(combined);
  } catch (error) {
    console.error('Error obteniendo ventas y notas de crédito unificadas:', error);
    res.status(500).json({ error: 'Error al obtener ventas y notas de crédito' });
  }
};

// ============================================
// OBTENER VENTA POR ID
// ============================================
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await getAsync(`
      SELECT s.*, u.full_name as seller_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE s.id = ?
    `, [id]);

    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    sale.items = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    const refunds = await allAsync(
      `SELECT * FROM refunds WHERE sale_id = ? ORDER BY created_at DESC`,
      [id]
    );
    for (const r of refunds) {
      r.items = await allAsync(
        `SELECT * FROM refund_items WHERE refund_id = ? ORDER BY id ASC`,
        [r.id]
      );
    }
    sale.refunds = refunds;

    // ✅ NO convertir a ISO
    res.json(sale);
  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
};

// ============================================
// CREAR NOTA DE CRÉDITO / DEVOLUCIÓN
// ============================================
// ============================================
// CREAR NOTA DE CRÉDITO / DEVOLUCIÓN (versión corregida con egreso en caja)
// ============================================
const createRefund = async (req, res) => {
  try {
    const { id: sale_id } = req.params;
    const { reason, items } = req.body;

    const sale = await getAsync('SELECT * FROM sales WHERE id = ?', [sale_id]);
    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    const existingRefund = await getAsync(
      'SELECT id FROM refunds WHERE sale_id = ? LIMIT 1',
      [sale_id]
    );
    if (existingRefund) {
      return res.status(400).json({
        error: `Esta venta ya tiene una Nota de Crédito registrada (ID: ${existingRefund.id}).`
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No hay productos para devolver' });
    }

    await runAsync('BEGIN TRANSACTION');
    try {
      let subtotal = 0;
      const refundItems = [];

      for (const item of items) {
        const saleItem = await getAsync(
          'SELECT * FROM sale_items WHERE sale_id = ? AND product_id = ?',
          [sale_id, item.product_id]
        );

        if (!saleItem) {
          await runAsync('ROLLBACK');
          return res.status(400).json({ error: `El producto ID ${item.product_id} no pertenece a esta venta` });
        }

        if (item.quantity > saleItem.quantity) {
          await runAsync('ROLLBACK');
          return res.status(400).json({
            error: `Cantidad inválida para ${saleItem.product_name}, máximo ${saleItem.quantity}`
          });
        }

        const effectiveUnitNet = saleItem.quantity > 0
          ? Number((saleItem.subtotal / saleItem.quantity).toFixed(2))
          : 0;

        const itemSubtotal = Number((effectiveUnitNet * item.quantity).toFixed(2));
        subtotal = Number((subtotal + itemSubtotal).toFixed(2));

        refundItems.push({
          product_id: saleItem.product_id,
          product_name: saleItem.product_name,
          quantity: item.quantity,
          unit_price: effectiveUnitNet,
          subtotal: itemSubtotal
        });

        // 🔹 Reponer stock
        await runAsync('UPDATE products SET stock = stock + ? WHERE id = ?', [
          item.quantity,
          saleItem.product_id
        ]);
      }

      const taxRate = parseFloat(process.env.IVA_RATE || 21) / 100;
      const total = subtotal;
      const subtotalNoTax = Number((total / (1 + taxRate)).toFixed(2));
      const tax = Number((total - subtotalNoTax).toFixed(2));
      const createdAt = getCurrentARTimestamp();

      // 🧾 Crear registro principal de nota de crédito
      const refundResult = await runAsync(
        `INSERT INTO refunds (sale_id, reason, subtotal, tax, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, reason || null, subtotalNoTax, tax, total, createdAt]
      );

      const refundId = refundResult.id;

      // 🧾 Insertar los ítems devueltos
      for (const item of refundItems) {
        await runAsync(
          `INSERT INTO refund_items (refund_id, product_id, product_name, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [refundId, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal]
        );
      }

      // ✅ Registrar automáticamente el egreso en caja
      try {
        const { recordRefundExpense } = require('./cash.controller');
        await recordRefundExpense({
          total,
          sale_id,
          refund_id: refundId,
          user_id: req.user?.id || null
        });
      } catch (err) {
        console.warn("⚠️ No se pudo registrar el egreso en caja:", err.message);
      }

      await runAsync('COMMIT');

      const refund = await getAsync('SELECT * FROM refunds WHERE id = ?', [refundId]);
      refund.items = await allAsync('SELECT * FROM refund_items WHERE refund_id = ?', [refundId]);

      res.status(201).json({
        message: 'Nota de crédito creada exitosamente y registrada en caja',
        refund
      });

    } catch (error) {
      await runAsync('ROLLBACK');
      console.error('Error en devolución:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error creando nota de crédito:', error);
    res.status(500).json({ error: 'Error al crear la nota de crédito' });
  }
};

// ============================================
// OBTENER TODAS LAS DEVOLUCIONES DE UNA VENTA
// ============================================
const getRefundsBySale = async (req, res) => {
  try {
    const { id } = req.params;
    const refunds = await allAsync('SELECT * FROM refunds WHERE sale_id = ?', [id]);
    for (const refund of refunds) {
      refund.items = await allAsync('SELECT * FROM refund_items WHERE refund_id = ?', [refund.id]);
    }

    // ✅ NO convertir a ISO
    res.json(refunds);
  } catch (error) {
    console.error('Error obteniendo devoluciones:', error);
    res.status(500).json({ error: 'Error al obtener devoluciones' });
  }
};

// ============================================
// VERIFICAR SI UNA VENTA YA TIENE NOTA DE CRÉDITO
// ============================================
const checkRefundExists = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await getAsync(
      'SELECT COUNT(*) AS total FROM refunds WHERE sale_id = ?',
      [id]
    );

    const exists = row && row.total && Number(row.total) > 0;

    if (exists) {
      const refund = await getAsync(
        'SELECT id, created_at FROM refunds WHERE sale_id = ? ORDER BY id DESC LIMIT 1',
        [id]
      );
      return res.status(200).json({ exists: true, refund });
    }

    return res.status(200).json({ exists: false });
  } catch (error) {
    console.error('Error verificando existencia de nota de crédito:', error);
    return res.status(500).json({
      exists: false,
      error: 'Error interno al verificar nota de crédito'
    });
  }
};

// ============================================
// OBTENER DETALLE DE UNA NOTA DE CRÉDITO POR ID
// ============================================
const getRefundById = async (req, res) => {
  try {
    const { refundId } = req.params;
    const refund = await getAsync('SELECT * FROM refunds WHERE id = ?', [refundId]);
    if (!refund) return res.status(404).json({ error: 'Nota de crédito no encontrada' });

    refund.items = await allAsync('SELECT * FROM refund_items WHERE refund_id = ?', [refundId]);

    // ✅ NO convertir a ISO
    res.json(refund);
  } catch (error) {
    console.error('Error obteniendo nota de crédito:', error);
    res.status(500).json({ error: 'Error al obtener nota de crédito' });
  }
};

// ============================================
// GENERAR PDF DE TICKET
// ============================================
const generateTicketPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await getAsync(`
      SELECT s.*, u.full_name as seller_name 
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id 
      WHERE s.id = ?
    `, [id]);
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    const items = await allAsync('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    const doc = new PDFDocument({ size: [226.77, 841.89], margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket_${id}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text('🌿 Tienda Natural', { align: 'center' });
    doc.fontSize(10).text('Productos Naturales y Dietéticos', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(9).text(`Ticket #${sale.id}`);
    doc.fontSize(8).text(`Fecha: ${formatFechaHoraAR(sale.created_at)}`);
    doc.text(`Vendedor: ${sale.seller_name}`);
    doc.text(`Pago: ${sale.payment_method.toUpperCase()}`);
    doc.moveDown(0.5);
    doc.text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(8);
    items.forEach(item => {
      doc.text(item.product_name);
      let line = `  ${item.quantity} x $${item.unit_price.toFixed(2)}`;
      if (item.discount > 0) line += ` (-${item.discount}${item.discount_type === 'percentage' ? '%' : ''})`;
      line += ` = $${item.subtotal.toFixed(2)}`;
      doc.text(line);
      doc.moveDown(0.3);
    });

    doc.moveDown(0.5);
    doc.text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9);
    if (Number(sale.order_discount_amount || 0) > 0) {
      const orderDiscountTypeLabel =
        sale.order_discount_type === 'percentage'
          ? `${Number(sale.order_discount_value || 0)}%`
          : `$${Number(sale.order_discount_value || 0).toFixed(2)}`;
      doc.text(`Descuento general: -$${Number(sale.order_discount_amount || 0).toFixed(2)} (${orderDiscountTypeLabel})`, { align: 'right' });
    }
    doc.text(`Subtotal: $${sale.subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`IVA (${process.env.IVA_RATE || 21}%): $${sale.tax.toFixed(2)}`, { align: 'right' });
    doc.fontSize(11).text(`TOTAL: $${sale.total.toFixed(2)}`, { align: 'right' });

    doc.moveDown(1);
    doc.fontSize(8).text('¡Gracias por su compra!', { align: 'center' });
    doc.text('Vuelva pronto', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: 'Error al generar ticket PDF' });
  }
};

// ============================================
// GENERAR PDF DE NOTA DE CRÉDITO
// ============================================
const generateRefundPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const refund = await getAsync(`
      SELECT r.*, s.id AS sale_ticket, u.full_name AS seller_name
      FROM refunds r
      LEFT JOIN sales s ON r.sale_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE r.id = ?
    `, [id]);

    if (!refund) return res.status(404).json({ error: 'Nota de crédito no encontrada' });

    const items = await allAsync(
      'SELECT * FROM refund_items WHERE refund_id = ? ORDER BY id ASC',
      [id]
    );

    const doc = new PDFDocument({ size: [226.77, 841.89], margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=nota_credito_${id}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).fillColor('red').text('🧾 NOTA DE CRÉDITO', { align: 'center' });
    doc.fillColor('black').fontSize(10).text('Tienda Natural', { align: 'center' });
    doc.text('Productos Naturales y Dietéticos', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(9).text(`Nota #${refund.id}`);
    doc.fontSize(8).text(`Fecha: ${formatFechaHoraAR(refund.created_at)}`);
    doc.text(`Vendedor: ${refund.seller_name}`);
    doc.text(`Ticket original: #${refund.sale_ticket}`);
    doc.moveDown(0.5);
    doc.text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(8);
    items.forEach(it => {
      doc.text(it.product_name);
      const line = `  ${it.quantity} x $${it.unit_price.toFixed(2)} = $${it.subtotal.toFixed(2)}`;
      doc.text(line);
      doc.moveDown(0.3);
    });

    doc.moveDown(0.5);
    doc.text('─'.repeat(38), { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(9);
    doc.text(`Subtotal: $${refund.subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`IVA (${process.env.IVA_RATE || 21}%): $${refund.tax.toFixed(2)}`, { align: 'right' });
    doc.fontSize(11).text(`TOTAL: $${refund.total.toFixed(2)}`, { align: 'right' });

    doc.moveDown(1);
    doc.fontSize(8).text('Documento generado automáticamente', { align: 'center' });
    doc.text('Referencia contable - No válida como factura', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generando PDF de nota de crédito:', error);
    res.status(500).json({ error: 'Error al generar PDF de nota de crédito' });
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  generateTicketPDF,
  generateRefundPDF,
  createRefund,
  getRefundsBySale,
  getRefundById,
  checkRefundExists
};
