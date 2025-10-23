// backend/controllers/import.controller.js
const fs = require('fs');
const csv = require('csv-parser');
const { db } = require('../config/database');

// ===================== Helpers =====================

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

// Verifica si ya existe un producto duplicado
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
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Normaliza formatos de fecha a ISO (YYYY-MM-DD)
const normalizeDate = (val) => {
  if (!val) return null;
  const clean = String(val).trim().replace(/[.\-]/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    let [a, b, c] = parts.map(p => p.padStart(2, '0'));
    if (a.length === 4) return `${a}-${b}-${c}`;          // yyyy/mm/dd
    if (c.length === 4) {
      const year = c;
      const dayFirst = parseInt(a) > 12;                  // heurística
      return dayFirst ? `${year}-${b}-${a}` : `${year}-${a}-${b}`;
    }
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  return null;
};

// Detecta el separador del CSV
const detectSeparator = (firstLine) => {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
};

// ===================== Importación principal =====================
exports.importCsv = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió archivo CSV.' });
    }

    filePath = req.file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: 'El archivo no se guardó correctamente.' });
    }

    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
    const separator = detectSeparator(firstLine);

    const rows = [];
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv({ separator, skipEmptyLines: true, trim: true }))
      .on('data', (data) => {
        const cleanData = {};
        for (const key in data) {
          const cleanKey = key.replace(/^\uFEFF/, '').trim();
          cleanData[cleanKey] = data[key] ? data[key].trim() : '';
        }
        rows.push(cleanData);
      })
      .on('end', async () => {
        let totalInserted = 0;
        const results = [];
        let skuCounter = null;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const p = {};

          for (const csvCol in mapping) {
            const dbField = mapping[csvCol];
            if (dbField && row[csvCol] !== undefined) {
              p[dbField] = row[csvCol];
            }
          }

          if (!p.name || !p.name.trim()) {
            results.push({ row: i + 1, status: 'skipped', reason: 'Nombre vacío' });
            continue;
          }

          // 🔹 Normalización de valores
          p.purchase_price = normalizeNumber(p.purchase_price);
          p.sale_price = normalizeNumber(p.sale_price);
          p.stock = Math.round(normalizeNumber(p.stock));
          p.min_stock = p.min_stock ? Math.round(normalizeNumber(p.min_stock)) : 10;

          // 🔹 Normalizar fecha de vencimiento
          if (p.expiration_date) {
            const original = p.expiration_date;
            p.expiration_date = normalizeDate(p.expiration_date);
            if (!p.expiration_date) {
              console.warn(`⚠️  Fila ${i + 1}: formato de fecha inválido (${original})`);
            }
          }

          // 🔹 Generar SKU si no existe
          if (!p.sku || !p.sku.trim()) {
            if (!skuCounter) {
              const next = await generateNextSku();
              const m = next.match(/PROD-(\d+)/);
              skuCounter = m ? parseInt(m[1], 10) : 1;
            }
            p.sku = `PROD-${String(skuCounter).padStart(4, '0')}`;
            skuCounter++;
          }

          // 🔹 Verificar duplicados
          const dup = await existsDuplicate(p.sku, p.name);
          if (dup) {
            results.push({ row: i + 1, status: 'skipped', reason: 'Duplicado (sku o name)' });
            continue;
          }

          try {
            await insertProduct(p);
            totalInserted++;
            results.push({ row: i + 1, status: 'inserted', sku: p.sku, name: p.name });
          } catch (err) {
            results.push({ row: i + 1, status: 'error', reason: err.message });
          }
        }

        // 🔹 Eliminar archivo temporal
        try { fs.unlinkSync(filePath); } catch {}

        res.json({
          message: 'Importación finalizada',
          total: rows.length,
          inserted: totalInserted,
          details: results
        });
      })
      .on('error', (err) => {
        if (filePath) try { fs.unlinkSync(filePath); } catch {}
        res.status(500).json({ error: 'Error al procesar CSV', details: err.message });
      });
  } catch (err) {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
    res.status(500).json({ error: 'Error interno', details: err.message });
  }
};
