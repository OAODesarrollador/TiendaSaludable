import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { DollarSign, ShoppingCart, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { 
  BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, 
  LineChart, Line 
} from 'recharts';

import { toast } from 'react-toastify';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [categoryMode, setCategoryMode] = useState('financial');
  const [paymentMode, setPaymentMode] = useState('financial');


  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) return null;

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#6366f1'];

  const loadTimeline = async () => {
  if (!startDate || !endDate) {
    toast.warning('Selecciona una fecha de inicio y fin');
    return;
  }

  try {
    const response = await dashboardAPI.getSalesTimeline(startDate, endDate);
    setTimeline(Array.isArray(response.data) ? response.data : []);

  } catch (error) {
    console.error('Error cargando línea de tiempo:', error);
    toast.error('No se pudieron obtener los datos del período');
  }
};


const calculateCorrelation = (data) => {
  const x = data.map(d => d.total_sales);
  const y = data.map(d => d.total_revenue);
  const n = x.length;
  const meanX = x.reduce((a,b) => a+b, 0) / n;
  const meanY = y.reduce((a,b) => a+b, 0) / n;
  const numerator = x.map((xi,i) => (xi-meanX)*(y[i]-meanY)).reduce((a,b)=>a+b,0);
  const denominator = Math.sqrt(
    x.map(xi => (xi-meanX)**2).reduce((a,b)=>a+b,0) *
    y.map(yi => (yi-meanY)**2).reduce((a,b)=>a+b,0)
  );
  return denominator ? numerator/denominator : 0;
};


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen de actividad y estadísticas</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Ventas de hoy */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ventas Hoy</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${stats.today.revenue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.today.sales} transacciones
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        {/* Ventas del mes */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ventas del Mes</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${stats.month.revenue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.month.sales} transacciones
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        {/* Total productos */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Productos</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.inventory.total_products}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                En catálogo
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Package className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        {/* Stock bajo */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {stats.inventory.low_stock_count}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Productos
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>
      {/* 📈 Ventas por período */}
<div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">
    Ventas por Período
  </h2>
  <div className="flex flex-wrap items-center gap-3 mb-4">
    <input
      type="date"
      className="border rounded-md px-3 py-2"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
    />
    <input
      type="date"
      className="border rounded-md px-3 py-2"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
    />
    <button
      onClick={loadTimeline}
      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
    >
      Generar
    </button>
  </div>
{timeline.length > 0 ? (
  <ResponsiveContainer width="100%" height={350}>
    <LineChart
      data={timeline}
      margin={{ top: 20, right: 60, left: 10, bottom: 20 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis
        dataKey="date"
        tickFormatter={(d) =>
          new Date(d).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
          })
        }
        tick={{ fontSize: 12 }}
      />

      {/* Eje Y izquierdo - ingresos */}
      <YAxis
        yAxisId="left"
        orientation="left"
        tickFormatter={(v) => `$${v.toLocaleString('es-AR')}`}
        stroke="#22c55e"
      />

      {/* Eje Y derecho - cantidad */}
      <YAxis
        yAxisId="right"
        orientation="right"
        tickFormatter={(v) => v}
        stroke="#3b82f6"
      />

      <Tooltip
        formatter={(value, name) =>
          name === 'Ingresos ($)'
            ? `$${value.toLocaleString('es-AR')}`
            : `${value} ventas`
        }
        labelFormatter={(label) =>
          new Date(label).toLocaleDateString('es-AR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          })
        }
      />
      <Legend verticalAlign="top" height={36} />

      <Line
        yAxisId="left"
        type="monotone"
        dataKey="total_revenue"
        stroke="#22c55e"
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 6 }}
        name="Ingresos ($)"
      />

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="total_sales"
        stroke="#3b82f6"
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 6 }}
        name="Cantidad de Ventas"
      />
    </LineChart>
  </ResponsiveContainer>
) : (
  <p className="text-gray-500 text-sm">
    No hay datos para el período seleccionado.
  </p>
)}
<div className="text-sm text-gray-500 mt-2 italic">
  Tendencia: las ventas acompañan el ingreso total en un {calculateCorrelation(timeline).toFixed(2)} de correlación.
</div>


</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
{/* Top 15 productos (barras horizontales) */}
<div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
  <h2 className="text-lg font-semibold text-gray-900 mb-4">
    Top 15 Productos Más Vendidos (Últimos 30 días)
  </h2>

  <ResponsiveContainer width="100%" height={500}>
    <BarChart
      layout="vertical"
      data={[...stats.top_products]} // invertimos para mostrar el top más alto arriba
      margin={{ top: 20, right: 5, left: 5, bottom: 20 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis type="number" />
      <YAxis
        dataKey="product_name"
        type="category"
        width={200}
        tick={{ fontSize: 10 }}
        
      />
      <Tooltip
        formatter={(value) => `${value.toLocaleString('es-AR')} unidades`}
        labelStyle={{ fontWeight: 'bold' }}
      />
      <Legend />
      <Bar
        dataKey="total_sold"
        name="Unidades Vendidas"
        fill="#22c55e"
        barSize={20}
        radius={[0, 6, 6, 0]}
      />
    </BarChart>
  </ResponsiveContainer>
</div>

{/* Ventas por categoría */}
<div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-900">
      Ventas por Categoría
    </h2>
    <div className="flex gap-2">
      <button
        onClick={() => setCategoryMode('financial')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          categoryMode === 'financial'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        💰 Análisis Financiero
      </button>
      <button
        onClick={() => setCategoryMode('operational')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          categoryMode === 'operational'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        📦 Análisis Operativo
      </button>
    </div>
  </div>

  <ResponsiveContainer width="100%" height={500}>
    <BarChart
      data={[...stats.sales_by_category]
        .sort((a, b) =>
          categoryMode === 'financial'
            ? b.revenue - a.revenue
            : b.units_sold - a.units_sold
        )
        .slice(0, 15)}
      layout="vertical"
      margin={{ top: 20, right: 5, left:5, bottom: 20 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis type="number" />
      <YAxis
        type="category"
        dataKey="category"
        tick={{ fontSize: 10 }}
        width={150}
      />
      <Tooltip
        formatter={(value) =>
          categoryMode === 'financial'
            ? `$${value.toLocaleString('es-AR')}`
            : `${value.toLocaleString('es-AR')} unidades`
        }
        labelStyle={{ fontWeight: 'bold' }}
      />
      <Legend />
      <Bar
        dataKey={categoryMode === 'financial' ? 'revenue' : 'units_sold'}
        fill={categoryMode === 'financial' ? '#22c55e' : '#3b82f6'}
        name={
          categoryMode === 'financial'
            ? 'Ingresos ($)'
            : 'Unidades Vendidas'
        }
        barSize={20}
        radius={[0, 6, 6, 0]}
      />
    </BarChart>
  </ResponsiveContainer>
</div>
<p className="text-sm text-gray-500 mt-2 italic">
  Modo actual: {categoryMode === 'financial' ? 'Análisis Financiero (Ingresos en $)' : 'Análisis Operativo (Unidades Vendidas)'}
</p>

      </div>
{/* Ventas por método de pago */}
<div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-900">
      Ventas por Método de Pago (Últimos 30 días)
    </h2>
    <div className="flex gap-2">
      <button
        onClick={() => setPaymentMode('financial')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          paymentMode === 'financial'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        💰 Análisis Financiero
      </button>
      <button
        onClick={() => setPaymentMode('operational')}
        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          paymentMode === 'operational'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        📦 Análisis Operativo
      </button>
    </div>
  </div>

  {stats.sales_by_payment && stats.sales_by_payment.length > 0 ? (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={stats.sales_by_payment}
          dataKey={paymentMode === 'financial' ? 'total_revenue' : 'count'}
          nameKey="payment_method"
          cx="50%"
          cy="50%"
          outerRadius={150}
          label={({ name, percent }) =>
            `${name.toUpperCase()} ${(percent * 100).toFixed(1)}%`
          }
        >
          {stats.sales_by_payment.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) =>
            paymentMode === 'financial'
              ? `$${value.toLocaleString('es-AR')}`
              : `${value} transacciones`
          }
        />
        <Legend layout="vertical" align="right" verticalAlign="middle" />
      </PieChart>
    </ResponsiveContainer>
  ) : (
    <p className="text-gray-500 text-sm">No hay datos disponibles.</p>
  )}
  <p className="text-sm text-gray-500 mt-2 italic">
    Modo actual: {paymentMode === 'financial' ? 'Análisis Financiero (Ingresos en $)' : 'Análisis Operativo (Cantidad de Transacciones)'}
  </p>
</div>

      {/* Últimas ventas */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Últimas Ventas
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recent_sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{sale.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sale.created_at).toLocaleString('es-AR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sale.seller_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                    ${sale.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;