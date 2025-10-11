require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db, runAsync } = require('../config/database');
const { generateEAN13, generateBarcodeImage } = require('./ean13');
const path = require('path');

const seedDatabase = async () => {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  try {
    // 1. Crear usuarios de ejemplo
    console.log('👤 Creando usuarios...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const vendedorPassword = await bcrypt.hash('vendedor123', 10);

    await runAsync(`
      INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES
      ('admin', ?, 'Administrador', 'admin'),
      ('vendedor', ?, 'Juan Pérez', 'vendedor')
    `, [adminPassword, vendedorPassword]);

    console.log('✅ Usuarios creados');
    console.log('   - admin / admin123 (Administrador)');
    console.log('   - vendedor / vendedor123 (Vendedor)\n');

    // 2. Crear productos de ejemplo
    console.log('📦 Creando productos...');

    const categories = ['Frutos Secos', 'Dietéticos', 'Suplementos', 'Semillas', 'Harinas'];
    
    const products = [
      { name: 'Almendras Premium', category: 'Frutos Secos', purchase: 850, sale: 1200, stock: 50 },
      { name: 'Nueces de Castilla', category: 'Frutos Secos', purchase: 920, sale: 1350, stock: 35 },
      { name: 'Avellanas Tostadas', category: 'Frutos Secos', purchase: 780, sale: 1100, stock: 40 },
      { name: 'Mix Frutos Secos', category: 'Frutos Secos', purchase: 650, sale: 950, stock: 60 },
      { name: 'Pasas de Uva', category: 'Frutos Secos', purchase: 320, sale: 480, stock: 80 },
      
      { name: 'Stevia en Polvo 100g', category: 'Dietéticos', purchase: 450, sale: 650, stock: 45 },
      { name: 'Azúcar de Coco Orgánica', category: 'Dietéticos', purchase: 520, sale: 750, stock: 30 },
      { name: 'Chips de Banana Sin Azúcar', category: 'Dietéticos', purchase: 380, sale: 550, stock: 55 },
      { name: 'Barras de Cereal Light x6', category: 'Dietéticos', purchase: 290, sale: 420, stock: 70 },
      { name: 'Galletitas de Arroz', category: 'Dietéticos', purchase: 180, sale: 280, stock: 90 },
      
      { name: 'Proteína Whey 1kg', category: 'Suplementos', purchase: 4500, sale: 6200, stock: 15 },
      { name: 'Creatina Monohidrato 300g', category: 'Suplementos', purchase: 2100, sale: 2900, stock: 20 },
      { name: 'BCAA en Polvo 250g', category: 'Suplementos', purchase: 1800, sale: 2500, stock: 18 },
      { name: 'Multivitamínico x60 caps', category: 'Suplementos', purchase: 890, sale: 1250, stock: 40 },
      { name: 'Omega 3 x100 caps', category: 'Suplementos', purchase: 1200, sale: 1650, stock: 25 },
      
      { name: 'Semillas de Chía 500g', category: 'Semillas', purchase: 420, sale: 600, stock: 65 },
      { name: 'Semillas de Lino 500g', category: 'Semillas', purchase: 380, sale: 540, stock: 55 },
      { name: 'Semillas de Sésamo 500g', category: 'Semillas', purchase: 340, sale: 490, stock: 60 },
      { name: 'Semillas de Girasol 500g', category: 'Semillas', purchase: 310, sale: 450, stock: 70 },
      { name: 'Mix Semillas Nutritivas', category: 'Semillas', purchase: 450, sale: 650, stock: 45 },
      
      { name: 'Harina de Almendras 500g', category: 'Harinas', purchase: 680, sale: 950, stock: 30 },
      { name: 'Harina de Coco 500g', category: 'Harinas', purchase: 520, sale: 720, stock: 35 },
      { name: 'Harina Integral 1kg', category: 'Harinas', purchase: 280, sale: 400, stock: 100 },
      { name: 'Harina de Avena 1kg', category: 'Harinas', purchase: 320, sale: 460, stock: 85 },
      { name: 'Harina de Garbanzo 500g', category: 'Harinas', purchase: 380, sale: 550, stock: 40 }
    ];

    const barcodeDir = path.join(__dirname, '../../uploads/barcodes');

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const sku = `PROD-${String(i + 1).padStart(4, '0')}`;
      const ean13 = generateEAN13();

      await runAsync(`
        INSERT INTO products (
          sku, ean13, name, category, description, 
          purchase_price, sale_price, stock, min_stock, supplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sku,
        ean13,
        product.name,
        product.category,
        `${product.name} de alta calidad, origen controlado`,
        product.purchase,
        product.sale,
        product.stock,
        10,
        'Proveedor Natural SA'
      ]);

      // Generar imagen del código de barras
      const barcodePath = path.join(barcodeDir, `${ean13}.png`);
      generateBarcodeImage(ean13, barcodePath);

      console.log(`   ✓ ${product.name} (EAN: ${ean13})`);
    }

    console.log(`\n✅ ${products.length} productos creados con códigos EAN-13\n`);

    // 3. Crear ventas de ejemplo
    console.log('💰 Creando ventas de ejemplo...');

    const salesCount = 15;
    for (let i = 0; i < salesCount; i++) {
      // Fecha aleatoria en los últimos 30 días
      const daysAgo = Math.floor(Math.random() * 30);
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - daysAgo);

      // Subtotal aleatorio entre 500 y 5000
      const subtotal = Math.floor(Math.random() * 4500) + 500;
      const tax = subtotal * 0.21;
      const total = subtotal + tax;

      const result = await runAsync(`
        INSERT INTO sales (user_id, subtotal, tax, total, payment_method, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        Math.random() > 0.5 ? 1 : 2, // Admin o vendedor
        subtotal,
        tax,
        total,
        Math.random() > 0.3 ? 'efectivo' : 'tarjeta',
        saleDate.toISOString()
      ]);

      // Agregar 2-5 items por venta
      const itemsCount = Math.floor(Math.random() * 4) + 2;
      for (let j = 0; j < itemsCount; j++) {
        const productId = Math.floor(Math.random() * products.length) + 1;
        const quantity = Math.floor(Math.random() * 3) + 1;
        const unitPrice = products[productId - 1].sale;
        const itemSubtotal = unitPrice * quantity;

        await runAsync(`
          INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          result.id,
          productId,
          products[productId - 1].name,
          quantity,
          unitPrice,
          itemSubtotal
        ]);
      }
    }

    console.log(`✅ ${salesCount} ventas creadas\n`);

    console.log('🎉 ¡Seed completado exitosamente!\n');
    console.log('═══════════════════════════════════════');
    console.log('📊 RESUMEN:');
    console.log('   • 2 usuarios creados');
    console.log(`   • ${products.length} productos con EAN-13`);
    console.log(`   • ${salesCount} ventas de ejemplo`);
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error);
    process.exit(1);
  }
};

// Ejecutar seed
seedDatabase();