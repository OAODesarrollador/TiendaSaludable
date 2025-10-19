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

// Componente de ruta protegida
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;