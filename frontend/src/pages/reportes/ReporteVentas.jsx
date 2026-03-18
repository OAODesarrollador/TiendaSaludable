import { useState, useEffect } from "react";
import { reportsAPI, productsAPI } from "../../services/api";
import { toast } from "react-toastify";
import { Download, FileText } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/reportes.css";

const ReporteVentas = () => {
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    period: "month",
    start_date: "",
    end_date: "",
    category: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCategories();
    generateReport();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await productsAPI.getCategories();
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const generateReport = async () => {
    if (filters.period === "custom" && (!filters.start_date || !filters.end_date)) {
      toast.warning("Debe seleccionar fechas válidas");
      return;
    }
    setLoading(true);
    try {
      const params = { ...filters };
      const res = await reportsAPI.getSalesReport(params);
      setReportData(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Error al generar reporte");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await reportsAPI.exportExcel(filters);
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_ventas_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar Excel");
    }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams(filters);
      const res = await reportsAPI.exportPDF(params, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo abrir PDF");
    }
  };

  const handleChange = (e) =>
    setFilters({ ...filters, [e.target.name]: e.target.value });

  const toNumber = (v) => (isNaN(Number(v)) ? 0 : Number(v));
  const grossAmount = (r) => toNumber(r.quantity) * toNumber(r.unit_price);
  const sum = (rows, pick) => (rows || []).reduce((a, r) => a + toNumber(pick(r)), 0);

  return (
    <div className="container-fluid py-4">
      <h3 className="mb-3 fw-bold text-dark">📘 Reporte de Ventas</h3>

      {/* Filtros */}
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
            <option value="week">Última Semana</option>
            <option value="month">Último Mes</option>
            <option value="year">Último Año</option>
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

        <div className="col-md-3">
          <label className="form-label">Categoría</label>
          <select
            name="category"
            className="form-select"
            value={filters.category}
            onChange={handleChange}
          >
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

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
          <div className="d-flex gap-3 mb-3">
            <button onClick={handleExportExcel} className="btn btn-success fw-semibold">
              <Download size={18} /> Excel
            </button>
            <button onClick={handleExportPDF} className="btn btn-danger fw-semibold">
              <FileText size={18} /> PDF
            </button>
          </div>

          <div className="table-scroll mt-3">
            <table className="table table-bordered table-striped table-sticky table-header-green text-center">

              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>ID Venta</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Importe</th>
                  <th>Descuento</th>
                  <th>Debe</th>
                  <th>Haber</th>
                  <th>Método Pago</th>
                </tr>
              </thead>

              <tbody>
                {reportData.data.map((r) => (
                  <tr
                    key={`${r.entry_type}-${r.doc_id}-${r.product_id}`}
                    className={r.entry_type === "REFUND" ? "table-danger" : "table-success"}
                  >
                    <td>{new Date(r.created_at).toLocaleDateString("es-AR")}</td>
                    <td>{r.entry_type === "REFUND" ? "NC" : "VENTA"}</td>
                    <td>{r.sale_id}</td>
                    <td>{r.product_name}</td>
                    <td>{r.quantity}</td>
                    <td>${r.unit_price.toFixed(2)}</td>
                    <td>${grossAmount(r).toFixed(2)}</td>
                    <td>${Math.abs(r.item_discount_amount || 0).toFixed(2)}</td>
                    <td>{r.debit ? `$${r.debit.toFixed(2)}` : "-"}</td>
                    <td>{r.credit ? `$${r.credit.toFixed(2)}` : "-"}</td>
                    <td>{r.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="mt-3 text-end">
            {(() => {
              const totalDebe = sum(reportData.data, (r) => r.debit);
              const totalHaber = sum(reportData.data, (r) => r.credit);
              const totalDesc = sum(reportData.data, (r) =>
                Math.abs(r.item_discount_amount || 0)
              );
              const totalFinal = totalHaber - totalDebe - totalDesc;
              return (
                <>
                  <p className="fw-bold mb-0 text-success">
                    Total Haber (Ventas): ${totalHaber.toFixed(2)}
                  </p>
                  <p className="fw-bold mb-0 text-danger">
                    Total Debe (NC): ${totalDebe.toFixed(2)}
                  </p>
                  <p className="fw-bold mb-0 text-warning">
                    Total Descuentos: ${totalDesc.toFixed(2)}
                  </p>
                  <p className="fw-bold mt-1 text-primary">
                    Total Final: ${totalFinal.toFixed(2)}
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

export default ReporteVentas;
