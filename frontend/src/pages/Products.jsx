import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { productsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Barcode from 'react-barcode';

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
    name: '',
    category: '',
    description: '',
    purchase_price: '',
    sale_price: '',
    stock: '',
    min_stock: '10',
    supplier: ''
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    // Bloquear scroll del body cuando el modal está abierto
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

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
      category: '',
      description: '',
      purchase_price: '',
      sale_price: '',
      stock: '',
      min_stock: '10',
      supplier: ''
    });
    setEditingProduct(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        purchase_price: parseFloat(formData.purchase_price || 0),
        sale_price: parseFloat(formData.sale_price || 0),
        stock: parseInt(formData.stock || 0, 10),
        min_stock: parseInt(formData.min_stock || 0, 10)
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
      purchase_price: product.purchase_price ?? '',
      sale_price: product.sale_price ?? '',
      stock: product.stock ?? '',
      min_stock: product.min_stock ?? '10',
      supplier: product.supplier ?? ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este producto?')) return;
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

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.ean13 || '').includes(searchTerm);
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Componente Modal usando Portal
  const Modal = () => {
    if (!showModal) return null;

    return createPortal(
      <div 
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/50"
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
            resetForm();
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
            <h2 className="text-2xl font-bold">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                <input
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={!!editingProduct}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EAN-13</label>
                <input
                  name="ean13"
                  value={formData.ean13 || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <input
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                list="categories"
              />
              <datalist id="categories">
                {categories.map(cat => <option key={cat} value={cat} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Compra *</label>
                <input
                  name="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchase_price}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta *</label>
                <input
                  name="sale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual</label>
                <input
                  name="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                <input
                  name="min_stock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <input
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                type="submit" 
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
              >
                {editingProduct ? 'Actualizar' : 'Crear Producto'}
              </button>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
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
      <div className="flex flex-col lg:flex-row gap-6 mt-6 px-4">
        {/* Tabla: 3/4 */}
        <div className="lg:w-3/4 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Productos</h1>
            <div className="flex items-center gap-2">
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
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o EAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
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

          {/* Tabla */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-200 shadow-inner">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase">Producto</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase">SKU / EAN13</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase">Precio</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`cursor-pointer transition
                      ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'}
                      hover:bg-green-200
                      ${selectedProduct?.id === p.id ? 'bg-green-100 shadow-sm border-l-4 border-green-500' : ''}`}
                  >
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 font-mono">
                      {p.sku}
                      <br />
                      <span className="text-xs text-gray-500">{p.ean13}</span>
                    </td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">${p.sale_price?.toFixed(2)}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    <td className="px-4 py-3">
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
                            handleDelete(p.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="text-center py-10 text-gray-500">No se encontraron productos</div>
            )}
          </div>
        </div>

        {/* Detalle del producto: 1/3 */}
        <div className="lg:w-1/3 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          {selectedProduct ? (
            <>
              {/* Tarjeta Info General */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4">
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-700">Precios y Stock</h3>
                <div className="text-sm space-y-1">
                  <p><strong>Precio Compra:</strong> ${selectedProduct.purchase_price?.toFixed(2)}</p>
                  <p><strong>Precio Venta:</strong> ${selectedProduct.sale_price?.toFixed(2)}</p>
                  <p><strong>Stock Actual:</strong> {selectedProduct.stock}</p>
                  <p><strong>Stock Mínimo:</strong> {selectedProduct.min_stock}</p>
                </div>
              </div>

              {/* Tarjeta Código de Barras */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4 text-center">
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
      <Modal />
    </>
  );
};

export default Products;