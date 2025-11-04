import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Eye, Download, Search, IterationCw } from 'lucide-react';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundState, setRefundState] = useState({
    items: [], // { product_id, product_name, max, selected: bool, quantity: number }
    reason: ''
  });
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    loadSales();
  }, []);

  useEffect(() => {
    // Bloquear scroll del body cuando algún modal está abierto
    if (showModal || showRefundModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showRefundModal]);

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

  // --- Devoluciones: preparar estado ---
  const openRefundModal = () => {
    if (!selectedSale) return;
    // Mapear items: tomar remaining (cantidad disponible a devolver) desde selectedSale.items
    const items = selectedSale.items.map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      max: it.remaining ?? (it.quantity - (it.refunded_quantity || 0)),
      selected: false,
      quantity: 0
    }));
    setRefundState({ items, reason: '' });
    setShowRefundModal(true);
  };

  const toggleSelectItem = (index) => {
    setRefundState(prev => {
      const copy = { ...prev, items: [...prev.items] };
      copy.items[index].selected = !copy.items[index].selected;
      if (!copy.items[index].selected) copy.items[index].quantity = 0;
      else if (copy.items[index].quantity <= 0) copy.items[index].quantity = 1;
      return copy;
    });
  };

  const setItemQuantity = (index, value) => {
    setRefundState(prev => {
      const copy = { ...prev, items: [...prev.items] };
      let qty = parseInt(value, 10);
      if (Number.isNaN(qty)) qty = 0;
      if (qty < 0) qty = 0;
      if (qty > copy.items[index].max) qty = copy.items[index].max;
      copy.items[index].quantity = qty;
      // if qty > 0 ensure selected true
      copy.items[index].selected = qty > 0;
      return copy;
    });
  };

  const handleReasonChange = (e) => {
    setRefundState(prev => ({ ...prev, reason: e.target.value }));
  };

  const submitRefund = async () => {
    if (!selectedSale) return;
    const itemsToReturn = refundState.items
      .filter(i => i.selected && i.quantity > 0)
      .map(i => ({ product_id: i.product_id, quantity: i.quantity }));

    if (itemsToReturn.length === 0) {
      toast.error('Seleccioná al menos un ítem y cantidad a devolver');
      return;
    }

    try {
      const payload = {
        sale_id: selectedSale.id,
        items: itemsToReturn,
        reason: refundState.reason
      };

      const response = await salesAPI.createRefund(selectedSale.id, payload);
      toast.success('Nota de crédito creada correctamente');

      // Actualizar vista: recargar detalle y listado
      const saleResp = await salesAPI.getById(selectedSale.id);
      setSelectedSale(saleResp.data);
      setShowRefundModal(false);
      loadSales();
    } catch (error) {
      console.error('Error creando nota de crédito:', error);
      const msg = (error?.response?.data?.error) || 'Error al crear nota de crédito';
      toast.error(msg);
    }
  };

  // Componente Modal de Detalle usando Portal
  const DetailModal = () => {
    if (!showModal || !selectedSale) return null;

    return createPortal(
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
        style={{ 
          zIndex: 99999,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowModal(false);
            setSelectedSale(null);
          }
        }}
      >
        <div 
          className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
          style={{ 
            position: 'relative',
            zIndex: 100000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Detalle de Venta #{selectedSale.id}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowModal(false); setSelectedSale(null); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>
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
                    {item.quantity} x ${item.unit_price.toFixed(2)} &nbsp;
                    {item.refunded_quantity > 0 && (
                      <span className="text-xs text-red-600">({item.refunded_quantity} devuelto)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Disponible a devolver: {item.remaining}</p>
                </div>
                <p className="font-semibold text-green-600">${item.subtotal.toFixed(2)}</p>
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
              <span className="text-green-600">${selectedSale.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => openRefundModal()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium transition"
            >
              <IterationCw size={20} />
              Crear Nota de Crédito
            </button>

            <button
              onClick={() => handleDownloadPDF(selectedSale.id)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
            >
              <Download size={20} />
              Descargar Ticket PDF
            </button>
          </div>

          {/* Mostrar devoluciones existentes */}
          {selectedSale.refunds && selectedSale.refunds.length > 0 && (
            <>
              <h4 className="mt-6 font-semibold">Notas de crédito (devoluciones)</h4>
              <div className="space-y-3 mt-3">
                {selectedSale.refunds.map((r) => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-sm font-medium">Nota #{r.id}</div>
                        <div className="text-xs text-gray-500">Fecha: {new Date(r.created_at).toLocaleString('es-AR')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">${r.total.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Motivo: {r.reason || '-'}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs">
                      {r.items && r.items.map(it => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.product_name} x {it.quantity}</span>
                          <span>${it.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    );
  };

  // Componente Modal de Devolución usando Portal
  const RefundModal = () => {
    if (!showRefundModal) return null;

    return createPortal(
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
        style={{ 
          zIndex: 99999,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowRefundModal(false);
          }
        }}
      >
        <div 
          className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
          style={{ 
            position: 'relative',
            zIndex: 100000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Crear Nota de Crédito - Venta #{selectedSale?.id}</h3>
            <button 
              onClick={() => setShowRefundModal(false)} 
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">Seleccioná los productos y cantidades a devolver. Se actualizará el stock automáticamente.</p>

          <div className="space-y-3">
            {refundState.items.map((it, idx) => (
              <div key={it.product_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                <div className="w-6">
                  <input 
                    type="checkbox" 
                    checked={it.selected} 
                    onChange={() => toggleSelectItem(idx)}
                    className="w-4 h-4 text-green-600 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{it.product_name}</div>
                  <div className="text-xs text-gray-500">Max a devolver: {it.max}</div>
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    min={0}
                    max={it.max}
                    value={it.quantity}
                    onChange={(e) => setItemQuantity(idx, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo (opcional)</label>
            <input
              type="text"
              value={refundState.reason}
              onChange={handleReasonChange}
              placeholder="Ej: Producto dañado, devolución parcial, cambio, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={submitRefund}
              className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium transition"
            >
              Confirmar Devolución
            </button>
            <button
              onClick={() => setShowRefundModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 text-center">Historial de Ventas</h1>
        <p className="text-gray-600 mt-1 text-center">Consulte todas las transacciones realizadas</p>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleApplyFilters}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 transition"
            >
              <Search size={20} />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de ventas */}
<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-green-100 text-gray-900 sticky top-0 z-10">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">ID</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Fecha y Hora</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Vendedor</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Items</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Subtotal</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">IVA</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Total</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Pago</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Acciones</th>
        </tr>
      </thead>
<tbody className="bg-white divide-y divide-gray-200">
  {sales.map((sale) => (
    <tr
      key={sale.id}
      className={`transition ${
        sale.type === 'Nota de Crédito'
          ? 'bg-red-50 hover:bg-red-100'
          : 'hover:bg-green-100'
      }`}
    >
      <td className="px-6 py-1 whitespace-nowrap text-sm font-medium text-gray-900">
        #{sale.id}
      </td>
      <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
        {new Date(sale.created_at).toLocaleString('es-AR')}
      </td>
      <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
        {sale.seller_name}
      </td>
      <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900 text-center">
        {sale.type === 'Nota de Crédito' ? '-' : sale.items?.length || 0}
      </td>
      <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
        ${Number(sale.subtotal || 0).toFixed(2)}
      </td>
      <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
        ${Number(sale.tax || 0).toFixed(2)}
      </td>
      <td
        className={`px-6 py-1 whitespace-nowrap text-sm font-semibold ${
          sale.type === 'Nota de Crédito' ? 'text-red-600' : 'text-green-600'
        }`}
      >
        ${Number(sale.total || 0).toFixed(2)}
      </td>
      <td className="px-6 py-1 whitespace-nowrap">
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            sale.type === 'Nota de Crédito'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {sale.type === 'Nota de Crédito'
            ? 'Nota de Crédito'
            : `${(sale.payment_method || '').toUpperCase()}`}
        </span>
      </td>

      <td className="px-6 py-1 whitespace-nowrap text-sm">
        <div className="flex items-center gap-2">
          {sale.type === 'Venta' && (
            <>
              <button
                onClick={() => handleViewDetails(sale.id)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Ver detalle"
              >
                <Eye size={18} />
              </button>
              <button
                onClick={() => handleDownloadPDF(sale.id)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                title="Descargar ticket"
              >
                <Download size={18} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  ))}

  {sales.length === 0 && (
    <tr>
      <td colSpan="9" className="text-center py-12 text-gray-500">
        No se encontraron registros
      </td>
    </tr>
  )}
</tbody>



    </table>

    {sales.length === 0 && (
      <div className="text-center py-12 text-gray-500">
        No se encontraron ventas en el período seleccionado
      </div>
    )}
  </div>
</div>

      {/* Modales renderizados con Portal */}
      <DetailModal />
      <RefundModal />
    </div>
  );
};

export default Sales;