const fs = require("fs");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const { db } = require("../config/database");

// ===================== Helpers =====================

// Genera un SKU incremental tipo PROD-0001
const generateNextSku = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT sku FROM products ORDER BY id DESC LIMIT 1", (err, row) => {
      if (err) return reject(err);
      if (!row || !row.sku) return resolve("PROD-0001");
      const m = row.sku.match(/PROD-(\d+)/);
      const num = m ? parseInt(m[1], 10) + 1 : 1;
      resolve(`PROD-${String(num).padStart(4, "0")}`);
    });
  });
};

// Inserta producto en BD
const insertProduct = (p) => {
  return new Promise((resolve, reject) => {
    const q = `INSERT INTO products
      (sku, ean13, name, category, description, purchase_price, sale_price, stock, min_stock, supplier, expiration_date, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(
      q,
      [
        p.sku,
        p.ean13 || null,
        p.name,
        p.category || "General",
        p.description || null,
        p.purchase_price || 0,
        p.sale_price || 0,
        p.stock || 0,
        p.min_stock || 10,
        p.supplier || null,
        p.expiration_date || null,
        p.active !== undefined ? (p.active ? 1 : 0) : 1,
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

// Verifica si ya existe un producto duplicado
const existsDuplicate = (sku, name) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id FROM products WHERE sku = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?))",
      [sku, name],
      (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
};

// Normaliza valores numéricos con formato latino o símbolos
const normalizeNumber = (val) => {
  if (val == null || val === "") return 0;
  let clean = String(val)
    .replace(/[^\d,.\-]/g, "")
    .trim();
  if (clean.includes(".") && clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};


// Normaliza formatos de fecha a ISO (YYYY-MM-DD)
const normalizeDate = (val) => {
  if (!val) return null;
  const clean = String(val).trim().replace(/[.\-]/g, "/");
  const parts = clean.split("/");
  if (parts.length === 3) {
    let [a, b, c] = parts.map((p) => p.padStart(2, "0"));
    if (a.length === 4) return `${a}-${b}-${c}`; // yyyy/mm/dd
    if (c.length === 4) {
      const year = c;
      const dayFirst = parseInt(a) > 12;
      return dayFirst ? `${year}-${b}-${a}` : `${year}-${a}-${b}`;
    }
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed)) return parsed.toISOString().split("T")[0];
  return null;
};

// Detecta el separador del CSV
const detectSeparator = (firstLine) => {
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
};

// Limpia encabezados (quita BOM, espacios, tildes y los pone en minúsculas)
const normalizeHeader = (str) => {
  if (!str) return "";
  return str
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
};

// ===================== IMPORTACIÓN CSV =====================
exports.importCsv = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: "No se envió archivo CSV." });

    filePath = req.file.path;
    const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
    const firstLine = fs.readFileSync(filePath, "utf8").split("\n")[0];
    const separator = detectSeparator(firstLine);

    const rows = [];
    fs.createReadStream(filePath, { encoding: "utf8" })
      .pipe(csv({ separator, skipEmptyLines: true, trim: true }))
      .on("data", (data) => {
        const cleanData = {};
        for (const key in data) {
          const cleanKey = normalizeHeader(key);
          cleanData[cleanKey] = data[key] ? data[key].trim() : "";
        }
        rows.push(cleanData);
      })
      .on("end", async () => {
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
            results.push({ row: i + 1, status: "skipped", reason: "Nombre vacío" });
            continue;
          }

          // Normalizar valores
          p.purchase_price = normalizeNumber(p.purchase_price);
          p.sale_price = normalizeNumber(p.sale_price);
          p.stock = Math.round(normalizeNumber(p.stock));
          p.min_stock = p.min_stock ? Math.round(normalizeNumber(p.min_stock)) : 10;

          // Normalizar fecha
          if (p.expiration_date) {
            const original = p.expiration_date;
            p.expiration_date = normalizeDate(p.expiration_date);
            if (!p.expiration_date) {
              console.warn(`⚠️  Fila ${i + 1}: formato de fecha inválido (${original})`);
            }
          }

          // Generar SKU
          if (!p.sku || !p.sku.trim()) {
            if (!skuCounter) {
              const next = await generateNextSku();
              const m = next.match(/PROD-(\d+)/);
              skuCounter = m ? parseInt(m[1], 10) : 1;
            }
            p.sku = `PROD-${String(skuCounter).padStart(4, "0")}`;
            skuCounter++;
          }

          // Verificar duplicados
          const dup = await existsDuplicate(p.sku, p.name);
          if (dup) {
            results.push({ row: i + 1, status: "skipped", reason: "Duplicado" });
            continue;
          }

          try {
            await insertProduct(p);
            totalInserted++;
            results.push({ row: i + 1, status: "inserted", sku: p.sku, name: p.name });
          } catch (err) {
            results.push({ row: i + 1, status: "error", reason: err.message });
          }
        }

        try { fs.unlinkSync(filePath); } catch {}
        res.json({
          message: "Importación finalizada",
          total: rows.length,
          inserted: totalInserted,
          details: results,
        });
      })
      .on("error", (err) => {
        if (filePath) try { fs.unlinkSync(filePath); } catch {}
        res.status(500).json({ error: "Error al procesar CSV", details: err.message });
      });
  } catch (err) {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
    res.status(500).json({ error: "Error interno", details: err.message });
  }
};

// ===================== ACTUALIZAR PRECIOS (CSV o EXCEL) =====================
exports.updatePricesMatched = async (req, res) => {
  let filePath = null;
  try {
    // 1) Parsear mapping (viene como string en multipart/form-data)
    const rawMapping = req.body?.mapping;
    const mappingInput = typeof rawMapping === "string" ? JSON.parse(rawMapping) : (rawMapping || {});
    // 2) Normalizar los valores del mapping para que coincidan con las keys normalizadas de las filas
    const mapping = {};
    for (const k of ["sku", "ean13", "purchase_price", "sale_price"]) {
      mapping[k] = mappingInput[k] ? normalizeHeader(mappingInput[k]) : "";
    }

    if (!req.file) return res.status(400).json({ error: "No se envió archivo." });

    filePath = req.file.path;
    const originalName = req.file.originalname || "";
    const ext = originalName.split(".").pop().toLowerCase();

    // 3) Leer filas desde XLSX o CSV (con fallback)
    let rows = [];

    const readXlsx = () => {
      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames?.[0];
      if (!sheetName) return [];
      const js = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
      return js.map((r) => {
        const cleaned = {};
        for (const key in r) cleaned[normalizeHeader(key)] = (r[key] ?? "").toString().trim();
        return cleaned;
      });
    };

    const readCsv = async () => {
      const firstLine = fs.readFileSync(filePath, "utf8").split("\n")[0];
      const separator = detectSeparator(firstLine);
      const out = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath, { encoding: "utf8" })
          .pipe(csv({ separator, skipEmptyLines: true, trim: true }))
          .on("data", (data) => {
            const cleaned = {};
            for (const key in data) cleaned[normalizeHeader(key)] = (data[key] ?? "").toString().trim();
            out.push(cleaned);
          })
          .on("end", resolve)
          .on("error", reject);
      });
      return out;
    };

    if (ext === "xlsx" || ext === "xls") {
      rows = readXlsx();
      // Fallback por si el archivo tiene extensión xlsx pero en realidad es csv
      if (!rows || rows.length === 0) rows = await readCsv();
    } else {
      rows = await readCsv();
      // Fallback por si subieron un Excel con extensión incorrecta
      if (!rows || rows.length === 0) rows = readXlsx();
    }

    // LOG de depuración (dejalo mientras probás)
    console.log("Archivo:", originalName, "ext:", ext, "filas leídas:", rows.length);
    if (rows[0]) console.log("Primer fila normalizada:", rows[0]);
    console.log("Mapping (normalizado):", mapping);

    if (!rows || rows.length === 0) {
      try { fs.unlinkSync(filePath); } catch {}
      return res.status(400).json({ error: "No se pudieron leer filas del archivo." });
    }

    // 4) Procesar actualización
    let updated = 0, unchanged = 0, notFound = 0;
    const details = [];

    for (const row of rows) {
      // Tomar campos usando el mapping normalizado; si no existe, intentar por nombre genérico
      const sku   = (row[mapping.sku]   || row.sku   || row.codigo || "").trim();
      const ean13 = (row[mapping.ean13] || row.ean13 || row.ean_13 || "").trim();

      const rawPurchase = row[mapping.purchase_price] || row.purchase_price || row.precio_compra || "";
      const rawSale     = row[mapping.sale_price]     || row.sale_price     || row.precio_venta  || "";

      const purchase_price = normalizeNumber(String(rawPurchase).replace(/[^\d,.\-]/g, "").trim());
      const sale_price     = normalizeNumber(String(rawSale).replace(/[^\d,.\-]/g, "").trim());

      // Debug por fila (mantenelo mientras probás)
      console.log("Procesando:", { sku, ean13, rawPurchase, rawSale, purchase_price, sale_price });

      if (!sku && !ean13) {
        details.push({ producto: "(sin código)", estado: "❌ Sin SKU/EAN" });
        continue;
      }

      // Buscar producto por SKU o EAN13
      const product = await new Promise((resolve) => {
        db.get(
          `SELECT id, sku, ean13, purchase_price, sale_price FROM products 
           WHERE sku = ? OR ean13 = ? LIMIT 1`,
          [sku, ean13],
          (err, row) => resolve(row || null)
        );
      });

      if (!product) {
        notFound++;
        details.push({ producto: sku || ean13, estado: "❌ No encontrado" });
        continue;
      }

      // Si no vino precio nuevo, conservar el actual (no forzar a 0)
      const newPurchase = purchase_price > 0 ? purchase_price : product.purchase_price;
      const newSale     = sale_price     > 0 ? sale_price     : product.sale_price;

      const samePrices =
        Math.abs(newPurchase - product.purchase_price) < 0.01 &&
        Math.abs(newSale     - product.sale_price)     < 0.01;

      if (samePrices) {
        unchanged++;
        details.push({ producto: product.sku, estado: "⚠️ Sin cambios" });
        continue;
      }

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE products 
             SET purchase_price = ?, sale_price = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [newPurchase, newSale, product.id],
          (err) => (err ? reject(err) : resolve())
        );
      });

      updated++;
      details.push({ producto: product.sku, estado: "✅ Actualizado" });
    }

    try { fs.unlinkSync(filePath); } catch {}
    res.json({
      message: "Actualización completada",
      total: rows.length,
      updated,
      unchanged,
      notFound,
      details,
    });
  } catch (err) {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
    console.error("Error en updatePricesMatched:", err);
    res.status(500).json({ error: "Error interno", details: err.message });
  }
};


// ===================== PREVISUALIZAR CSV o EXCEL =====================
exports.previewCsv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se envió archivo." });

    const filePath = req.file.path;
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    let columns = [], preview = [];

    if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      if (sheet.length > 0) {
        columns = Object.keys(sheet[0]).map(normalizeHeader);
        preview = sheet.slice(0, 5).map((r) => {
          const clean = {};
          for (const k in r) clean[normalizeHeader(k)] = r[k];
          return clean;
        });
      }
    } else {
      const firstLine = fs.readFileSync(filePath, "utf8").split("\n")[0];
      const separator = detectSeparator(firstLine);
      const rows = [];
      const headers = new Set();

      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv({ separator }))
          .on("headers", (h) => h.forEach((x) => headers.add(normalizeHeader(x))))
          .on("data", (row) => {
            if (rows.length < 5) {
              const clean = {};
              for (const k in row) clean[normalizeHeader(k)] = row[k];
              rows.push(clean);
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });

      columns = Array.from(headers);
      preview = rows;
    }

    try { fs.unlinkSync(filePath); } catch {}
    res.json({ columns, preview });
  } catch (err) {
    console.error("Error en previewCsv:", err);
    res.status(500).json({ error: "Error al leer archivo", details: err.message });
  }
};
