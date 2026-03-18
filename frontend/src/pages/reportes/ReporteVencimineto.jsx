import { useState, useEffect } from "react";
import { reportsAPI } from "../../services/api";
import { toast } from "react-toastify";
import { Download, FileText } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/reportes.css";

const ReporteVencimientos = () => {
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    period: "week",
    start_date: "",
    end_date: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    if (filters.period === "custom" && (!filters.start_date || !filters.end_date)) {
      toast.warning("Debe seleccionar fechas válidas");
      return;
    }

    setLoading(true);
    try {
      const res = await reportsAPI.getExpiringProducts(filters);
      setReportData(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Error generando reporte de vencimientos");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await reportsAPI.exportExpiringExcel(filters);
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_vencimientos_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel descargado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error exportando Excel");
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await reportsAPI.exportExpiringPDF(filters, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      toast.error("Error exportando PDF");
    }
  };

  const handleChange = (e) =>
    setFilters({ ...filters, [e.target.name]: e.target.value });

  return (
    <div className="container-fluid py-4">
      <h3 className="mb-3 fw-bold text-dark">📆 Reporte de Vencimientos</h3>

      {/* ===== FILTROS ===== */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <label className="form-label">Período</label>
          <select
            name="period"
            className="form-select"
            value={filters.period}
            onChange={handleChange}
          >
            <option value="today">Hoy</option>
            <option value="tomorrow">Mañana</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {filters.period === "custom" && (
          <>
            <div className="col-md-3">
              <label className="form-label">Desde</label>
              <input
                type="date"
                name="start_date"
                className="form-control"
                value={filters.start_date}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Hasta</label>
              <input
                type="date"
                name="end_date"
                className="form-control"
                value={filters.end_date}
                onChange={handleChange}
              />
            </div>
          </>
        )}

        <div className="col-md-3 d-flex align-items-end">
          <button
            onClick={generateReport}
            className="btn btn-primary w-100 fw-semibold"
          >
            {loading ? "Generando..." : "Generar"}
          </button>
        </div>
      </div>

      {reportData && (
        <>
          {/* ===== BOTONES DE EXPORTACIÓN ===== */}
          <div className="d-flex gap-3 mb-3">
            <button onClick={handleExportExcel} className="btn btn-success fw-semibold">
              <Download size={18} /> Excel
            </button>
            <button onClick={handleExportPDF} className="btn btn-danger fw-semibold">
              <FileText size={18} /> PDF
            </button>
          </div>

          {/* ===== TABLA ===== */}
          <div className="table-scroll mt-3">
            <table className="table table-bordered table-striped table-sticky table-header-green text-center">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Fecha de Vencimiento</th>
                  <th>Días Restantes</th>
                </tr>
              </thead>

              <tbody>
                {reportData.data.map((p) => {
                  const diasRestantes = Math.ceil(
                    (new Date(p.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr
                      key={p.id}
                      className={
                        diasRestantes <= 0
                          ? "table-danger"
                          : diasRestantes <= 7
                          ? "table-warning"
                          : "table-success"
                      }
                    >
                      <td>{p.sku}</td>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{p.stock}</td>
                      <td>{new Date(p.expiration_date).toLocaleDateString("es-AR")}</td>
                      <td>
                        {diasRestantes <= 0
                          ? "VENCIDO"
                          : `${diasRestantes} día${diasRestantes > 1 ? "s" : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ===== RESUMEN ===== */}
          <div className="mt-3 text-end">
            {(() => {
              const total = reportData.data.length;
              const proximos = reportData.data.filter(
                (p) =>
                  (new Date(p.expiration_date) - new Date()) /
                    (1000 * 60 * 60 * 24) <=
                  7 && (new Date(p.expiration_date) - new Date()) > 0
              ).length;
              const vencidos = reportData.data.filter(
                (p) => new Date(p.expiration_date) < new Date()
              ).length;

              return (
                <>
                  <p className="fw-bold mb-0 text-success">
                    Total Productos: {total}
                  </p>
                  <p className="fw-bold mb-0 text-warning">
                    Próximos a Vencer (≤ 7 días): {proximos}
                  </p>
                  <p className="fw-bold mb-0 text-danger">
                    Vencidos: {vencidos}
                  </p>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default ReporteVencimientos;
