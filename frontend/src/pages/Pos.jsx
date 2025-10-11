import { useState, useEffect, useRef } from 'react';
import { productsAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Search, Trash2, Plus, Minus, ShoppingCart, Printer, Download, X } from 'lucide-react';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const barcodeInputRef = useRef(null);

  const IVA_RATE = 0.21;

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ active: true });
      setProducts(response.data);
    } catch (error) {
      console.error('Error cargando productos:', error);
      toast.error('Error al cargar productos');
    }
  };

  // Búsqueda por código de barras
  const handleBarcodeSearch = async (e) => {
    e.preventDefault();
    
    if (!barcode || barcode.length !== 13) {
      toast.error('Ingrese un código EAN-13 válido (13 dígitos)');
      return;
    }

    try {
      const response = await productsAPI.getByEAN(barcode);
      addToCart(response.data);
      setBarcode('');
      barcodeInputRef.current?.focus();
    } catch (error) {
      toast.error('Producto no encontrado');
      setBarcode('');
    }
  };

  // Agregar producto al carrito
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error(`Stock insuficiente. Disponible: ${product.stock}`);
        return;
      }
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (product.stock < 1) {
        toast.error('Producto sin stock');
        return;
      }
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        price: product.sale_price,
        quantity: 1,
        stock: product.stock
      }]);
    }
  };

  // Actualizar cantidad
  const updateQuantity = (productId, delta) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity < 1) return item;
        if (newQuantity > item.stock) {
          toast.error('Stock insuficiente');
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  // Eliminar del carrito
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * IVA_RATE;
  const total = subtotal + tax;

  // Procesar venta
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setLoading(true);

    try {
      const saleData = {
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        payment_method: 'efectivo'
      };

      const response = await salesAPI.create(saleData);
      setLastSale(response.data.sale);
      setShowTicket(true);
      setCart([]);
      toast.success('¡Venta procesada exitosamente!');
      loadProducts(); // Recargar para actualizar stocks
    } catch (error) {
      console.error('Error procesando venta:', error);
      toast.error(error.response?.data?.error || 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  // Imprimir ticket
  const handlePrint = () => {
    window.print();
  };

  // Descargar PDF
  const handleDownloadPDF = async () => {
    if (!lastSale) return;

    try {
      const response = await salesAPI.getTicketPDF(lastSale.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket_${lastSale.id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      toast.error('Error al descargar PDF');
    }
  };

  // Filtrar productos por búsqueda
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Punto de Venta</h1>
        <p className="text-gray-600 mt-1">Sistema POS con escaneo de códigos de barras</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de productos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Búsqueda por código de barras */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <form onSubmit={handleBarcodeSearch} className="flex gap-2">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
                placeholder="Escanear o ingresar código EAN-13 (13 dígitos)"
                maxLength={13}
                className="flex-1 px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-lg"
                autoFocus
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Buscar
              </button>
            </form>
            <p className="text-xs text-blue-700 mt-2">
              💡 Enfoque automático para escaneo rápido. Presione Enter para buscar.
            </p>
          </div>

          {/* Búsqueda manual */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Search className="text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos por nombre o SKU..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Lista de productos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-3 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
                  disabled={product.stock < 1}
                >
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                  <p className="text-lg font-bold text-primary-600 mt-2">
                    ${product.sale_price.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Stock: {product.stock}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de carrito */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 h-fit sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Carrito</h2>
            <span className="ml-auto bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
              {cart.length} items
            </span>
          </div>

          {/* Items del carrito */}
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                Carrito vacío
              </p>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      ${item.price.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product_id, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product_id, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totales */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">IVA (21%):</span>
              <span className="font-medium">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>TOTAL:</span>
              <span className="text-primary-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Botón finalizar venta */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full mt-4 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Procesando...' : 'Finalizar Venta'}
          </button>
        </div>
      </div>

      {/* Modal de ticket */}
      {showTicket && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Venta Completada</h2>
              <button
                onClick={() => setShowTicket(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* Ticket */}
            <div className="print-area bg-gray-50 p-6 rounded-lg mb-4 border border-gray-200">
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold">🌿 Tienda Natural</h3>
                <p className="text-sm text-gray-600">Productos Naturales y Dietéticos</p>
                <p className="text-xs text-gray-500 mt-2">
                  Ticket #{lastSale.id}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(lastSale.created_at).toLocaleString('es-AR')}
                </p>
              </div>

              <div className="border-t border-b border-gray-300 py-3 my-3">
                {lastSale.items.map((item, index) => (
                  <div key={index} className="mb-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.product_name}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{item.quantity} x ${item.unit_price.toFixed(2)}</span>
                      <span>${item.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${lastSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (21%):</span>
                  <span>${lastSale.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2 mt-2">
                  <span>TOTAL:</span>
                  <span>${lastSale.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center mt-4 text-xs text-gray-600">
                <p>¡Gracias por su compra!</p>
                <p>Vuelva pronto</p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Printer size={18} />
                Imprimir
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download size={18} />
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;