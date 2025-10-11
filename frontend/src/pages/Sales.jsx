import { useState, useEffect } from 'react';
import { salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Eye, Download, Calendar, Search } from 'lucide-react';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      
      const response = await salesAPI.getAll(params);
      setSales(response.data);
    } catch (error) {
      console.error('Error cargando ventas:', error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (saleId) => {
    try {
      const response = await salesAPI.getById(saleId);
      setSelectedSale(response.data);
      setShowModal(true);
    } catch (error) {
      console.error('Error cargando detalle de venta:', error);
      toast.error('Error al cargar detalle');
    }
  };

  const handleDownloadPDF = async (saleId) => {
    try {
      const response = await salesAPI.getTicketPDF(saleId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket_${saleId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Ticket descargado');
    } catch (error) {
      console.error('Error descargando ticket:', error);
      toast.error('Error al descargar ticket');
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = () => {
    loadSales();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Historial de Ventas</h1>
        <p className="text-gray-600 mt-1">Consulte todas las transacciones realizadas</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="flex items-end">
            <button
              onClick={handleApplyFilters}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center justify-center gap-2"
            >
              <Search size={20} />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de ventas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha y Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{sale.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(sale.created_at).toLocaleString('es-AR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sale.seller_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                    {sale.items?.length || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${sale.subtotal.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${sale.tax.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                    ${sale.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full capitalize">
                      {sale.payment_method}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(sale.id)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="Ver detalle"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(sale.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Descargar ticket"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sales.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No se encontraron ventas en el período seleccionado
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle */}
      {showModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Detalle de Venta #{selectedSale.id}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Información general */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Fecha y Hora</p>
                  <p className="font-medium">{new Date(selectedSale.created_at).toLocaleString('es-AR')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vendedor</p>
                  <p className="font-medium">{selectedSale.seller_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Método de Pago</p>
                  <p className="font-medium capitalize">{selectedSale.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="font-medium">{selectedSale.items.length}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <h3 className="text-lg font-semibold mb-4">Productos</h3>
            <div className="space-y-3 mb-6">
              {selectedSale.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.product_name}</p>
                    <p className="text-sm text-gray-600">
                      {item.quantity} x ${item.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <p className="font-semibold text-primary-600">
                    ${item.subtotal.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${selectedSale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IVA (21%):</span>
                <span className="font-medium">${selectedSale.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>TOTAL:</span>
                <span className="text-primary-600">${selectedSale.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Botón descargar */}
            <button
              onClick={() => handleDownloadPDF(selectedSale.id)}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              <Download size={20} />
              Descargar Ticket PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;