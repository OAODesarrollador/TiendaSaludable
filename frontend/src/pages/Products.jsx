import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { productsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Printer, Camera } from 'lucide-react';
import Barcode from 'react-barcode';
import api from '../services/api';
import ProductModal from '../components/ProductModal';
import BarcodeScanner from '../components/BarcodeScanner';
import AppModal from '../components/AppModal';
import '../styles/Layout.css'

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Modal & form states
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    ean13: '',
    name: '',
    category: '',
    description: '',
    purchase_price: '',
    sale_price: '',
    stock: '',
    min_stock: '10',
    expiration_date: '',
    supplier: ''
  });

  // Estados para el modal de impresión
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Estado para el escáner de códigos de barras
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    // Bloquear scroll del body cuando el modal está abierto
    if (showModal || showPrintModal || showScanner) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal, showPrintModal, showScanner]);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ active: true });
      setProducts(response.data);
    } catch (error) {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await productsAPI.getCategories();
      setCategories(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  // Función para manejar código de barras escaneado
  const handleBarcodeDetected = (code) => {
    console.log('Código detectado:', code);
    
    // Buscar el producto por EAN13 o SKU
    const foundProduct = products.find(
      (p) => p.ean13 === code || p.sku === code
    );

    if (foundProduct) {
      setSelectedProduct(foundProduct);
      setSearchTerm(code);
      toast.success(`Producto encontrado: ${foundProduct.name}`);
      
      // Scroll hacia el producto en la tabla (opcional)
      setTimeout(() => {
        const productRow = document.querySelector(`[data-product-id="${foundProduct.id}"]`);
        if (productRow) {
          productRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      toast.warning(`No se encontró producto con código: ${code}`);
      setSearchTerm(code);
    }
  };

  // Abrir modal para nuevo producto
  const openNewProductModal = () => {
    resetForm();
    setEditingProduct(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      ean13: '',
      category: '',
      description: '',
      purchase_price: '',
      sale_price: '',
      stock: '',
      min_stock: '10',
      expiration_date: '',
      supplier: ''
    });
    setEditingProduct(null);
  };

  // Función para normalizar el input de precio (reemplaza coma por punto)
  const normalizePriceInput = (value) => {
    return value.replace(',', '.');
  };

  // Función para formatear el precio con 2 decimales
  const formatPrice = (value) => {
    if (!value) return '';
    const normalized = normalizePriceInput(value);
    const number = parseFloat(normalized);
    if (isNaN(number)) return value;
    return number.toFixed(2);
  };

  // 🔹 Maneja los cambios en el formulario y actualiza el precio de venta automáticamente
const handleChange = async (e) => {
  const { name, value } = e.target;
  const normalized = name === 'purchase_price' ? normalizePriceInput(value) : value;

  setFormData(prev => ({ ...prev, [name]: normalized }));

  // Si cambian la categoría o el precio de compra → recalcular precio de venta
  if ((name === 'purchase_price' && formData.category) || (name === 'category' && formData.purchase_price)) {
    try {
      const res = await api.get("/coeficientes");
      const json = res.data;

      const data = Array.isArray(json) ? json : json.data || json.coefficients || [];

      const selectedCategory = name === 'category' ? value : formData.category;
      const coefRow = data.find(c => c.category === selectedCategory);

      const coef = coefRow ? parseFloat(coefRow.coefficient) : 1.0;

      const purchase = parseFloat(name === 'purchase_price' ? normalized : formData.purchase_price || 0);
      const sale = Math.ceil((purchase * coef) / 50) * 50;

      setFormData(prev => ({
        ...prev,
        sale_price: sale.toFixed(2)
      }));
    } catch (error) {
      console.error('Error al obtener coeficientes:', error);
    }
  }
};


  // Manejar el blur para formatear precios automáticamente
  const handlePriceBlur = (e) => {
    const { name, value } = e.target;
    if (value) {
      const formatted = formatPrice(value);
      setFormData(prev => ({ ...prev, [name]: formatted }));
    }
  };

  const parseDecimal = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(',', '.')) || 0;
};


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación mínima
    if (!formData.sku || !formData.name || !formData.sale_price) {
      toast.error('Completa los campos obligatorios (SKU, Nombre, Precio de venta).');
      return;
    }

    try {
      // Convertir a números donde corresponda
    const payload = {
      ...formData,
      purchase_price: parseFloat(normalizePriceInput(formData.purchase_price || '0')),
      sale_price: parseFloat(normalizePriceInput(formData.sale_price || '0')),
      stock: parseDecimal(formData.stock),
      min_stock: parseDecimal(formData.min_stock),
    };


      if (editingProduct) {
        await productsAPI.update(editingProduct.id, payload);
        toast.success('Producto actualizado exitosamente');

      } else {
        await productsAPI.create(payload);
        toast.success('Producto creado exitosamente');
      }

      setShowModal(false);
      resetForm();
      await loadProducts();
      await loadCategories();
    } catch (error) {
      console.error('Error guardando producto:', error);
      toast.error(error?.response?.data?.error || 'Error al guardar producto');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku ?? '',
      ean13: product.ean13 ?? '',
      name: product.name ?? '',
      category: product.category ?? '',
      description: product.description ?? '',
      purchase_price: product.purchase_price ? product.purchase_price.toFixed(2) : '',
      sale_price: product.sale_price ? product.sale_price.toFixed(2) : '',
      stock: product.stock ?? '',
      min_stock: product.min_stock ?? '10',
      expiration_date: product.expiration_date ?? '',
      supplier: product.supplier ?? ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await productsAPI.delete(id);
      toast.success('Producto eliminado');
      // si estaba seleccionado, limpiarlo
      if (selectedProduct?.id === id) setSelectedProduct(null);
      await loadProducts();
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar producto');
    }
  };

  const requestDeleteProduct = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  // Función para abrir modal de impresión
  const openPrintModal = () => {
    setPrintQuantity(1);
    setShowPrintModal(true);
  };

  // Función para imprimir etiquetas
  const handlePrintLabels = () => {
    if (!selectedProduct || !selectedProduct.ean13) {
      toast.error('El producto debe tener un código EAN-13 para imprimir');
      return;
    }

    // Crear contenido HTML para imprimir
    const printWindow = window.open('', '_blank');
    const labels = [];

    // Generar las etiquetas según la cantidad
    for (let i = 0; i < printQuantity; i++) {
      labels.push(`
        <div class="label">
          <div class="product-info">
            <div class="sku">${selectedProduct.sku}</div>
            <div class="product-name">${selectedProduct.name}</div>
            <div class="description">${selectedProduct.description}</div>
          </div>
          <div class="price">$ ${selectedProduct.sale_price?.toFixed(2)}</div>
          <div class="barcode-container">
            <svg id="barcode-${i}"></svg>
          </div>
        </div>
      `);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page {
              size: 80mm auto;
              margin: 0;
            }
            
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              width: 80mm;
            }
            
            .label {
              width: 80mm;
              border: 2px solid #000;
              padding: 4mm;
              margin: 0 0 5mm 0;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              box-sizing: border-box;
              font-family: 'Courier New', monospace;
            }
            
            .product-info {
              width: 100%;
              text-align: left;
              margin-bottom: 3mm;
            }
            
            .sku {
              font-size: 10pt;
              color: #333;
              font-weight: normal;
              margin-bottom: 1mm;
            }
            
            .product-name {
              font-size: 11pt;
              font-weight: normal;
              color: #000;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              line-height: 1.2;
            }
            
            .price {
              font-size: 28pt;
              font-weight: bold;
              color: #000;
              text-align: center;
              margin: 3mm 0;
            }
            
            .barcode-container {
              text-align: center;
              width: 100%;
              margin-top: 2mm;
            }
            
            .barcode-container svg {
              max-width: 100%;
              height: auto;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              
              .label {
                margin: 0;
                page-break-after: always;
              }
              
              .label:last-child {
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          ${labels.join('')}
          <script>
            // Generar códigos de barras
            window.onload = function() {
              for (let i = 0; i < ${printQuantity}; i++) {
                JsBarcode("#barcode-" + i, "${selectedProduct.ean13}", {
                  format: "EAN13",
                  width: 2,
                  height: 50,
                  displayValue: true,
                  fontSize: 12,
                  margin: 0,
                  marginTop: 0,
                  marginBottom: 0
                });
              }
              
              // Imprimir automáticamente después de generar los códigos
              setTimeout(() => {
                window.print();
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setShowPrintModal(false);
    toast.success(`Imprimiendo ${printQuantity} etiqueta(s)`);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.ean13 || '').includes(searchTerm);
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Modal de impresión
  const PrintModal = () => {
    if (!showPrintModal) return null;

    return (
      <AppModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Imprimir Etiquetas"
        size="sm"
      >
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              <strong>Producto:</strong> {selectedProduct?.name}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad de etiquetas:
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={printQuantity}
              onChange={(e) => setPrintQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrintLabels}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
            >
              <Printer size={18} />
              Imprimir
            </button>
            <button
              onClick={() => setShowPrintModal(false)}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
            >
              Cancelar
            </button>
          </div>
      </AppModal>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-b-2 border-green-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          /* Ocultar botones de incremento/decremento en inputs de precio */
          input[type="text"][name="purchase_price"]::-webkit-outer-spin-button,
          input[type="text"][name="purchase_price"]::-webkit-inner-spin-button,
          input[type="text"][name="sale_price"]::-webkit-outer-spin-button,
          input[type="text"][name="sale_price"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
        `}
      </style>
      <div className="flex flex-col lg:flex-row gap-6 mt-6 px-4">
        {/* Tabla: 3/4 */}
        <div className="lg:w-3/4 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Productos</h1>
            <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch(`${import.meta.env.VITE_API_URL}/products/export`, {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` }
                  });

                  // Verificar tipo de contenido para NO descargar JSON/HTML como .xlsx
                  const ct = response.headers.get('Content-Type') || '';
                  if (!response.ok || !ct.includes('application')) {
                    // Leer texto de error y mostrarlo
                    const text = await response.text();
                    console.error('Respuesta de exportación:', text);
                    const msg = text || 'Error al exportar productos';
                    console.log('Mensaje de error:', msg);
                    setInfoMessage(msg);
                    setShowInfoModal(true);
                    return;
                  }

                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'productos.xlsx';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Error exportando Excel:', error);
                  setInfoMessage('No se pudo exportar el archivo');
                  setShowInfoModal(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
            >
              📤 Exportar Excel
            </button>

              {/* Botón para abrir escáner */}
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                title="Escanear código de barras"
              >
                <Camera size={18} /> Escanear
              </button>
              
              <button
                onClick={openNewProductModal}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus size={18} /> Nuevo Producto
              </button>
            </div>
          </div>
          

          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o EAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              {/* Botón de escáner dentro del input */}
              <button
                onClick={() => setShowScanner(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                title="Escanear código"
              >
                <Camera size={20} />
              </button>
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tabla con encabezado fijo */}
          <div className="overflow-x-auto border rounded-lg" style={{ maxHeight: '600px' }}>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-green-200 shadow-inner sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">Producto</th>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">SKU / EAN13</th>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">Categoría</th>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">Precio</th>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">Stock</th>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">Vencimiento</th>
                  <th className="px-2 py-3 text-left font-medium text-gray-700 uppercase bg-green-200">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((p, idx) => {
                  const hoy = new Date();
                  const vencimiento = p.expiration_date ? new Date(p.expiration_date) : null;
                  const diasRestantes = vencimiento
                    ? Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24))
                    : null;

                  // Si el producto vence dentro de los próximos 7 días
                  const estaPorVencer = diasRestantes !== null && diasRestantes <= 7 && diasRestantes >= 0;

                  return (
                    <tr
                      key={p.id}
                      data-product-id={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className={`cursor-pointer transition
                        ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'}
                        hover:bg-green-50
                        ${selectedProduct?.id === p.id ? 'bg-green-100 shadow-sm border-l-4 border-green-500' : ''}
                        ${estaPorVencer ? 'bg-red-200 animate-pulse' : ''}`}
                    >
                      <td className="px-2 py-1">{p.name}</td>
                      <td className="px-2 py-1 font-mono">
                        {p.sku}
                        <br />
                        <span className="text-xs text-gray-500">{p.ean13}</span>
                      </td>
                      <td className="px-2 py-1">{p.category}</td>
                      <td className="px-2 py-1 text-green-600 font-semibold">${p.sale_price?.toFixed(2)}</td>
                      <td className="px-2 py-1">{p.stock}</td>
                      <td className="px-2 py-1 flex items-center gap-1">
                        {p.expiration_date}
                        {estaPorVencer && (
                          <span title="Vence pronto" className="text-red-700 font-bold ml-1">⚠️</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(p);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteProduct(p);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
            {filteredProducts.length === 0 && (
              <div className="text-center py-10 text-gray-500">No se encontraron productos</div>
            )}
          </div>
        </div>

        {/* Detalle del producto: 1/3 */}
        <div className="lg:w-1/3 flex flex-col gap-4 overflow-y-auto max-h-[100vh]">
          {selectedProduct ? (
            <>
              {/* Botón de Imprimir Etiquetas */}
              {selectedProduct.ean13 && (
                <button
                  onClick={openPrintModal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  <Printer size={18} />
                  Imprimir Etiqueta
                </button>
              )}
              {/* Tarjeta Info General */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-md p-2">
                <h2 className="text-xl font-semibold mb-2 text-gray-800">{selectedProduct.name}</h2>
                <p className="text-gray-600 mb-3 text-sm">{selectedProduct.description}</p>
                <div className="text-sm space-y-1">
                  <p><strong>SKU:</strong> {selectedProduct.sku}</p>
                  <p><strong>EAN13:</strong> {selectedProduct.ean13}</p>
                  <p><strong>Categoría:</strong> {selectedProduct.category}</p>
                  <p><strong>Proveedor:</strong> {selectedProduct.supplier || '—'}</p>
                </div>
              </div>

              {/* Tarjeta Precios y Stock */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-md p-2">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Precios y Stock</h3>
                <div className="text-sm space-y-1">
                  <p><strong>Precio Compra:</strong> ${selectedProduct.purchase_price?.toFixed(2)}</p>
                  <p><strong>Precio Venta:</strong> ${selectedProduct.sale_price?.toFixed(2)}</p>
                  <p><strong>Stock Actual:</strong> {selectedProduct.stock}</p>
                  <p><strong>Stock Mínimo:</strong> {selectedProduct.min_stock}</p>
                </div>
              </div>

              {/* Tarjeta Código de Barras */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-md p-2 text-center">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Código de Barras</h3>
                {selectedProduct.ean13 && (
                  <Barcode value={selectedProduct.ean13} format="EAN13" width={2} height={80} displayValue />
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4 text-center text-gray-400 mt-4">
              Selecciona un producto para ver sus detalles
            </div>
          )}
        </div>
      </div>

      {/* Modal renderizado con Portal */}
      <ProductModal
        showModal={showModal}
        setShowModal={setShowModal}
        editingProduct={editingProduct}
        formData={formData}
        handleChange={handleChange}
        handlePriceBlur={handlePriceBlur}
        handleSubmit={handleSubmit}
        resetForm={resetForm}
        categories={categories}
      />

      {/* Componente del escáner de códigos de barras */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={handleBarcodeDetected}
      />

      {/* Modal de impresión */}
      <PrintModal />

      <AppModal
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Información"
        size="sm"
        footer={
          <button
            onClick={() => setShowInfoModal(false)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            Entendido
          </button>
        }
      >
        <p className="whitespace-pre-wrap text-sm text-slate-700">{infoMessage}</p>
      </AppModal>

      <AppModal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProductToDelete(null);
        }}
        title="Eliminar producto"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setProductToDelete(null);
              }}
              className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (productToDelete?.id) {
                  await handleDelete(productToDelete.id);
                }
                setShowDeleteModal(false);
                setProductToDelete(null);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
            >
              Confirmar
            </button>
          </>
        }
      >
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {`¿Está seguro de eliminar ${
            productToDelete?.name ? `"${productToDelete.name}"` : 'este producto'
          }?`}
        </p>
      </AppModal>
    </>
  );
};

export default Products;
