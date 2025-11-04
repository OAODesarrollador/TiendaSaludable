import React, { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  DollarSign,
  LogOut,
  Database,
  FileText,
  Wallet,
  
} from "lucide-react";
import logo from "../assets/avenia.png";
import "../styles/Layout.css";

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Estados separados para cada dropdown
  const [importadorOpen, setImportadorOpen] = useState(false);
  const [reportesOpen, setReportesOpen] = useState(false); // NUEVO

  const location = useLocation();

  // Refs separados para detectar click fuera
  const importadorRef = useRef(null);
  const reportesRef = useRef(null); // NUEVO

  // 🔹 Cierra cada dropdown si hacés clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (importadorRef.current && !importadorRef.current.contains(event.target)) {
        setImportadorOpen(false);
      }
      if (reportesRef.current && !reportesRef.current.contains(event.target)) {
        setReportesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔹 Mantener Importador abierto si estás en /importador/*
  useEffect(() => {
    if (location.pathname.startsWith("/importador")) {
      setImportadorOpen(true);
    } else {
      setImportadorOpen(false);
    }
  }, [location.pathname]);

  // 🔹 Mantener Reportes abierto si estás en /reportes/*
  useEffect(() => {
    if (location.pathname.startsWith("/reportes")) {
      setReportesOpen(true);
    } else {
      setReportesOpen(false);
    }
  }, [location.pathname]);

  // 🔹 Active por ruta exacta o inicio del path
  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // Quitamos el item "Reportes" del menú principal
  const menuItems = [
    { path: "/pos", label: "POS", icon: ShoppingCart },
    { path: "/products", label: "Productos", icon: Package },
    { path: "/sales", label: "Ventas", icon: DollarSign },
    { path: "/caja", label: "Caja", icon: Wallet }, // 💰 NUEVO
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <div className="ln-root">
      {/* HEADER */}
      <header className="ln-header">
        <div className="ln-header-inner">
          {/* Logo */}
          <div className="ln-brand">
            <div className="ln-logo">
              <img src={logo} alt="logo" style={{ width: "90%", height: "70px" }} />
            </div>
          </div>

          {/* Navegación principal */}
          <nav className="ln-nav" aria-label="Principal">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`ln-nav-link ${isActive(item.path) ? "ln-active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* 🔹 Dropdown: Op.Varias (Importador) */}
            <div className="ln-dropdown" ref={importadorRef}>
              <button
                className={`ln-nav-link ln-dropdown-toggle ${
                  location.pathname.startsWith("/importador") ? "ln-active" : ""
                }`}
                onClick={() => setImportadorOpen((v) => !v)}
              >
                <Database size={18} />
                <span>Op.Varias</span>
                <span className="ms-1">{importadorOpen ? "▲" : "▼"}</span>
              </button>

              {importadorOpen && (
                <div className="ln-dropdown-menu show">
                  <Link
                    to="/importador/productos"
                    className={`ln-dropdown-item ${
                      location.pathname === "/importador/productos" ? "ln-active" : ""
                    }`}
                    onClick={() => setImportadorOpen(true)}
                  >
                    📦 Importar Productos
                  </Link>
                  <Link
                    to="/importador/precios"
                    className={`ln-dropdown-item ${
                      location.pathname === "/importador/precios" ? "ln-active" : ""
                    }`}
                    onClick={() => setImportadorOpen(true)}
                  >
                    💲 Actualizar Precios
                  </Link>
                  <Link
                    to="/importador/coeficiente"
                    className={`ln-dropdown-item ${
                      location.pathname === "/importador/coeficiente" ? "ln-active" : ""
                    }`}
                    onClick={() => setImportadorOpen(true)}
                  >
                    ⚙️ Act. con Coeficiente
                  </Link>
                </div>
              )}
            </div>

            {/* 🔹 Dropdown: Reportes */}
            <div className="ln-dropdown" ref={reportesRef}>
              <button
                className={`ln-nav-link ln-dropdown-toggle ${
                  location.pathname.startsWith("/reportes") ? "ln-active" : ""
                }`}
                onClick={() => setReportesOpen((v) => !v)}
              >
                <FileText size={18} />
                <span>Reportes</span>
                <span className="ms-1">{reportesOpen ? "▲" : "▼"}</span>
              </button>

              {reportesOpen && (
                <div className="ln-dropdown-menu show">
                  <Link
                    to="/reportes/ventas"
                    className={`ln-dropdown-item ${
                      location.pathname === "/reportes/ventas" ? "ln-active" : ""
                    }`}
                    onClick={() => setReportesOpen(true)}
                  >
                    📈 Ventas
                  </Link>
                  <Link
                    to="/reportes/vencimientos"
                    className={`ln-dropdown-item ${
                      location.pathname === "/reportes/vencimientos" ? "ln-active" : ""
                    }`}
                    onClick={() => setReportesOpen(true)}
                  >
                    ⏳ Vencimientos
                  </Link>
                  <Link
                    to="/reportes/descuentos"
                    className={`ln-dropdown-item ${
                      location.pathname === "/reportes/descuentos" ? "ln-active" : ""
                    }`}
                    onClick={() => setReportesOpen(true)}
                  >
                    📉 Descuentos
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Usuario */}
          <div className="ln-actions">
            <div className="ln-user">
              <div className="ln-avatar">👤</div>
              <div className="ln-user-info">
                <div className="ln-user-name">Administrador</div>
                <div className="ln-user-role">Admin</div>
              </div>
            </div>
            <button className="ln-logout-btn" onClick={handleLogout}>
              <LogOut size={16} /> Salir
            </button>
          </div>

          {/* Botón móvil */}
          <button
            className="ln-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="ln-main">
        <div className="ln-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
