import React, { memo } from 'react';
import { createPortal } from 'react-dom';

const ProductModal = memo(function ProductModal({
  showModal,
  setShowModal,
  editingProduct,
  formData,
  handleChange,
  handlePriceBlur,
  handleSubmit,
  resetForm,
    categories
}) {
  if (!showModal) return null;

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/50"
      style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}
    >
      <div 
        className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ position: 'relative', zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* -- aquí pegás exactamente los inputs que ya tenés -- */}
          
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
                  type="text"
                  inputMode="decimal"
                  value={formData.purchase_price}
                  onChange={handleChange}
                  onBlur={handlePriceBlur}
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  style={{
                    MozAppearance: 'textfield'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta *</label>
                <input
                  name="sale_price"
                  type="text"
                  inputMode="decimal"
                  value={formData.sale_price}
                  onChange={handleChange}
                  onBlur={handlePriceBlur}
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  style={{
                    MozAppearance: 'textfield'
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual</label>
                <input
                  type="text"
                  name="stock"
                  value={formData.stock}
                  onChange={(e) => {
                    let val = e.target.value.replace(',', '.'); // permite coma o punto
                    // permite hasta 3 decimales, solo números y punto
                    if (/^\d*\.?\d{0,3}$/.test(val) || val === '') {
                      handleChange({ target: { name: 'stock', value: val } });
                    }
                  }}
                  placeholder="Stock (ej. 10.125)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />

              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                <input
                  type="text"
                  name="min_stock"
                  value={formData.min_stock}
                  onChange={(e) => {
                    let val = e.target.value.replace(',', '.');
                    if (/^\d*\.?\d{0,3}$/.test(val) || val === '') {
                      handleChange({ target: { name: 'min_stock', value: val } });
                    }
                  }}
                  placeholder="Stock mínimo (ej. 5.500)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />

              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                <input
                  name="expiration_date"
                  type="date"
                  value={formData.expiration_date}
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
            <button type="submit" className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition">
              {editingProduct ? 'Actualizar' : 'Crear Producto'}
            </button>
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
});

export default ProductModal;
