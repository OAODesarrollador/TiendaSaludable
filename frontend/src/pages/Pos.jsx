import { useState, useEffect, useRef } from 'react';
import { productsAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Search, Trash2, Plus, Minus, ShoppingCart, Printer, Download, X, Calculator } from 'lucide-react';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showCalc, setShowCalc] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [calcPrice, setCalcPrice] = useState(0);
  //const [calcQuantity, setCalcQuantity] = useState(1);
  const [calcTotal, setCalcTotal] = useState(0);

  // reemplazar: const [calcQuantity, setCalcQuantity] = useState(1);
  // por:
  const [calcQuantity, setCalcQuantityInput] = useState('1'); // valor tal cual se muestra en el input (string)
  const [calcQuantityNumber, setCalcQuantityNumber] = useState(1);  // valor numérico derivado


  const barcodeInputRef = useRef(null);
  const IVA_RATE = 0.21;

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      setCalcTotal(calcPrice * calcQuantity);
    }
  }, [calcPrice, calcQuantity]);
  

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ active: true });
      setProducts(response.data);
    } catch (error) {
      console.error('Error cargando productos:', error);
      toast.error('Error al cargar productos');
    }
  };

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

  const addToCart = (product, customQuantity = 1, customPrice = null) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    const salePrice = customPrice ?? product.sale_price;
    const quantity = customQuantity;

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        toast.error(`Stock insuficiente. Disponible: ${product.stock}`);
        return;
      }
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: newQuantity, price: salePrice }
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
        price: salePrice,
        quantity,
        stock: product.stock
      }]);
    }
  };

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

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotalNoTax = subtotal / (1 + IVA_RATE);
  const tax = subtotal - subtotalNoTax;

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
      loadProducts();
    } catch (error) {
      console.error('Error procesando venta:', error);
      toast.error(error.response?.data?.error || 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

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

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCalculator = (product) => {
    setSelectedProduct(product);
    setCalcPrice(product.sale_price);
    setCalcQuantity(1);
    setCalcTotal(product.sale_price);
    setShowCalc(true);
  };

  const handleConfirmCalc = () => {
    addToCart(selectedProduct, calcQuantity, calcPrice);
    setShowCalc(false);
    toast.success('Producto agregado con precio calculado');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Punto de Venta</h1>
        <p className="text-gray-600 mt-1">Sistema POS con escaneo de códigos de barras</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de productos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Búsqueda */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Search className="text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar productos por nombre o SKU..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                  <p className="text-lg font-bold text-blue-600 mt-2">
                    ${product.sale_price.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">Stock: {product.stock}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addToCart(product)}
                      className="flex-1 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => openCalculator(product)}
                      className="flex-1 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center justify-center gap-1 text-sm"
                    >
                      <Calculator size={14} /> Kg/Lt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel carrito */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 h-fit sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Carrito</h2>
            <span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {cart.length} items
            </span>
          </div>

          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Carrito vacío</p>
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
                    <button onClick={() => updateQuantity(item.product_id, -1)} className="w-8 h-8 bg-gray-100 rounded hover:bg-gray-200"><Minus size={16} /></button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, 1)} className="w-8 h-8 bg-gray-100 rounded hover:bg-gray-200"><Plus size={16} /></button>
                    <button onClick={() => removeFromCart(item.product_id)} className="w-8 h-8 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totales */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotalNoTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA (21%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>TOTAL:</span>
              <span className="text-blue-600">${subtotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Finalizar Venta'}
          </button>
        </div>
      </div>

      {/* Modal Calculadora */}
      {showCalc && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Calcular precio por Kg/Litro</h2>
              <button onClick={() => setShowCalc(false)} className="text-gray-500 hover:text-gray-700"><X size={22} /></button>
            </div>

            <p className="text-sm mb-2 text-gray-600">Producto seleccionado:</p>
            <p className="font-medium mb-4">{selectedProduct.name}</p>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Precio por Kg/Lt:</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={calcPrice}
                  onChange={(e) => setCalcPrice(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Cantidad (Kg/Lt):</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={calcQuantity}
                  onChange={(e) => setCalcQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="text-lg font-bold text-center mt-3">
                Precio Final: ${calcTotal.toFixed(2)}
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCalc(false)} className="flex-1 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button onClick={handleConfirmCalc} className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
