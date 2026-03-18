import { useEffect, useMemo, useState } from "react";
import { reportsAPI, productsAPI } from "../../services/api";
import { toast } from "react-toastify";
import { Download, FileText } from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/reportes.css";

const PRODUCT_REPORT_TYPES = [
  { value: "by_category", label: "Listado por categorías" },
  { value: "expiring", label: "Listado por vencimiento" },
  { value: "low_stock", label: "Productos con quiebre de stock" },
  { value: "by_supplier", label: "Listado por proveedor" },
  { value: "price_list", label: "Lista de Precios" }
];

const ReporteProductos = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({
    report_type: "by_category",
    period: "week",
    start_date: "",
    end_date: "",
    category: "",
    supplier: "",
    include_purchase_price: false
  });

  useEffect(() => {
    loadFiltersData();
    generateReport();
  }, []);

  const loadFiltersData = async () => {
    try {
      const response = await productsAPI.getAll();
      const products = response.data || [];
      const uniqueCategories = Array.from(
        new Set(products.map((product) => product.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
      const uniqueSuppliers = Array.from(
        new Set(products.map((product) => product.supplier).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      setCategories(uniqueCategories);
      setSuppliers(uniqueSuppliers);
    } catch (error) {
      console.error("Error cargando filtros de productos:", error);
    }
  };

  const isExpiringReport = filters.report_type === "expiring";
  const isSupplierReport = filters.report_type === "by_supplier";
  const isPriceListReport = filters.report_type === "price_list";
  const isCategoryReport =
    filters.report_type === "by_category" ||
    filters.report_type === "low_stock" ||
    filters.report_type === "price_list";

  const buildParams = () => {
    const params = { report_type: filters.report_type };

    if (isExpiringReport) {
      params.period = filters.period;
      if (filters.period === "custom") {
        params.start_date = filters.start_date;
        params.end_date = filters.end_date;
      }
    }

    if (isCategoryReport && filters.category) {
      params.category = filters.category;
    }

    if (isSupplierReport && filters.supplier) {
      params.supplier = filters.supplier;
    }

    if (isPriceListReport) {
      params.include_purchase_price = filters.include_purchase_price;
    }

    return params;
  };

  const generateReport = async () => {
    if (isExpiringReport && filters.period === "custom" && (!filters.start_date || !filters.end_date)) {
      toast.warning("Debe seleccionar fechas válidas");
      return;
    }

    setLoading(true);
    try {
      const response = await reportsAPI.getProductsReport(buildParams());
      setReportData(response.data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "Error generando reporte de productos");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response =
        format === "excel"
          ? await reportsAPI.exportProductsExcel(buildParams())
          : await reportsAPI.exportProductsPDF(buildParams());

      const blob = new Blob(
        [response.data],
        { type: format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf" }
      );
      const url = window.URL.createObjectURL(blob);

      if (format === "excel") {
        const link = document.createElement("a");
        link.href = url;
        link.download = `reporte_productos_${Date.now()}.xlsx`;
        link.click();
      } else {
        window.open(url, "_blank");
      }

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error(`Error exportando ${format.toUpperCase()}`);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "report_type" && value !== "expiring"
        ? { period: "week", start_date: "", end_date: "" }
        : {})
    }));
  };

  const title = useMemo(() => {
    return PRODUCT_REPORT_TYPES.find((item) => item.value === filters.report_type)?.label || "Reporte de Productos";
  }, [filters.report_type]);

  return (
    <div className="container-fluid py-4">
      <h3 className="mb-3 fw-bold text-dark">📦 {title}</h3>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <label className="form-label">Tipo</label>
          <select
            name="report_type"
            className="form-select"
            value={filters.report_type}
            onChange={handleChange}
          >
            {PRODUCT_REPORT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        {isExpiringReport && (
          <>
            <div className="col-md-2">
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
                <div className="col-md-2">
                  <label className="form-label">Desde</label>
                  <input
                    type="date"
                    name="start_date"
                    className="form-control"
                    value={filters.start_date}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-2">
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
          </>
        )}

        {isCategoryReport && (
          <div className="col-md-3">
            <label className="form-label">Categoría</label>
            <select
              name="category"
              className="form-select"
              value={filters.category}
              onChange={handleChange}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        )}

        {isPriceListReport && (
          <div className="col-md-3 d-flex align-items-end">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="include_purchase_price"
                name="include_purchase_price"
                checked={filters.include_purchase_price}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="include_purchase_price">
                Incluir precio de compra
              </label>
            </div>
          </div>
        )}

        {isSupplierReport && (
          <div className="col-md-3">
            <label className="form-label">Proveedor</label>
            <select
              name="supplier"
              className="form-select"
              value={filters.supplier}
              onChange={handleChange}
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>
        )}

        <div className="col-md-2 d-flex align-items-end">
          <button onClick={generateReport} className="btn btn-primary w-100 fw-semibold">
            {loading ? "Generando..." : "Generar"}
          </button>
        </div>
      </div>

      {reportData && (
        <>
          <div className="d-flex gap-3 mb-3">
            <button onClick={() => handleExport("excel")} className="btn btn-success fw-semibold">
              <Download size={18} /> Excel
            </button>
            <button onClick={() => handleExport("pdf")} className="btn btn-danger fw-semibold">
              <FileText size={18} /> PDF
            </button>
          </div>

          <div className="table-scroll mt-3">
            {(() => {
              const tableWidth = isPriceListReport
                ? filters.include_purchase_price
                  ? "1080px"
                  : "940px"
                : "1360px";

              return (
            <table
              className="table table-bordered table-striped table-header-green text-center"
              style={{
                width: tableWidth,
                minWidth: tableWidth
              }}
            >
              {isPriceListReport ? (
                <colgroup>
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: filters.include_purchase_price ? "500px" : "620px" }} />
                  <col style={{ width: "60px" }} />
                  {filters.include_purchase_price && <col style={{ width: "145px" }} />}
                  <col style={{ width: "145px" }} />
                </colgroup>
              ) : (
                <colgroup>
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "140px" }} />
                  <col style={{ width: "320px" }} />
                  <col style={{ width: "220px" }} />
                  <col style={{ width: "220px" }} />
                  <col style={{ width: "70px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "140px" }} />
                  <col style={{ width: "130px" }} />
                </colgroup>
              )}
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>EAN13</th>
                  <th>Nombre</th>
                  {!isPriceListReport && <th>Categoría</th>}
                  {!isPriceListReport && <th>Proveedor</th>}
                  <th>Stock</th>
                  {!isPriceListReport && <th>Stock Mínimo</th>}
                  {isPriceListReport && filters.include_purchase_price && <th>Precio Compra</th>}
                  <th>Precio Venta</th>
                  {!isPriceListReport && <th>Vencimiento</th>}
                </tr>
              </thead>
              <tbody>
                {reportData.data.map((product) => (
                  <tr key={product.id}>
                    <td className="text-nowrap">{product.sku}</td>
                    <td className="text-nowrap">{product.ean13 || "—"}</td>
                    <td
                      className="text-start text-nowrap"
                      style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      title={product.name}
                    >
                      {product.name}
                    </td>
                    {!isPriceListReport && <td>{product.category || "Sin categoría"}</td>}
                    {!isPriceListReport && <td>{product.supplier || "Sin proveedor"}</td>}
                    <td className="text-nowrap">{Number(product.stock || 0)}</td>
                    {!isPriceListReport && <td className="text-nowrap">{Number(product.min_stock || 0)}</td>}
                    {isPriceListReport && filters.include_purchase_price && (
                      <td className="text-nowrap">${Number(product.purchase_price || 0).toFixed(2)}</td>
                    )}
                    <td className="text-nowrap">${Number(product.sale_price || 0).toFixed(2)}</td>
                    {!isPriceListReport && (
                      <td className="text-nowrap">
                        {product.expiration_date
                          ? new Date(product.expiration_date).toLocaleDateString("es-AR")
                          : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
              );
            })()}
          </div>

          <div className="mt-3 text-end">
            <p className="fw-bold mb-1 text-success">
              Total Productos: {reportData.summary?.total_products || 0}
            </p>
            <p className="fw-bold mb-0 text-primary">
              Stock Total: {Number(reportData.summary?.total_stock || 0)}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ReporteProductos;
