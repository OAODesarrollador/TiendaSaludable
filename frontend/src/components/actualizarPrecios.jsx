import React, { useState } from "react";
import { updatePricesMatched } from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export default function ActualizarPrecios() {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [dataPreview, setDataPreview] = useState([]);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setMessage(null);

    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${API_URL}/import/preview`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Error al procesar archivo");

      setColumns(result.columns || []);
      setDataPreview(result.preview || []);
    } catch (err) {
      setMessage({ type: "danger", text: err.message });
    }
  };

  const handleMappingChange = (dbField, csvField) => {
    setMapping({ ...mapping, [dbField]: csvField });
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: "danger", text: "Debe seleccionar un archivo." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping));

    setLoading(true);
    setMessage({ type: "info", text: "Procesando actualización..." });
    setResult(null);

    try {
      const res = await updatePricesMatched(formData);
      setResult(res);
      setMessage({ type: "success", text: res.message });
    } catch (err) {
      setMessage({ type: "danger", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2>💲 Actualizar Precios</h2>
      <p>Seleccione un archivo (CSV o Excel) para actualizar precios existentes.</p>

      <div className="card p-3 shadow-sm">
        <input
          type="file"
          accept=".csv,.xlsx"
          className="form-control mb-3"
          onChange={handleFileChange}
        />

        {columns.length > 0 && (
          <>
            <h5>🧩 Asignar columnas</h5>
            <div className="row">
              {["sku", "ean13", "purchase_price", "sale_price"].map((field) => (
                <div className="col-md-6 mb-3" key={field}>
                  <label className="form-label text-capitalize">
                    {field.replace("_", " ")}
                  </label>
                  <select
                    className="form-select"
                    value={mapping[field] || ""}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                  >
                    <option value="">-- Seleccionar columna --</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <h6 className="mt-3">👀 Vista previa:</h6>
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table className="table table-sm table-bordered">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataPreview.map((row, i) => (
                    <tr key={i}>
                      {columns.map((col) => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="btn btn-success mt-3"
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Actualizar precios"}
            </button>
          </>
        )}

        {message && (
          <div className={`alert alert-${message.type} mt-3`} role="alert">
            {message.text}
          </div>
        )}

        {result && (
          <div className="mt-4">
            <h5>📊 Resultados:</h5>
            <ul>
              <li>✅ Actualizados: {result.updated}</li>
              <li>⚠️ Sin cambios: {result.unchanged}</li>
              <li>❌ No encontrados: {result.notFound}</li>
              <li>Total procesados: {result.total}</li>
            </ul>
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {result.details.map((d, i) => (
                  <tr key={i}>
                    <td>{d.producto}</td>
                    <td>{d.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
