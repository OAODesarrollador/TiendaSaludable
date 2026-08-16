// ============================================
// App.jsx
// ============================================
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


// Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/Pos';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Layout from './components/Layout';
import Importador from './components/Importador';
import ImportarProductos from './components/ImportarProductos';
import ActualizarPrecios from './components/actualizarPrecios';
import ActualizarCoeficiente from './components/ActualizarCoeficiente';
import ReporteVentas from "./pages/reportes/ReporteVentas";
import ReporteVencimientos from "./pages/reportes/ReporteVencimineto";
import ReporteDescuentos from "./pages/reportes/ReporteDescuentos";
import ReporteProductos from "./pages/reportes/ReporteProductos";
import ReporteGastos from "./pages/reportes/ReporteGastos";
import Caja from "./pages/caja";




// Componente de ruta protegida
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="products" element={<Products />} />
            <Route path="sales" element={<Sales />} />
            <Route path="reports" element={<Reports />} />
            <Route path="importador" element={<Importador />} />
            <Route path="importador/productos" element={<ImportarProductos />} />
            <Route path="importador/precios" element={<ActualizarPrecios />} />
            <Route path="importador/coeficiente" element={<ActualizarCoeficiente />} />
            {/* Reportes */}
            <Route path="/reportes/ventas" element={<ReporteVentas />} />
            <Route path="/reportes/vencimientos" element={<ReporteVencimientos />} />
            <Route path="/reportes/descuentos" element={<ReporteDescuentos />} />
            <Route path="/reportes/productos" element={<ReporteProductos />} />
            <Route path="/reportes/gastos" element={<ReporteGastos />} />
            <Route path="/caja" element={<Caja />} />

            {/* (Opcional) Si alguien navega a /reports, redirigimos a /reportes/ventas */}
            <Route path="/reports" element={<Navigate to="/reportes/ventas" replace />} />

          </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
