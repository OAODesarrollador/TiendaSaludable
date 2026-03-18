import { useState, useEffect } from "react";
import { reportsAPI } from "../../services/api";
import { toast } from "react-toastify";
import { Download, FileText } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/reportes.css";

const ReportesDescuentos = () => {
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    period: "week",
    start_date: "",
    end_date: ""
  });
  const [loading, setLoading] = useState(false);
  const [chartUrl, setChartUrl] = useState(null);

  useEffect(() => {
    generateReport();
  }, []);

  // === GENERAR REPORTE ===
  const generateReport = async () => {
  if (filters.period === "custom" && (!filters.start_date || !filters.end_date)) {
    toast.warning("Debe seleccionar fechas válidas");
    return;
  }

  setLoading(true);
  try {
    const res = await reportsAPI.getDiscountSales(filters);
    setReportData(res.data);

    // 🔹 generar gráfico SOLO si hay datos
    const totalSalesCount = res.data.summary?.total_tickets || 0;
    const discountedCount = res.data.summary?.tickets_con_descuento || 0;

    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
      type: 'pie',
      data: {
        labels: ['Con descuento', 'Sin descuento'],
        datasets: [{
          data: [discountedCount, totalSalesCount - discountedCount],
          backgroundColor: ['#4CAF50', '#FFC107']
        }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Proporción de Tickets con Descuento' }
        }
      }
    }))}`;

    setChartUrl(chartUrl);
  } catch (error) {
    console.error(error);
    toast.error("Error generando reporte de descuentos");
  } finally {
    setLoading(false);
  }
};

  // === EXPORTAR CSV ===
  const handleExportExcel = async () => {
    try {
      const res = await reportsAPI.exportDiscountExcel(filters);
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_descuentos_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel exportado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error exportando Excel");
    }
  };

  // === EXPORTAR PDF ===
  const handleExportPDF = async () => {
    try {
      const res = await reportsAPI.exportDiscountPDF(filters, { responseType: "blob" });
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
      <h3 className="mb-3 fw-bold text-dark">💸 Reporte de Ventas con Descuento</h3>

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
          {/* ===== BOTONES EXPORT ===== */}
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
                  <th>Fecha</th>
                  <th>ID Venta</th>
                  <th>Vendedor</th>
                  <th>Método de Pago</th>
                  <th>Origen</th>
                  <th>Desc. Ítems</th>
                  <th>Desc. General</th>
                  <th>Tipo General</th>
                  <th>Subtotal</th>
                  <th>Descuento</th>
                  <th>Total</th>
                  <th>% Descuento</th>
                </tr>
              </thead>

              <tbody>
                {reportData.data.map((sale, idx) => {
                  const grossAmount = Number(sale.gross_amount || 0);
                  const itemDiscountAmount = Number(sale.item_discount_total_amount || 0);
                  const orderDiscountAmount = Number(sale.order_discount_amount || 0);
                  const discountAmount = Number(sale.discount_total_amount || 0);
                  const discountPercent =
                    grossAmount > 0 ? ((discountAmount / grossAmount) * 100).toFixed(1) : "0.0";
                  const originLabel =
                    sale.discount_origin === "mixto"
                      ? "Mixto"
                      : sale.discount_origin === "general"
                      ? "General"
                      : "Por ítem";
                  const orderDiscountTypeLabel =
                    sale.order_discount_type === "percentage"
                      ? "Porcentaje"
                      : sale.order_discount_type === "fixed"
                      ? "Monto fijo"
                      : "—";

                  return (
                  <tr key={idx}>
                    <td>{new Date(sale.created_at).toLocaleDateString("es-AR")}</td>
                    <td>{sale.id}</td>
                    <td>{sale.seller_name}</td>
                    <td>{sale.payment_method}</td>
                    <td>{originLabel}</td>
                    <td>${itemDiscountAmount.toFixed(2)}</td>
                    <td>${orderDiscountAmount.toFixed(2)}</td>
                    <td>{orderDiscountTypeLabel}</td>
                    <td>${Number(sale.gross_amount || 0).toFixed(2)}</td>
                    <td>${discountAmount.toFixed(2)}</td>
                    <td>${Number(sale.total).toFixed(2)}</td>
                    <td>{discountPercent}%</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
                
          {/* ===== RESUMEN ===== */}
          <div className="mt-3 text-end flex  align-items-center">
            <>
                <div className="mt-4 row align-items-center">
                  <div className="col-md-6 text-center">
                    {chartUrl && (
                      <>
                        <h5>Distribución de Ventas con Descuento</h5>
                        <img
                          src={chartUrl}
                          alt="Gráfico de descuentos"
                          style={{
                            maxWidth: "100%",
                            width: "350px",
                            border: "1px solid #ccc",
                            borderRadius: "8px",
                            padding: "10px",
                            backgroundColor: "#f9f9f9",
                          }}
                        />
                      </>
                    )}
                  </div>

                  <div className="col-md-6 d-flex flex-column align-items-start text-start">
                    <p className="fw-bold mb-2 text-success">
                      Total Ventas: {reportData.summary.total_tickets}
                    </p>
                    <p className="fw-bold mb-2 text-primary">
                      Ventas con Descuento: {reportData.summary.tickets_con_descuento} (
                      {reportData.summary.porcentaje_tickets_descuento}%)
                    </p>
                    <p className="fw-bold mb-0 text-danger">
                      Total Descontado: $
                      {Number(reportData.summary.total_descuentos || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
            </>
          </div>
          

        </>
      )}
    </div>
  );
};

export default ReportesDescuentos;
