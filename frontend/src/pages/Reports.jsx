import { useState, useEffect } from 'react';
import { reportsAPI, productsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Download, FileText, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const Reports = () => {
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    reportType: 'sales',
    period: 'month',
    start_date: '',
    end_date: '',
    category: ''
  });

  useEffect(() => {
    loadCategories();
    generateReport();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await productsAPI.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };
// ...imports iguales
const generateReport = async () => {
  // Validación previa
  if (filters.period === 'custom') {
    if (!filters.start_date || !filters.end_date) {
      toast.warning('Debe seleccionar una fecha de inicio y una de fin para el reporte personalizado.');
      return;
    }
    if (filters.start_date > filters.end_date) {
      toast.warning('La fecha de inicio no puede ser mayor a la fecha de fin.');
      return;
    }
  }

  setLoading(true);
  try {
    const params = {};
    if (filters.period) params.period = filters.period;
    if (filters.category) params.category = filters.category;
    if (filters.period === 'custom') {
      params.start_date = filters.start_date;
      params.end_date = filters.end_date;
    }

    const response =
      filters.reportType === 'expiring'
        ? await reportsAPI.getExpiringProducts(params)
        : await reportsAPI.getSalesReport(params);

    setReportData(response.data);
  } catch (error) {
    console.error('Error generando reporte:', error);
    const msg = error?.response?.data?.error || 'Error al generar reporte';
    toast.error(msg);
  } finally {
    setLoading(false);
  }
};



  const handleExportCSV = async () => {
    try {
      const params = {};
      if (filters.period) params.period = filters.period;
      if (filters.category) params.category = filters.category;
      if (filters.period === 'custom' && filters.start_date && filters.end_date) {
        params.start_date = filters.start_date;
        params.end_date = filters.end_date;
      }

      let response;
      if (filters.reportType === 'expiring') {
        response = await reportsAPI.exportExpiringCSV(params);
      } else {
        response = await reportsAPI.exportCSV(params);
      }

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        filters.reportType === 'expiring'
          ? `reporte_vencimientos_${Date.now()}.csv`
          : `reporte_ventas_${Date.now()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Reporte CSV descargado');
    } catch (error) {
      console.error('Error exportando CSV:', error);
      toast.error('Error al exportar CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      const params = {};
      if (filters.period) params.period = filters.period;
      if (filters.category) params.category = filters.category;
      if (filters.period === 'custom' && filters.start_date && filters.end_date) {
        params.start_date = filters.start_date;
        params.end_date = filters.end_date;
      }

      let response;
      if (filters.reportType === 'expiring') {
        response = await reportsAPI.exportExpiringPDF(params);
      } else {
        response = await reportsAPI.exportPDF(params);
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        filters.reportType === 'expiring'
          ? `reporte_vencimientos_${Date.now()}.pdf`
          : `reporte_ventas_${Date.now()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Reporte PDF descargado');
    } catch (error) {
      console.error('Error exportando PDF:', error);
      toast.error('Error al exportar PDF');
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  // Datos para los gráficos
  const chartDataByCategory =
    reportData && filters.reportType === 'sales'
      ? Object.entries(reportData.stats.by_category).map(([category, data]) => ({
          category,
          revenue: data.revenue,
          units: data.units
        }))
      : [];

  const chartDataByProduct =
    reportData && filters.reportType === 'sales'
      ? Object.entries(reportData.stats.by_product)
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 10)
          .map(([product, data]) => ({
            product: product.length > 20 ? product.substring(0, 20) + '...' : product,
            revenue: data.revenue,
            units: data.units
          }))
      : [];

  // Preprocesar datos de vencimientos con keys seguras
  const expiringData =
    reportData?.data?.map((p, idx) => ({
      ...p,
      uuid: p.id || `${p.sku || 'prod'}-${idx}`
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {filters.reportType === 'expiring'
            ? 'Reporte de Vencimientos'
            : 'Reportes de Ventas'}
        </h1>
        <p className="text-gray-600 mt-1">
          {filters.reportType === 'expiring'
            ? 'Consulta los productos que se vencen por fecha o rango personalizado'
            : 'Análisis detallado y exportación de ventas'}
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Tipo de reporte */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Reporte
            </label>
            <select
              name="reportType"
              value={filters.reportType}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="sales">Ventas</option>
              <option value="expiring">Vencimientos</option>
            </select>
          </div>

          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              name="period"
              value={filters.period}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {filters.reportType === 'expiring' ? (
                <>
                  <option value="today">Hoy</option>
                  <option value="tomorrow">Mañana</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mes</option>
                  <option value="custom">Personalizado</option>
                </>
              ) : (
                <>
                  <option value="today">Hoy</option>
                  <option value="week">Última Semana</option>
                  <option value="month">Último Mes</option>
                  <option value="year">Último Año</option>
                  <option value="custom">Personalizado</option>
                </>
              )}
            </select>
          </div>

          {/* Fechas personalizadas */}
          {filters.period === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </>
          )}

          {/* Categoría */}
          {filters.reportType === 'sales' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
              </label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botón generar */}
          <div className="flex items-end gap-2">
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Generando...' : 'Generar'}
            </button>
          </div>
        </div>
      </div>

      {/* Botones de exportación */}
      {reportData && (
        <div className="flex gap-4">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            <Download size={20} />
            Exportar CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            <FileText size={20} />
            Exportar PDF
          </button>
        </div>
      )}

      {/* Contenido condicional */}
      {filters.reportType === 'expiring' && reportData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Productos próximos a vencer ({expiringData.length})
            </h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expiringData.map((p) => (
                  <tr key={p.uuid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{p.sku}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center">{p.stock}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-red-600">
                      {new Date(p.expiration_date).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!reportData && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 text-center">
          <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">
            Seleccione los filtros y haga clic en "Generar" para ver el reporte
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )}
    </div>
  );
};

export default Reports;
