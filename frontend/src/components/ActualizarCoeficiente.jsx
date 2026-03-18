import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import api from "../services/api";

const ActualizarCoeficiente = () => {
  const [coeficientes, setCoeficientes] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCoefficients = async () => {
    try {
      const res = await api.get("/coeficientes");
      setCoeficientes(res.data);
    } catch {
      toast.error("Error al cargar coeficientes");
    }
  };

  useEffect(() => {
    loadCoefficients();
  }, []);

  const handleChange = (index, value) => {
    const updated = [...coeficientes];
    updated[index].coefficient = value.replace(",", ".");
    setCoeficientes(updated);
  };

  const handleSave = async (category, coefficient) => {
    const num = parseFloat(coefficient);
    if (isNaN(num) || num <= 0) {
      toast.error("Coeficiente inválido");
      return;
    }

    try {
      setLoading(true);
      await api.post("/coeficientes", { category, coefficient: num });
      toast.success(`Coeficiente guardado: ${category}`);
      loadCoefficients();
    } catch {
      toast.error("Error guardando coeficiente");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrices = async (category) => {
    try {
      setLoading(true);
      const res = await api.post("/coeficientes/actualizar-precios", { category });
      toast.success(res.data.message);
    } catch {
      toast.error("Error actualizando precios");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border rounded-lg shadow-md p-6 mt-8">
      <h2 className="text-2xl font-semibold text-green-700 mb-4">
        ⚙️ Actualizar Coeficientes y Precios por Categoría
      </h2>
      {coeficientes.length === 0 ? (
        <p className="text-gray-500 text-center">No hay categorías registradas</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-green-100">
            <tr>
              <th className="p-2 text-left">Categoría</th>
              <th className="p-2 text-left">Coeficiente</th>
              <th className="p-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {coeficientes.map((c, i) => (
              <tr key={c.category} className="border-t">
                <td className="p-2">{c.category}</td>
                <td className="p-2">
                  <input
                    type="text"
                    value={c.coefficient}
                    onChange={(e) => handleChange(i, e.target.value)}
                    className="border px-2 py-1 rounded w-24 text-center"
                  />
                </td>
                <td className="p-2 text-right space-x-2">
                  <button
                    onClick={() => handleSave(c.category, c.coefficient)}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                  >
                    {loading ? "..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => handleUpdatePrices(c.category)}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                  >
                    {loading ? "..." : "Actualizar precios"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ActualizarCoeficiente;
