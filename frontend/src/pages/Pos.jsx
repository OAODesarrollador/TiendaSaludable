import { useState, useEffect, useRef } from 'react';
import { productsAPI, salesAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Search, Trash2, Plus, Minus, ShoppingCart, Printer, Download, X, Calculator } from 'lucide-react';
import logo from '../assets/Avenia.png';
import { formatFechaHoraAR } from "../config/timezoneF";

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
  const [calcTotal, setCalcTotal] = useState(0);
  const [calcQuantityInput, setCalcQuantityInput] = useState('1');
  const [calcQuantityNumber, setCalcQuantityNumber] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [editingProductId, setEditingProductId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');


  const barcodeInputRef = useRef(null);
  const ticketRef = useRef(null);
  const IVA_RATE = 0.21;

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    setCalcTotal(calcPrice * (Number.isFinite(calcQuantityNumber) ? calcQuantityNumber : 0));
  }, [calcPrice, calcQuantityNumber]);

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
    const quantity = typeof customQuantity === 'string' ? parseFloat(customQuantity) : customQuantity;
    const q = Number.isFinite(quantity) ? Number(quantity) : 0;

    if (existingItem) {
      const newQuantity = existingItem.quantity + q;
      if (newQuantity > product.stock) {
        toast.error(`Stock insuficiente. Disponible: ${product.stock}`);
        return;
      }
      setCart(cart.map(item => item.product_id === product.id ? { ...item, quantity: newQuantity, price: salePrice } : item));
    } else {
      if (product.stock < q) {
        toast.error('Producto sin stock');
        return;
      }
      setCart([...cart, { 
        product_id: product.id, 
        name: product.name, 
        price: salePrice, 
        quantity: q, 
        stock: product.stock,
        discount: 0,
        discountType: 'percentage'
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

  const calculateItemDiscount = (item) => {
    const lineTotal = item.price * item.quantity;
    if (item.discountType === 'percentage') {
      return (lineTotal * (item.discount || 0)) / 100;
    }
    return item.discount || 0;
  };

  const calculateItemTotal = (item) => {
    const lineTotal = item.price * item.quantity;
    return lineTotal - calculateItemDiscount(item);
  };

  const subtotal = cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalDiscount = discount;
  const subtotalAfterDiscount = subtotal - totalDiscount;
  const subtotalNoTax = subtotalAfterDiscount / (1 + IVA_RATE);
  const tax = subtotalAfterDiscount - subtotalNoTax;


 const isExpiringSoon = (expirationDate) => {
  if (!expirationDate) return false;
  const parts = expirationDate.split(/[- T:]/);
  if (parts.length < 3) return false;

  const [year, month, day] = parts;
  const expireDate = new Date(year, month - 1, day);
  const today = new Date();
  const diffDays = (expireDate - today) / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= 7;
};



  // ===========================
  // MODIFICADO: enviar price/discount al backend
  // ===========================
  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('El carrito está vacío');
    setLoading(true);
    try {
      const saleData = { 
        items: cart.map(i => ({
          product_id: i.product_id, 
          quantity: i.quantity,
          price: i.price,                      // ✅ precio real usado en POS
          discount: i.discount || 0,           // ✅ valor de descuento
          discountType: i.discountType || 'percentage' // ✅ tipo de descuento
        })),
        // Descuento global opcional (si lo usás):
        order_discount: totalDiscount || 0,     // ✅ descuento total aplicado en el carrito
        payment_method: paymentMethod

      };
      
      const response = await salesAPI.create(saleData);
      
      // Enriquecer la respuesta del backend con los datos del carrito para el ticket
      const enrichedSale = {
        ...response.data.sale,
        items: cart.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          discount: calculateItemDiscount(i)
        })),
        discount: totalDiscount,
        subtotal: subtotal,
        subtotalNoTax: subtotalNoTax,
        tax: tax,
        total: subtotalAfterDiscount
      };
      
      setLastSale(enrichedSale);
      setShowTicket(true);
      setCart([]);
      setDiscount(0);
      toast.success('¡Venta procesada exitosamente!');
      loadProducts();
    } catch {
      toast.error('Error al procesar la venta');
    } finally { setLoading(false); }
  };

  const handlePrintTicket = () => {
    if (!lastSale || !ticketRef.current) return;

    const printWindow = window.open('', '_blank', 'width=400,height=700,left=100,top=50,resizable=yes,scrollbars=yes');
    if (!printWindow) return toast.error('No se pudo abrir la ventana de impresión');

    const saleItems = lastSale.items ?? lastSale.line_items ?? lastSale.details ?? [];

    const fechaHora = formatFechaHoraAR(
  new Date(lastSale?.created_at ?? Date.now())
);


    
    const items = saleItems.map((it, idx) => {
      const name = it.name ?? it.product_name ?? it.product?.name ?? `Producto ${idx+1}`;
      const qty = (it.quantity ?? it.qty ?? it.amount ?? 1);
      const price = (it.price ?? it.unit_price ?? it.product?.price ?? 0);
      const itemDiscount = (it.discount ?? 0);
      const lineTotal = (price * qty) - itemDiscount;
      
      return `
        <div style="padding:4px 0;">
          <div style="display:flex; justify-content:space-between; font-size:13px;">
            <div style="width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
            <div style="width:16%; text-align:right;">${Number(qty).toFixed(3).replace(/\.?0+$/,"")}</div>
            <div style="width:33%; text-align:right;">${lineTotal.toFixed(2)}</div>
          </div>
          ${itemDiscount > 0 ? `
            <div style="font-size:11px; color:#16a34a; text-align:right; padding-right:0;">
              Desc. producto: -${itemDiscount.toFixed(2)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const saleSubtotal = lastSale.subtotal ?? subtotal;
    const saleDiscount = lastSale.discount ?? 0;
    const saleSubtotalNoTax = lastSale.subtotalNoTax ?? subtotalNoTax;
    const saleTax = lastSale.tax ?? tax;
    const saleTotal = lastSale.total ?? subtotalAfterDiscount;

    const content = `
      <div style="font-family: Arial, sans-serif; font-size: 13px; color:black; width:280px; margin: auto; padding:10px; background:#fff;">
        <div style="text-align:center; margin-bottom:8px;">
          <div>
            <img src="${logo}" alt="logo" style="width:130px; height:auto; padding:15px; "/>
          </div>
          <p style="font-size:11px; margin:0;"> Faustino Allende 1034 - Córdoba, Argentina</p>
          <p style="font-size:11px; margin:0;">Tel: +54 351 654 4601</p>
          <p style="font-size:11px;">Instagram: @avenia.ar</p>
        </div>
        <hr style="border:1px solid gray; margin:6px 0;">

        <div style="font-size:13px; solid; margin-bottom:8px;">
          <span style="font-weight:bold;">Ticket #${lastSale.id}</span> - Fecha: ${fechaHora}
        </div>

        <hr style="border: 1px solid gray; width: 100%; margin-top: 8px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; padding:4px 0;">
          <div style="width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Producto</div>
          <div style="width:16%; text-align:right;">Cantidad</div>
          <div style="width:33%; text-align:right;">Total</div>
        </div>
        <div style=" padding-top:3px;">
          ${items}
        </div>
        <hr style="border: 1px solid gray; width: 100%; margin-top: 8px;">

        <div style="margin-top:12px; font-size:13px;">
          <div style="display:flex; justify-content:space-between;">
            <span>Subtotal:</span>
            <span>${saleSubtotal.toFixed(2)}</span>
          </div>
          ${saleDiscount > 0 ? `
            <div style="display:flex; justify-content:space-between; color:#16a34a; font-weight:bold;">
              <span>Descuento Total:</span>
              <span>-${saleDiscount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between;">
            <span>Subtotal sin IVA:</span>
            <span>${saleSubtotalNoTax.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>IVA (21%):</span>
            <span>${saleTax.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:bold; margin-top:8px;">
            <span>TOTAL:</span>
            <span>${saleTotal.toFixed(2)}</span>
          </div>
        </div>
        <hr style="border: 1px solid gray; width: 100%; margin-top: 8px;">
        <div style="padding:8px; font-size:11px; solid">
          <div>Forma de pago: ${lastSale.payment_method ?? '---'}</div>
        </div>
        <hr style="border: 1px solid gray; width: 100%; margin-top: auto;">
        <div style="text-align:center; margin-top:6px; font-size:12px;">
          <p>Gracias por su compra...!</p>
          <br>
          <p>TICKET NO VALIDO COMO FACTURA</p>
        </div>
      </div>
    `;

    const styles = `
      <style>
        @media print {
          @page { size: 80mm auto; margin: 5mm; }
          body { -webkit-print-color-adjust: exact; margin:0; padding:0; }
          .no-print { display: none !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          background:#f5f5f5; 
          font-family: Arial, sans-serif;
          padding: 0;
          margin: 0;
        }
        .print-button {
          position: fixed;
          top: 10px;
          right: 10px;
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          z-index: 1000;
        }
        .print-button:hover {
          background: #1d4ed8;
        }
      </style>
    `;

    const buttonScript = `
      <script>
        function printTicket() {
          window.print();
        }
        window.onload = function() {
          window.print();
        };
      </script>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket de Venta</title>
          ${styles}
        </head>
        <body>
          <button class="print-button no-print" onclick="printTicket()">🖨️ Imprimir</button>
          ${content}
          ${buttonScript}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = async () => {
    if (!lastSale) return;
    try {
      if (salesAPI.getTicketPDF) {
        const response = await salesAPI.getTicketPDF(lastSale.id, { responseType: 'arraybuffer' });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ticket_${lastSale.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return;
      }
    } catch (error) {
      console.warn('No se pudo obtener PDF del backend, usando fallback de impresión.', error);
    }
    if (ticketRef.current) {
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        toast.error('No se pudo abrir la ventana (bloqueador?)');
        return;
      }
      const headerLogoSVG = `
        <div style="display:flex; justify-content:center; margin-bottom:6px;">
          <img src="${logo}" alt="logo" width="120" height="40" />
        </div>
      `;
      const companyDetails = `
        <div style="text-align:center; font-family: Arial, sans-serif; margin-bottom:6px;">
         <img src="${logo}" alt="logo" width="120" height="40" /><br/>
          <span style="font-size:11px;">Faustino Allende 1034 - Córdoba, Argentina</span><br/>
          <span style="font-size:11px;">Tel: +54 351 654 4601</span><br/>
          <span style="font-size:11px;">Instagram: @avenia.ar</span><br/>
        </div>
      `;
      const content = `<div style="font-family:Arial, sans-serif; font-size:12px; width:280px; padding:8px;">${headerLogoSVG}${companyDetails}${ticketRef.current.innerHTML}</div>`;
      const styles = `<style>@media print {@page { size: 80mm auto; margin: 5mm; }} body { margin:0; padding:0; }</style>`;
      printWindow.document.open();
      printWindow.document.write(`<html><head><title>Ticket</title>${styles}</head><body>${content}</body></html>`);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
      return;
    }
    handlePrintTicket();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCalculator = (product) => {
    setSelectedProduct(product);
    setCalcPrice(product.sale_price);
    setCalcQuantityInput('1');
    setCalcQuantityNumber(1);
    setCalcTotal(product.sale_price);
    setShowCalc(true);
  };

  const parseQuantityString = (str) => {
    if (typeof str !== 'string') str = String(str ?? '');
    const cleaned = str.trim().replace(',', '.');
    const match = cleaned.match(/^(\d+)(\.(\d{0,3}))?$/);
    if (!match) return { valid: false, value: 0 };
    const value = parseFloat(cleaned);
    if (!Number.isFinite(value)) return { valid: false, value: 0 };
    const rounded = Math.round(value * 1000) / 1000;
    return { valid: true, value: rounded };
  };

  const handleCalcQuantityChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      setCalcQuantityInput('');
      setCalcQuantityNumber(0);
      return;
    }
    const candidate = raw.replace(/[^0-9\.,]/g, '').replace(/\,+/g, ',');
    const candidateNormalized = candidate.replace(',', '.');
    const parts = candidateNormalized.split('.');
    if (parts.length > 1) {
      const decimals = parts[1].slice(0, 3);
      const normalized = parts[0] + (decimals ? '.' + decimals : '');
      const { valid, value } = parseQuantityString(normalized);
      setCalcQuantityInput(raw);
      setCalcQuantityNumber(valid ? value : 0);
    } else {
      const { valid, value } = parseQuantityString(candidateNormalized);
      setCalcQuantityInput(raw);
      setCalcQuantityNumber(valid ? value : 0);
    }
  };

  const handleConfirmCalc = () => {
    if (!selectedProduct) return;
    const qty = calcQuantityNumber;
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Ingrese una cantidad válida mayor que 0');
      return;
    }
    if (qty > selectedProduct.stock) {
      toast.error(`Stock insuficiente. Disponible: ${selectedProduct.stock}`);
      return;
    }
    addToCart(selectedProduct, qty, calcPrice);
    setShowCalc(false);
    toast.success('Producto agregado con precio calculado');
  };

  const openDiscountModal = (productId = null) => {
    setEditingProductId(productId);
    if (productId) {
      const item = cart.find(i => i.product_id === productId);
      if (item) {
        setDiscountType(item.discountType || 'percentage');
        setDiscountValue(item.discount || 0);
      }
    } else {
      setDiscountType('percentage');
      setDiscountValue(0);
    }
    setShowDiscountModal(true);
  };

  const applyDiscount = () => {
    const value = parseFloat(discountValue) || 0;
    
    if (editingProductId) {
      // Descuento por producto
      setCart(cart.map(item => {
        if (item.product_id === editingProductId) {
          const lineTotal = item.price * item.quantity;
          let maxDiscount = lineTotal;
          
          if (discountType === 'percentage') {
            if (value > 100) {
              toast.error('El descuento no puede ser mayor al 100%');
              return item;
            }
          } else {
            if (value > maxDiscount) {
              toast.error(`El descuento no puede ser mayor a $${maxDiscount.toFixed(2)}`);
              return item;
            }
          }
          
          return {
            ...item,
            discount: value,
            discountType: discountType
          };
        }
        return item;
      }));
      toast.success('Descuento aplicado al producto');
    } else {
      // Descuento total
      if (discountType === 'percentage') {
        if (value > 100) {
          toast.error('El descuento no puede ser mayor al 100%');
          return;
        }
        setDiscount((subtotal * value) / 100);
      } else {
        if (value > subtotal) {
          toast.error(`El descuento no puede ser mayor a $${subtotal.toFixed(2)}`);
          return;
        }
        setDiscount(value);
      }
      toast.success('Descuento total aplicado');
    }
    
    setShowDiscountModal(false);
    setDiscountValue(0);
  };

  // --- Calcular mensaje de vencimiento ---
const getExpirationMessage = (expirationDate) => {
  if (!expirationDate) return null;

  // Normalizar formato "YYYY-MM-DD HH:MM:SS"
  const [year, month, day] = expirationDate.split(/[- T:]/);
  const expireDate = new Date(year, month - 1, day);
  const today = new Date();

  // Diferencia en días redondeada
  const diffDays = Math.floor((expireDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "❌ Producto vencido";
  if (diffDays === 0) return "⚠️ Vence hoy";
  if (diffDays === 1) return "⚠️ Vence mañana";
  if (diffDays <= 7) return `⚠️ Vence en ${diffDays} días`;
  return null;
};


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Punto de Venta</h1>
        <p className="text-gray-600 mt-1">Sistema POS con escaneo de códigos de barras</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Search className="text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={async (e) => {
                  if (e.key === 'Enter' && searchTerm.length === 13 && /^\d+$/.test(searchTerm)) {
                    try {
                      const response = await productsAPI.getByEAN(searchTerm);
                      addToCart(response.data);
                      setSearchTerm('');
                      toast.success('Producto agregado desde código de barras');
                    } catch (error) {
                      toast.error('Código de barras no encontrado');
                    }
                  }
                }}
                placeholder="Buscar por nombre, SKU o código EAN-13..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {products
                .filter(p =>
                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.sku.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(product => (
                <div
                    key={product.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      isExpiringSoon(product.expiration_date)
                        ? ' text-white border-red-700'
                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50 BLINK'
                    }`}
                >

                    <p className="font-medium text-sm text-gray-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                    <p className="text-lg font-bold text-blue-600 mt-2">
                      ${product.sale_price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">Stock: {product.stock}</p>

                    {getExpirationMessage(product.expiration_date) && (
                      <p
                        className={`text-xs font-semibold mt-1 flex items-center gap-1 px-2 py-1 rounded blink ${
                          getExpirationMessage(product.expiration_date).includes("❌")
                            ? "bg-gray-800 text-red-400"
                            : "bg-red-700 red-100 text-red-500"
                        }`}
                      >
                        {getExpirationMessage(product.expiration_date)}
                      </p>
                    )}



                    <div className="flex gap-2 mt-2">
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

        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-gray-100 h-fit sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Carrito</h2>
            <span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {cart.length} items
            </span>
          </div>

          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Carrito vacío</p>
            ) : (
              cart.map(item => {
                const itemDiscount = calculateItemDiscount(item);
                const itemTotal = calculateItemTotal(item);
                return (
                  <div key={item.product_id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </p>
                        {itemDiscount > 0 && (
                          <p className="text-xs text-black font-medium">
                            Desc: -${itemDiscount.toFixed(2)} ({item.discountType === 'percentage' ? `${item.discount}%` : 'fijo'})
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateQuantity(item.product_id, -1)} 
                          className="w-7 h-7 bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center font-semibold text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product_id, 1)} 
                          className="w-7 h-7 bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        {itemDiscount > 0 && (
                          <p className="text-xs text-black line-through">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        )}
                        <p className="text-base font-bold text-blue-600">
                          ${itemTotal.toFixed(2)}
                        </p>
                      </div>

                      <button 
                        onClick={() => openDiscountModal(item.product_id)} 
                        className="w-7 h-7 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200 flex items-center justify-center flex-shrink-0"
                        title="Aplicar descuento"
                      >
                        %
                      </button>

                      <button 
                        onClick={() => removeFromCart(item.product_id)} 
                        className="w-7 h-7 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center flex-shrink-0"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Descuento Total:</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Subtotal sin IVA:</span>
              <span>${subtotalNoTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA (21%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>TOTAL:</span>
              <span className="text-blue-600">${subtotalAfterDiscount.toFixed(2)}</span>
            </div>
            
            <button
              onClick={() => openDiscountModal(null)}
              disabled={cart.length === 0}
              className="w-full py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              <Calculator size={16} /> Aplicar Descuento Total
            </button>
          </div>
          
         
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'efectivo', label: '💵 Efectivo', color: 'green' },
                  { key: 'debito', label: '💳 Débito', color: 'blue' },
                  { key: 'transferencia', label: '🏦 Transferencia', color: 'indigo' },
                  { key: 'qr', label: '📱 QR', color: 'purple' },
                  { key: 'tarjeta_credito', label: '💳 Crédito', color: 'orange' }, // opcional
                ].map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setPaymentMethod(key)}
                    className={`py-2 rounded-lg border font-medium ${
                      paymentMethod === key
                        ? `bg-${color}-600 text-white border-${color}-600`
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
         
  
          <div className="flex gap-2 mt-2">  
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || loading}
              className="flex-[3] bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Finalizar Venta'}
            </button>

            <button
              onClick={() => {
                if (cart.length > 0 && window.confirm('¿Estás seguro de cancelar la venta y vaciar el carrito?')) {
                  setCart([]);
                  setDiscount(0);
                  toast.info('Carrito vacío');
                }
              }}
              disabled={cart.length === 0}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

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
                  type="text"
                  inputMode="decimal"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={calcQuantityInput}
                  onChange={handleCalcQuantityChange}
                  placeholder="Ej: 1.250 o 1,25"
                />
                <p className="text-xs text-gray-500 mt-1">Se permiten coma o punto como separador decimal. Max 3 decimales.</p>
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

      {showDiscountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingProductId ? 'Descuento por Producto' : 'Descuento Total'}
              </h2>
              <button onClick={() => setShowDiscountModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={22} />
              </button>
            </div>

            {editingProductId && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">Producto:</p>
                <p className="font-medium">{cart.find(i => i.product_id === editingProductId)?.name}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 block mb-2">Tipo de descuento:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 py-2 rounded-lg border ${
                      discountType === 'percentage' 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Porcentaje (%)
                  </button>
                  <button
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 py-2 rounded-lg border ${
                      discountType === 'fixed' 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Monto Fijo ($)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">
                  {discountType === 'percentage' ? 'Porcentaje de descuento:' : 'Monto de descuento:'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Ej: 10 (para 10%)' : 'Ej: 50.00'}
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  onClick={() => setShowDiscountModal(false)} 
                  className="flex-1 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={applyDiscount} 
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTicket && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-lg shadow-lg flex flex-col" role="dialog" aria-modal="true">
            <div className="items-center gap-4 text-center border-b border-gray-100 pb-4 mb-4">
              <div className="flex  mb-4 justify-center items-center">
                <img src={logo} alt="logo" className="h-12 w-auto " />
              </div>
              <div className="flex-3 text-center">
                <p className="text-sm text-gray-600">Faustino Allende 1034 • Cordoba, Argentina</p>
                <p className="text-sm text-gray-600">Tel: +54 370 4054127</p>
                <p className="text-sm text-gray-600">Instagram: @avenia.ar</p>
              </div>
            </div>

            <div className="d-flex justify-content-between w-100">
              <span>Ticket #{lastSale.id}</span>
              <span>{formatFechaHoraAR(new Date(lastSale?.created_at ?? lastSale?.date ?? Date.now()))}</span>


            </div>

            <div ref={ticketRef} style={{ maxHeight: '52vh', overflowY: 'auto', marginTop: 12 }}>
              <div className="flex justify-between text-sm py-1 border-t border-gray-200 pt-2">
                <div className="w-1/2 truncate">Producto</div>
                
                <div className="w-1/8 text-right">Precio</div>
                <div className="w-1/6 text-right">Cantidad</div>
                <div className="w-1/3 text-right">Total</div>
              </div>

              <div className="border-t border-gray-200 pt-2">
                {(lastSale.items ?? lastSale.line_items ?? lastSale.details ?? []).length === 0 ? (
                  <div>
                    <p className="text-sm text-gray-500">No hay detalle de items en la respuesta de la venta.</p>
                  </div>
                ) : (
                  (lastSale.items ?? lastSale.line_items ?? lastSale.details).map((it, idx) => {
                    const name = it.name ?? it.product_name ?? it.product?.name ?? `Producto ${idx+1}`;
                    const qty = (it.quantity ?? it.qty ?? it.amount ?? 1);
                    const price = (it.price ?? it.unit_price ?? it.product?.price ?? 0);
                    const itemDiscount = (it.discount ?? 0);
                    const lineTotal = (price * qty) - itemDiscount;
                    return (
                      <div key={idx} className="py-1">
                        <div className="flex justify-between text-sm">
                          <div className="w-1/2 truncate">{name}</div>
                          <div className="w-1/8 text-left">${price.toFixed(2)}</div>
                          <div className="w-1/6 text-right">{Number(qty).toFixed(3).replace(/\.?0+$/,"")}</div>                      
                          <div className="w-1/3 text-right">${lineTotal.toFixed(2)}</div>
                        </div>
                        {itemDiscount > 0 && (
                          <div className="text-xs text-black text-right">
                            Desc. producto: -${itemDiscount.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 text-sm border-t border-gray-200 pt-2">
                <div className="flex justify-between"><span>Subtotal:</span><span>${(lastSale.subtotal ?? subtotal).toFixed(2)}</span></div>
                {(lastSale.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>Descuento Total:</span>
                    <span>-${(lastSale.discount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Subtotal sin IVA:</span><span>${(lastSale.subtotalNoTax ?? subtotalNoTax).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>IVA (21%):</span><span>${(lastSale.tax ?? tax).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold mt-2"><span>TOTAL:</span><span>${(lastSale.total ?? subtotalAfterDiscount).toFixed(2)}</span></div>
              </div>

              <div className="border-t border-b-2 border-gray-200 mb-2 mt-2 p-3 text-center">
                <div className='fs-5'>Forma de pago: {lastSale.payment_method ?? '---'}</div>
              </div>
            </div>

            <div className="mt-4 pt-1  flex gap-2">
              <button
                onClick={handlePrintTicket}
                title="Imprimir ticket"
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Imprimir
              </button>
              <button
                onClick={handleDownloadPDF}
                title="Exportar PDF"
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Download size={16} /> Exportar PDF
              </button>
              <button
                onClick={() => { setShowTicket(false); setLastSale(null); }}
                className="flex-1 px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center gap-2"
              >
                <X size={14} /> Cerrar 
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
