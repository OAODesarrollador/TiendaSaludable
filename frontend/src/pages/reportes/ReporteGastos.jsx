import { useEffect, useMemo, useState } from "react";
import { reportsAPI } from "../../services/api";
import { toast } from "react-toastify";
import { Download } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/reportes.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const formatDate = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const ReporteGastos = () => {
  const [reportData, setReportData] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    start_month: "",
    end_month: "",
    concept: ""
  });

  const params = useMemo(
    () => ({
      start_month: filters.start_month,
      end_month: filters.end_month,
      concept: filters.concept
    }),
    [filters]
  );

  const loadConcepts = async (rangeFilters = {}) => {
    try {
      const response = await reportsAPI.getRestockExpenseConcepts({
        start_month: rangeFilters.start_month || "",
        end_month: rangeFilters.end_month || ""
      });
      const rows = response.data?.data || [];
      setConcepts(rows);
      return {
        rows,
        range: response.data?.range || {}
      };
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Error cargando conceptos de egresos");
      return { rows: [], range: {} };
    }
  };

  const generateReport = async (nextFilters = filters) => {
    if (!nextFilters.start_month || !nextFilters.end_month) {
      toast.warning("Debe seleccionar mes inicial y mes final");
      return;
    }
    if (nextFilters.start_month > nextFilters.end_month) {
      toast.warning("El mes inicial debe ser menor o igual al mes final");
      return;
    }

    setLoading(true);
    try {
      const response = await reportsAPI.getRestockExpensesReport({
        start_month: nextFilters.start_month,
        end_month: nextFilters.end_month,
        concept: nextFilters.concept
      });
      setReportData(response.data);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Error generando reporte de gastos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      const { range } = await loadConcepts();
      const nextFilters = {
        start_month: range.first_month || "",
        end_month: range.last_month || "",
        concept: ""
      };
      setFilters(nextFilters);
      if (nextFilters.start_month && nextFilters.end_month) {
        generateReport(nextFilters);
      }
    };

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = async (event) => {
    const { name, value } = event.target;
    const nextFilters = {
      ...filters,
      [name]: value,
      ...(name === "start_month" || name === "end_month" ? { concept: "" } : {})
    };

    setFilters(nextFilters);

    if (name === "start_month" || name === "end_month") {
      await loadConcepts(nextFilters);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await reportsAPI.exportRestockExpensesExcel(params);
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gastos_reposicion_${Date.now()}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "No se pudo exportar el Excel");
    }
  };

  const monthlyRows = reportData?.data || [];
  const detailRows = reportData?.details || [];
  const total = reportData?.totals?.total || 0;

  return (
    <div className="container-fluid py-4">
      <h3 className="mb-3 fw-bold text-dark">Gastos por Reposición de Mercadería</h3>

      <div className="row g-3 mb-4">
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

        <div className="col-md-4">
          <label className="form-label">Filtrar concepto</label>
          <select
            name="concept"
            className="form-control"
            value={filters.concept}
            onChange={handleChange}
          >
            <option value="">Todos los egresos</option>
            {concepts.map((item) => (
              <option key={item.concept} value={item.concept}>
                {item.concept}
              </option>
            ))}
          </select>
          <div className="form-text">
            La lista sale de los conceptos cargados como egresos de caja.
          </div>
        </div>

        <div className="col-md-2 d-flex align-items-end">
          <button
            type="button"
            onClick={() => generateReport()}
            className="btn btn-primary w-100 fw-semibold"
            disabled={loading}
          >
            {loading ? "Generando..." : "Generar"}
          </button>
        </div>
      </div>

      {reportData && (
        <>
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
            <div className="expense-total-box">
              <span>Total del período</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="btn btn-success fw-semibold"
              disabled={!detailRows.length}
            >
              <Download size={18} /> Excel
            </button>
          </div>

          <div className="table-scroll mt-3">
            <table className="table table-bordered table-striped table-header-green text-center">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Movimientos</th>
                  <th>Total Reposición</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.month_key}>
                    <td>{row.label}</td>
                    <td>{row.movements_count}</td>
                    <td className="fw-semibold text-danger">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-success fw-bold">
                  <td>Total</td>
                  <td>{reportData.totals?.movements_count || 0}</td>
                  <td>{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <h5 className="mt-4 mb-3 fw-bold">Detalle de movimientos incluidos</h5>
          <div className="table-scroll">
            <table className="table table-bordered table-striped table-header-green text-center">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Mes</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length > 0 ? (
                  detailRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.label}</td>
                      <td className="text-start">{row.concept || "-"}</td>
                      <td>{row.payment_method || "-"}</td>
                      <td className="fw-semibold text-danger">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      No hay egresos que coincidan con el concepto seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ReporteGastos;
