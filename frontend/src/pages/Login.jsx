/* ==========================
   Login.jsx
   (Bootstrap + React, estilo separado en Login.css)
   ========================== */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authAPI } from '../services/api';
import { LogIn, Loader } from 'lucide-react';
import '../styles/Login.css';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login(credentials);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      toast.success(`¡Bienvenido ${user.full_name}!`);
      navigate('/');
    } catch (error) {
      
      toast.error(error.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  return (
    <div className="container-fluid login-bg min-vh-100 d-flex align-items-center justify-content-center p-4">
      <div className="login-wrapper w-100" style={{ maxWidth: 480 }}>
        <div className="card login-card shadow-lg border-0 card-floating">
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <div className="logo-badge mx-auto mb-3" aria-hidden>
                <span className="logo-emoji">🌿</span>
              </div>
              <h1 className="h4 fw-bold text-emerald-900 mb-0">Tienda Natural</h1>
              <small className="text-muted">Sistema de Gestión</small>
            </div>

            <form onSubmit={handleSubmit} className="mb-0" noValidate>
              <div className="mb-3">
                <label htmlFor="username" className="form-label fw-semibold">Usuario</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={credentials.username}
                  onChange={handleChange}
                  className="form-control form-control-lg shadow-sm"
                  placeholder="Ingrese su usuario"
                  aria-label="Usuario"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="password" className="form-label fw-semibold">Contraseña</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={handleChange}
                  className="form-control form-control-lg shadow-sm"
                  placeholder="••••••••"
                  aria-label="Contraseña"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-cta btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                aria-disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader className="spin" size={18} />
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </form>

            <div className="demo-box mt-4 p-3 rounded-3">
              <p className="mb-1 fw-semibold">🔐 Credenciales de prueba:</p>
              <div className="text-muted small">
                <div><strong>Admin:</strong> admin / admin123</div>
                <div><strong>Vendedor:</strong> vendedor / vendedor123</div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-muted mt-3 small">Sistema de Gestión para Tienda de Productos Naturales</p>
      </div>
    </div>
  );
};

export default Login;


