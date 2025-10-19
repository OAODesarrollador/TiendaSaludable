// backend/controllers/import.controller.js
const fs = require('fs');
const csv = require('csv-parser');
const { db } = require('../config/database');

// Genera un SKU incremental tipo PROD-0001
const generateNextSku = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT sku FROM products ORDER BY id DESC LIMIT 1", (err, row) => {
      if (err) return reject(err);
      if (!row || !row.sku) return resolve('PROD-0001');
      const m = row.sku.match(/PROD-(\d+)/);
      const num = m ? parseInt(m[1], 10) + 1 : 1;
      resolve(`PROD-${String(num).padStart(4, '0')}`);
    });
  });
};

// Inserta producto en BD
const insertProduct = (p) => {
  return new Promise((resolve, reject) => {
    const q = `INSERT INTO products
      (sku, ean13, name, category, description, purchase_price, sale_price, stock, min_stock, supplier, expiration_date, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(q, [
      p.sku,
      p.ean13 || null,
      p.name,
      p.category || 'General',
      p.description || null,
      p.purchase_price || 0,
      p.sale_price || 0,
      p.stock || 0,
      p.min_stock || 10,
      p.supplier || null,
      p.expiration_date || null,
      p.active !== undefined ? (p.active ? 1 : 0) : 1
    ], function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
};

// Verifica si ya existe un producto duplicado (por nombre o SKU)
const existsDuplicate = (sku, name) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM products WHERE sku = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))', [sku, name], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
};

// Normaliza valores numéricos con formato latino o símbolos
const normalizeNumber = (val) => {
  if (val == null || val === '') return 0;
  let clean = String(val)
    .replace(/[^\d,.\-]/g, '') // quita $, espacios, letras
    .trim();
  // Si tiene tanto punto como coma, asumimos formato latino (13.270,17)
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Detecta el separador del CSV
const detectSeparator = (firstLine) => {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
};

exports.importCsv = async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió archivo CSV.' });
    }

    filePath = req.file.path;
    
    console.log('📁 Archivo recibido:', filePath);
    console.log('📍 req.file completo:', req.file);

    // ✅ VERIFICAR QUE EL ARCHIVO EXISTE
    if (!fs.existsSync(filePath)) {
      console.error('❌ El archivo no existe en:', filePath);
      return res.status(500).json({ 
        error: 'El archivo no se guardó correctamente en el servidor',
        path: filePath 
      });
    }

    // ✅ VERIFICAR PERMISOS DE LECTURA
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log('✅ Archivo accesible para lectura');
    } catch (err) {
      console.error('❌ No hay permisos de lectura:', err);
      return res.status(500).json({ 
        error: 'No se puede leer el archivo (permisos)',
        details: err.message 
      });
    }

    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    console.log('🗺️  Mapeo recibido:', mapping);

    // Detectar separador leyendo la primera línea
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
    const separator = detectSeparator(firstLine);
    console.log(`🔍 Separador detectado: "${separator}"`);

    const rows = [];

    // Crear stream con encoding UTF-8
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({ 
        separator: separator,
        skipEmptyLines: true,
        trim: true
      }))
      .on('data', (data) => {
        // Limpiar BOM y espacios en blanco de las keys
        const cleanData = {};
        for (const key in data) {
          const cleanKey = key.replace(/^\uFEFF/, '').trim();
          cleanData[cleanKey] = data[key] ? data[key].trim() : '';
        }
        
        // DEBUG: Mostrar primera fila para verificar headers
        if (rows.length === 0) {
          console.log('🔍 DEBUG - Headers detectados en CSV:', Object.keys(cleanData));
          console.log('🔍 DEBUG - Primera fila de datos:', cleanData);
          console.log('🔍 DEBUG - Mapeo recibido del frontend:', mapping);
        }
        
        rows.push(cleanData);
      })
      .on('end', async () => {
        console.log(`📊 Total de filas leídas: ${rows.length}`);
        
        const results = [];
        let skuCounter = null;
        let totalInserted = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const p = {};

          // Aplicar mapeo
          for (const csvCol in mapping) {
            const dbField = mapping[csvCol];
            if (dbField && row[csvCol] !== undefined) {
              p[dbField] = row[csvCol];
            }
          }

          console.log(`\n📦 Fila ${i + 1}:`, p);

          // Validar nombre obligatorio
          if (!p.name || !p.name.trim()) {
            results.push({ row: i + 1, status: 'skipped', reason: 'Nombre vacío' });
            console.log(`⏭️  Fila ${i + 1}: Saltada (nombre vacío)`);
            continue;
          }

          // Normalizar números
          p.purchase_price = normalizeNumber(p.purchase_price);
          p.sale_price = normalizeNumber(p.sale_price);
          p.stock = Math.round(normalizeNumber(p.stock));
          p.min_stock = p.min_stock ? Math.round(normalizeNumber(p.min_stock)) : 10;

          // Generar SKU si no existe
          if (!p.sku || !p.sku.trim()) {
            if (!skuCounter) {
              const next = await generateNextSku();
              const m = next.match(/PROD-(\d+)/);
              skuCounter = m ? parseInt(m[1], 10) : 1;
            }
            p.sku = `PROD-${String(skuCounter).padStart(4, '0')}`;
            skuCounter++;
          }

          // Verificar duplicados
          const dup = await existsDuplicate(p.sku, p.name);
          if (dup) {
            results.push({ row: i + 1, status: 'skipped', reason: 'Duplicado (sku o name)' });
            console.log(`⏭️  Fila ${i + 1}: Saltada (duplicado)`);
            continue;
          }

          // Insertar producto
          try {
            await insertProduct(p);
            totalInserted++;
            results.push({ row: i + 1, status: 'inserted', sku: p.sku, name: p.name });
            console.log(`✅ Fila ${i + 1}: Insertado - ${p.name} (${p.sku})`);
          } catch (err) {
            results.push({ row: i + 1, status: 'error', reason: err.message });
            console.error(`❌ Fila ${i + 1}: Error -`, err.message);
          }
        }

        // Eliminar archivo temporal
        try {
          fs.unlinkSync(filePath);
          console.log('🗑️  Archivo temporal eliminado');
        } catch (e) {
          console.error('⚠️  No se pudo eliminar archivo temporal:', e.message);
        }

        console.log(`\n✅ Importación finalizada: ${totalInserted}/${rows.length} productos insertados`);

        res.json({
          message: 'Importación finalizada',
          total: rows.length,
          inserted: totalInserted,
          details: results
        });
      })
      .on('error', (err) => {
        console.error('❌ Error al leer CSV:', err);
        // Limpiar archivo en caso de error
        if (filePath) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
        res.status(500).json({ error: 'Error al procesar CSV', details: err.message });
      });

  } catch (err) {
    console.error('❌ Error en importación:', err);
    // Limpiar archivo en caso de error
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
};