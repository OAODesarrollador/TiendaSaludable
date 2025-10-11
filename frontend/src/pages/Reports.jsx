import { useState, useEffect } from 'react';
import { reportsAPI, productsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Download, FileText, Calendar, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const Reports = () => {
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [filters, setFilters] = useState({
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

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = {};
      
      if (filters.period !== 'custom') {
        params.period = filters.period;
      } else if (filters.start_date && filters.end_date) {
        params.start_date = filters.start_date;
        params.end_date = filters.end_date;
      }
      
      if (filters.category) {
        params.category = filters.category;
      }

      const response = await reportsAPI.getSalesReport(params);
      setReportData(response.data);
    } catch (error) {
      console.error('Error generando reporte:', error);
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (filters.period !== 'custom') {
        params.period = filters.period;
      } else if (filters.start_date && filters.end_date) {
        params.start_date = filters.start_date;
        params.end_date = filters.end_date;
      }
      if (filters.category) {
        params.category = filters.category;
      }

      const response = await reportsAPI.exportCSV(params);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_ventas_${Date.now()}.csv`;
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
      if (filters.period !== 'custom') {
        params.period = filters.period;
      } else if (filters.start_date && filters.end_date) {
        params.start_date = filters.start_date;
        params.end_date = filters.end_date;
      }

      const response = await reportsAPI.exportPDF(params);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_ventas_${Date.now()}.pdf`;
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

  // Preparar datos para gráficos
  const chartDataByCategory = reportData ? 
    Object.entries(reportData.stats.by_category).map(([category, data]) => ({
      category,
      revenue: data.revenue,
      units: data.units
    })) : [];

  const chartDataByProduct = reportData ?
    Object.entries(reportData.stats.by_product)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([product, data]) => ({
        product: product.length > 20 ? product.substring(0, 20) + '...' : product,
        revenue: data.revenue,
        units: data.units
      })) : [];

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reportes de Ventas</h1>
        <p className="text-gray-600 mt-1">Análisis detallado y exportación de datos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <option value="today">Hoy</option>
              <option value="week">Última Semana</option>
              <option value="month">Último Mes</option>
              <option value="year">Último Año</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

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
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

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

      {/* Resumen de estadísticas */}
      {reportData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-600">Total Transacciones</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {reportData.stats.total_transactions}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-3xl font-bold text-primary-600 mt-2">
                ${reportData.stats.total_revenue.toFixed(2)}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-600">Unidades Vendidas</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {reportData.stats.total_items}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <p className="text-sm font-medium text-gray-600">Ticket Promedio</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${reportData.stats.avg_ticket.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ventas por categoría */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Ingresos por Categoría
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartDataByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="revenue" name="Ingresos" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 productos */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Top 10 Productos por Ingresos
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartDataByProduct} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="product" type="category" width={150} fontSize={11} />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Bar dataKey="revenue" name="Ingresos" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla detallada */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Detalle de Ventas ({reportData.data.length} registros)
              </h2>
            </div>
            
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P. Unitario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.data.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(row.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {row.product_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {row.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${row.unit_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                        ${row.item_subtotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {row.payment_method}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen por método de pago */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Ventas por Método de Pago
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(reportData.stats.by_payment_method).map(([method, total]) => (
                <div key={method} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600 capitalize">{method}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ${total.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
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