import { useState, useEffect } from "react";
import { reportsAPI, productsAPI } from "../../services/api";
import { toast } from "react-toastify";
import { Download, FileText } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/reportes.css";

const ReporteVentas = () => {
  const [reportData, setReportData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    reportType: "detail",
    period: "month",
    start_date: "",
    end_date: "",
    start_month: "",
    end_month: "",
    category: ""
  });
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisYear, setAnalysisYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadCategories();
    loadSalesAnalysis();
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

  const loadSalesAnalysis = async (year = analysisYear) => {
    setAnalysisLoading(true);
    try {
      const res = await reportsAPI.getSalesAnalysisReport({ year });
      setAnalysisData(res.data);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Error al generar análisis de ventas");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleExportAnalysisExcel = async () => {
    try {
      const res = await reportsAPI.exportSalesAnalysisExcel({ year: analysisYear });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `datos_a_analizar_ventas_${analysisYear}_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel del panel descargado");
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Error al exportar Excel del panel");
    }
  };

  const generateReport = async () => {
    if (filters.reportType === "monthly") {
      if (!filters.start_month || !filters.end_month) {
        toast.warning("Debe seleccionar mes/año de inicio y fin");
        return;
      }
      if (filters.start_month >= filters.end_month) {
        toast.warning("El mes inicial debe ser menor al mes final");
        return;
      }
    } else {
      if (filters.period === "custom" && (!filters.start_date || !filters.end_date)) {
        toast.warning("Debe seleccionar fechas válidas");
        return;
      }
      if (filters.period === "custom" && filters.start_date > filters.end_date) {
        toast.warning("La fecha inicial debe ser menor o igual a la fecha final");
        return;
      }
    }

    setLoading(true);
    try {
      const params = filters.reportType === "monthly"
        ? {
            start_month: filters.start_month,
            end_month: filters.end_month,
            category: filters.category
          }
        : { ...filters };
      const res = filters.reportType === "monthly"
        ? await reportsAPI.getMonthlySalesReport(params)
        : await reportsAPI.getSalesReport(params);
      setReportData(res.data);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Error al generar reporte");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = filters.reportType === "monthly"
        ? {
            start_month: filters.start_month,
            end_month: filters.end_month,
            category: filters.category
          }
        : filters;
      const res = filters.reportType === "monthly"
        ? await reportsAPI.exportMonthlySalesExcel(params)
        : await reportsAPI.exportExcel(params);
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filters.reportType === "monthly"
        ? `informe_ventas_mensuales_${Date.now()}.xlsx`
        : `reporte_ventas_${Date.now()}.xlsx`;
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
      const params = filters.reportType === "monthly"
        ? new URLSearchParams({
            start_month: filters.start_month,
            end_month: filters.end_month,
            category: filters.category
          })
        : new URLSearchParams(filters);
      const res = filters.reportType === "monthly"
        ? await reportsAPI.exportMonthlySalesPDF(params, { responseType: "blob" })
        : await reportsAPI.exportPDF(params, { responseType: "blob" });
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
  const formatMetricValue = (metric) => {
    const value = Number(metric.value || 0);
    if (metric.type === "currency") {
      return value.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    if (metric.type === "integer") {
      return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
    }
    return value.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="container-fluid py-4">
      <h3 className="mb-3 fw-bold text-dark">📘 Reporte de Ventas</h3>

      {/* Filtros */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <label className="form-label">Tipo de informe</label>
          <select
            name="reportType"
            className="form-select"
            value={filters.reportType}
            onChange={handleChange}
          >
            <option value="detail">Detalle de ventas</option>
            <option value="monthly">Totales mensuales</option>
          </select>
        </div>

        {filters.reportType === "detail" && (
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
        )}

        {filters.reportType === "detail" && filters.period === "custom" && (
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

        {filters.reportType === "monthly" && (
          <>
            <div className="col-md-3">
              <label className="form-label">Desde mes/año</label>
              <input
                type="month"
                name="start_month"
                className="form-control"
                value={filters.start_month}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Hasta mes/año</label>
              <input
                type="month"
                name="end_month"
                className="form-control"
                value={filters.end_month}
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

      <div className="sales-analysis-panel mb-4">
        <div className="sales-analysis-header">
          <div>
            <h5 className="mb-1 fw-bold">Datos a analizar</h5>
            <p className="mb-0 text-muted">
              Abril y mayo {analysisData?.year || analysisYear}. Clientes equivale a tickets de venta.
            </p>
          </div>
          <div className="sales-analysis-actions">
            <input
              type="number"
              className="form-control"
              min="2000"
              max="2100"
              value={analysisYear}
              onChange={(e) => setAnalysisYear(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-primary fw-semibold"
              onClick={() => loadSalesAnalysis(analysisYear)}
              disabled={analysisLoading}
            >
              {analysisLoading ? "Calculando..." : "Actualizar"}
            </button>
            <button
              type="button"
              className="btn btn-success fw-semibold"
              onClick={handleExportAnalysisExcel}
              disabled={analysisLoading}
            >
              <Download size={18} /> Excel
            </button>
          </div>
        </div>

        <div className="sales-analysis-grid">
          {(analysisData?.metrics || []).map((metric) => (
            <div className="sales-analysis-item" key={metric.key}>
              <span>{metric.label}</span>
              <strong>{formatMetricValue(metric)}</strong>
            </div>
          ))}
          {analysisLoading && !analysisData && (
            <div className="sales-analysis-empty">Calculando datos...</div>
          )}
          {!analysisLoading && !analysisData && (
            <div className="sales-analysis-empty">No se pudieron cargar los datos.</div>
          )}
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

          {filters.reportType === "monthly" ? (
            <div className="table-scroll mt-3">
              <table className="table table-bordered table-striped table-sticky table-header-green text-center">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Ventas</th>
                    <th>Notas Crédito</th>
                    <th>Unidades</th>
                    <th>Importe Bruto</th>
                    <th>Descuentos</th>
                    <th>Total Ventas</th>
                    <th>Total NC</th>
                    <th>Total Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.data.map((r) => (
                    <tr key={r.month_key}>
                      <td>{r.label}</td>
                      <td>{r.sales_count}</td>
                      <td>{r.refunds_count}</td>
                      <td>{Number(r.units || 0).toFixed(2)}</td>
                      <td>${Number(r.gross_amount || 0).toFixed(2)}</td>
                      <td>${Number(r.discounts || 0).toFixed(2)}</td>
                      <td className="text-success">${Number(r.credit || 0).toFixed(2)}</td>
                      <td className="text-danger">${Number(r.debit || 0).toFixed(2)}</td>
                      <td className={Number(r.net_total || 0) >= 0 ? "text-primary fw-semibold" : "text-danger fw-semibold"}>
                        ${Number(r.net_total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
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
          )}

          {/* Totales */}
          <div className="mt-3 text-end">
            {(() => {
              if (filters.reportType === "monthly") {
                const totals = reportData.totals || {};
                return (
                  <>
                    <p className="fw-bold mb-0 text-success">
                      Total Ventas: ${Number(totals.credit || 0).toFixed(2)}
                    </p>
                    <p className="fw-bold mb-0 text-danger">
                      Total NC: ${Number(totals.debit || 0).toFixed(2)}
                    </p>
                    <p className="fw-bold mb-0 text-warning">
                      Total Descuentos: ${Number(totals.discounts || 0).toFixed(2)}
                    </p>
                    <p className="fw-bold mt-1 text-primary">
                      Total Neto: ${Number(totals.net_total || 0).toFixed(2)}
                    </p>
                  </>
                );
              }

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
