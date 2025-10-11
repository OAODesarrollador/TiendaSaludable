import { useState, useEffect } from 'react';
import { productsAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Plus } from 'lucide-react';
import Barcode from 'react-barcode';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

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

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ean13.includes(searchTerm);
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-b-2 border-green-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-6 px-4">
      {/* Tabla: 3/4 */}
      <div className="lg:w-3/4 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Productos</h1>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            <Plus size={18} /> Nuevo Producto
          </button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((p, idx) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`cursor-pointer transition
                    ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    hover:bg-green-50
                    ${selectedProduct?.id === p.id ? 'bg-green-100 shadow-sm border-l-4 border-green-500' : ''}`}
                >
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 font-mono">
                    {p.sku}
                    <br />
                    <span className="text-xs text-gray-500">{p.ean13}</span>
                  </td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3 text-green-600 font-semibold">${p.sale_price.toFixed(2)}</td>
                  <td className="px-4 py-3">{p.stock}</td>
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
                <p><strong>Precio Compra:</strong> ${selectedProduct.purchase_price.toFixed(2)}</p>
                <p><strong>Precio Venta:</strong> ${selectedProduct.sale_price.toFixed(2)}</p>
                <p><strong>Stock Actual:</strong> {selectedProduct.stock}</p>
                <p><strong>Stock Mínimo:</strong> {selectedProduct.min_stock}</p>
              </div>
            </div>

            {/* Tarjeta Código de Barras */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4 text-center">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Código de Barras</h3>
              <Barcode value={selectedProduct.ean13} format="EAN13" width={2} height={80} displayValue />
            </div>
          </>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4 text-center text-gray-400 mt-4">
            Selecciona un producto para ver sus detalles
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;


