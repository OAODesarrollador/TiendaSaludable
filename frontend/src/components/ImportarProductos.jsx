import React, { useState } from 'react';
import { importCsv } from '../services/api';

/**
 * Importer.jsx
 * Permite seleccionar un archivo CSV, visualizar las primeras filas,
 * mapear las columnas del CSV con los campos de la base de datos y enviarlo al backend.
 */
export default function Importer() {
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [message, setMessage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const dbFields = [
    'sku',
    'ean13',
    'name',
    'category',
    'description',
    'purchase_price',
    'sale_price',
    'stock',
    'min_stock',
    'supplier',
    'expiration_date',
    'active',
  ];

  // Detecta separador de columnas (, o ;) según la primera línea
  const detectSeparator = (line) => {
    const commas = (line.match(/,/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
  };

  const cleanText = (text) => {
    return text
      .replace(/^\uFEFF/, '') // BOM
      .replace(/[^\x00-\x7FÀ-ÿ]/g, '') // elimina caracteres no ASCII
      .trim();
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setHeaders([]);
        setPreviewRows([]);
        setMessage({ type: 'warning', text: 'El archivo CSV está vacío' });
        return;
      }

      // Detección automática de separador
      const sep = detectSeparator(lines[0]);
      const hdr = lines[0]
        .split(sep)
        .map((h) => cleanText(h.replace(/["']/g, '')))
        .filter((h) => h.length > 0);

      setHeaders(hdr);

      const rows = lines.slice(1, 6).map((line) => {
        const cells = line
          .split(sep)
          .map((c) => cleanText(c.replace(/["']/g, '')));
        const obj = {};
        hdr.forEach((h, i) => (obj[h] = cells[i] ?? ''));
        return obj;
      });

      setPreviewRows(rows);

      // Mapeo automático inteligente
      const initialMapping = {};
      hdr.forEach((h) => {
        const lowerH = h.toLowerCase().trim();
        
        // Intentar mapear automáticamente campos comunes
        if (lowerH === 'sku' || lowerH === 'código' || lowerH === 'codigo') {
          initialMapping[h] = 'sku';
        } else if (lowerH.includes('ean') || lowerH.includes('código de barras')) {
          initialMapping[h] = 'ean13';
        } else if (lowerH === 'nombre' || lowerH === 'name' || lowerH === 'producto') {
          initialMapping[h] = 'name';
        } else if (lowerH === 'categoría' || lowerH === 'categoria' || lowerH === 'category') {
          initialMapping[h] = 'category';
        } else if (lowerH.includes('descripción') || lowerH.includes('descripcion') || lowerH === 'description') {
          initialMapping[h] = 'description';
        } else if (lowerH.includes('precio compra') || lowerH.includes('costo') || lowerH === 'purchase_price') {
          initialMapping[h] = 'purchase_price';
        } else if (lowerH.includes('precio venta') || lowerH.includes('precio') || lowerH === 'sale_price') {
          initialMapping[h] = 'sale_price';
        } else if (lowerH === 'stock' || lowerH === 'existencia' || lowerH === 'cantidad') {
          initialMapping[h] = 'stock';
        } else if (lowerH.includes('stock mínimo') || lowerH.includes('min_stock')) {
          initialMapping[h] = 'min_stock';
        } else if (lowerH.includes('proveedor') || lowerH === 'supplier') {
          initialMapping[h] = 'supplier';
        } else if (lowerH === 'activo' || lowerH === 'active') {
          initialMapping[h] = 'active';
        } else {
          initialMapping[h] = '';
        }
      });

      setMapping(initialMapping);
      setMessage({ type: 'success', text: `Archivo cargado: ${hdr.length} columnas detectadas` });
    };

    reader.onerror = () => {
      setMessage({ type: 'danger', text: 'Error al leer el archivo' });
    };

    reader.readAsText(f, 'UTF-8');
  };

  const handleMapChange = (csvHeader, dbField) => {
    setMapping((prev) => ({ ...prev, [csvHeader]: dbField }));
  };

  const handleImport = async () => {
    if (!file) {
      return setMessage({ type: 'danger', text: 'Seleccione un archivo CSV.' });
    }

    const mappedValues = Object.values(mapping).filter(Boolean);
    if (!mappedValues.includes('name')) {
      return setMessage({ 
        type: 'danger', 
        text: 'Debe mapear al menos la columna "name" (nombre del producto).' 
      });
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    setMessage({ type: 'info', text: 'Importando productos... Por favor espere.' });
    setIsImporting(true);

    // dentro de handleImport (ya declarada async)
    try {
    const res = await importCsv(formData); // <-- AÑADIDO await

    // Si el servidor devolviera un error estructurado, puede venir en res.error
    if (!res || typeof res !== 'object') {
        throw new Error('Respuesta inválida del servidor');
    }

    const inserted = res.inserted || 0;
    const total = res.total || 0;
    const skipped = total - inserted;

    let messageText = `Importación completada: ${inserted} productos insertados`;
    if (skipped > 0) {
        messageText += `, ${skipped} omitidos (duplicados o errores)`;
    }

    setMessage({ type: 'success', text: messageText });

    console.log('📊 Resultado de importación:', res);
    if (res.details) {
        console.log('Detalles por fila:', res.details);
    }

    setTimeout(() => {
        setFile(null);
        setHeaders([]);
        setPreviewRows([]);
        setMapping({});
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
    }, 3000);

    } catch (error) {
    console.error('❌ Error en importación:', error);
    setMessage({
        type: 'danger',
        text: error.message || 'Error al importar. Verifique el formato del archivo.'
    });
    } finally {
    setIsImporting(false);
    }

  };

  return (
    <div className="card p-3">
      <h5>Importar CSV</h5>
      
      <div className="mb-3">
        <label className="form-label">Archivo CSV</label>
        <input
          type="file"
          className="form-control"
          accept=".csv,text/csv"
          onChange={handleFile}
          disabled={isImporting}
        />
        <small className="form-text text-muted">
          Formatos aceptados: CSV con separador de coma (,) o punto y coma (;)
        </small>
      </div>

      {headers.length > 0 && (
        <>
          <div className="mb-3">
            <h6>Mapeo de columnas</h6>
            <p className="small text-muted">
              Asigna cada columna del CSV a un campo de la base de datos. 
              <strong className="text-danger"> * El campo "name" es obligatorio.</strong>
            </p>
            <div className="row">
              {headers.map((h) => (
                <div key={h} className="col-md-4 mb-2">
                  <label className="form-label small">
                    <strong>{h}</strong>
                    {mapping[h] === 'name' && <span className="text-danger"> *</span>}
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={mapping[h] || ''}
                    onChange={(e) => handleMapChange(h, e.target.value)}
                    disabled={isImporting}
                  >
                    <option value="">-- Ignorar --</option>
                    {dbFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <h6>Previsualización (primeras 5 filas)</h6>
            <div style={{ maxHeight: 250, overflowY: 'auto', overflowX: 'auto' }}>
              <table className="table table-sm table-striped table-bordered">
                <thead className="table-light">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} style={{ minWidth: '120px' }}>
                        {h}
                        {mapping[h] && (
                          <div className="badge bg-primary mt-1" style={{ fontSize: '0.7rem' }}>
                            → {mapping[h]}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {headers.map((h) => (
                        <td key={h}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-end">
            <button 
              className="btn btn-success" 
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Importando...
                </>
              ) : (
                'Importar Productos'
              )}
            </button>
          </div>
        </>
      )}

      {message && (
        <div className={`alert alert-${message.type} mt-3 mb-0`} role="alert">
          {message.text}
        </div>
      )}
    </div>
  );
}