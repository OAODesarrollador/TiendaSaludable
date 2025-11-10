:: 🧩 Elevación automática de privilegios de administrador
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo 🧩 Elevando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb runAs"
    exit /b
)

@echo off
:: =====================================================
:: 🚀 TiendaSaludable - Inicio Rápido (Admin)
:: =====================================================

cd /d "%~dp0"
chcp 65001 >nul
color 0A
title TiendaSaludable - Inicio Rápido (Admin)

echo.
echo =====================================================
echo   🧩 Oscar Ortiz Dev Studio™ - TiendaSaludable
echo =====================================================
echo 🕒 %date% - %time%
echo.

:: Cerrar procesos viejos
echo 🔍 Buscando procesos antiguos (puertos 3000 / 5000)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo ⚠️ Cerrando proceso FRONTEND (PID %%a)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo ⚠️ Cerrando proceso BACKEND (PID %%a)
    taskkill /PID %%a /F >nul 2>&1
)
echo ✅ Procesos previos cerrados (si existían).
echo.

:: Levantar backend y frontend
echo 🚀 Iniciando servidores...

echo 🟢 Backend → http://localhost:5000
start cmd /k "title TiendaSaludable Backend & color 0A & cd backend && npm start"

echo 🔵 Frontend → http://localhost:3000
if exist "frontend\package.json" (
    findstr /C:"\"start\"" frontend\package.json >nul
    if %errorlevel%==0 (
        start cmd /k "title TiendaSaludable Frontend & color 09 & cd frontend && npm start"
    ) else (
        echo ⚠️ Script 'start' no encontrado. Usando 'npm run dev'...
        start cmd /k "title TiendaSaludable Frontend & color 09 & cd frontend && npm run dev"
    )
)

echo 🌍 Abriendo navegador...
start "" "http://localhost:3000"

echo.
echo ================================================
echo   🌿 Sistema TiendaSaludable en ejecución
echo ================================================
echo.
pause
exit
