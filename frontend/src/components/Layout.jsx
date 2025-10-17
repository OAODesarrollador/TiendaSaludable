// src/layouts/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  FileText,
  LogOut,
  User,
  Menu,
  X,
} from 'lucide-react';
import '../styles/Layout.css'; // <-- Asegurate esta ruta
import logo from '../assets/Avenia.png'

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    
    { path: '/pos', icon: ShoppingCart, label: 'POS' },
    { path: '/products', icon: Package, label: 'Productos' },
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/sales', icon: DollarSign, label: 'Ventas' },
    { path: '/reports', icon: FileText, label: 'Reportes' },
  ];

  // helper para marcar activo
  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="ln-root">
      <header className="ln-header">
        <div className="ln-header-inner">
          <div className="ln-brand">
            <div className="ln-logo">
              
              <img src={logo} alt="logo" width="150" height="100" style={{marginLeft: '8px', borderRadius: '4px'}} />
              
            </div>
            
          </div>

          {/* NAV desktop */}
          <nav className="ln-nav" aria-label="Principal">
            {menuItems.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.path}
                  to={it.path}
                  className={`ln-nav-link ${isActive(it.path) ? 'ln-active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={18} />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* user + logout */}
          <div className="ln-actions">
            <div className="ln-user">
              <div className="ln-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.full_name || 'Usuario'} />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="ln-user-info">
                <div className="ln-user-name">{user?.full_name || 'Usuario'}</div>
                <div className="ln-user-role">{user?.role || 'vendedor'}</div>
              </div>
            </div>

            <button className="ln-logout-btn" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={16} />
              <span>Salir</span>
            </button>

            <button
              className="ln-mobile-toggle"
              aria-label="Abrir menú"
              onClick={() => setMobileOpen((s) => !s)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* mobile menu */}
        <div className={`ln-mobile-menu ${mobileOpen ? 'open' : ''}`}>
          <nav className="ln-mobile-nav">
            {menuItems.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.path}
                  to={it.path}
                  className={`ln-mobile-link ${isActive(it.path) ? 'ln-active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={18} />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ln-mobile-user">
            <div className="ln-avatar-lg">
              {user?.avatar ? <img src={user.avatar} alt={user.full_name || 'Usuario'} /> : <User size={20} />}
            </div>
            <div className="ln-mobile-user-info">
              <div className="ln-user-name">{user?.full_name || 'Usuario'}</div>
              <div className="ln-user-role">{user?.role || 'vendedor'}</div>
            </div>

            <button
              className="ln-mobile-logout"
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
            >
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="ln-main">
        <div className="ln-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
