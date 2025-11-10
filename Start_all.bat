:: 🧩 Elevación automática de privilegios de administrador
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo 🧩 Elevando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb runAs"
    exit /b
)

@echo off
:: =====================================================
:: 🚀 TIENDASALUDABLE - Instalador y Lanzador Automático
:: =====================================================

:: 👇 Forzar ruta raíz del proyecto
cd /d "%~dp0"

chcp 65001 >nul
color 0A
title TiendaSaludable - Instalador y Lanzador

echo.
echo =====================================================
echo   🧩 Oscar Ortiz Dev Studio™ - TiendaSaludable
echo =====================================================
echo.
echo 🕒 %date% - %time%
echo.

setlocal enabledelayedexpansion

:: -------------------------
:: 1️⃣ Verificar Node y npm
:: -------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ❌ Node.js no está instalado o no está en PATH.
    echo 🔗 Descargalo desde: https://nodejs.org
    echo.
    pause
    exit /b
)

for /f "delims=" %%v in ('node -v') do set nodev=%%v
for /f "delims=" %%v in ('npm -v') do set npmv=%%v
echo ✅ Node.js !nodev! y npm !npmv! detectados correctamente.
echo.

:: -------------------------
:: 2️⃣ Verificar carpetas
:: -------------------------
if not exist backend (
    color 0C
    echo ❌ ERROR: No se encontró la carpeta "backend".
    pause
    exit /b
)
if not exist frontend (
    color 0C
    echo ❌ ERROR: No se encontró la carpeta "frontend".
    pause
    exit /b
)
echo ✅ Carpetas detectadas correctamente.
echo.

:: -------------------------
:: 3️⃣ Cerrar procesos previos
:: -------------------------
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

:: -------------------------
:: 4️⃣ Instalar dependencias
:: -------------------------
echo ================================================
echo   📦 INSTALANDO DEPENDENCIAS BACKEND Y FRONTEND
echo ================================================
echo.

:: ---- BACKEND ----
cd backend
if exist package.json (
    echo 🧩 Instalando dependencias del BACKEND...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo ❌ Error durante "npm install" en backend.
        echo.
        pause
        exit /b
    )
    echo ✅ Backend: dependencias base instaladas.
) else (
    color 0C
    echo ❌ No se encontró backend/package.json
    pause
    exit /b
)

:: Librerías extra backend
echo 🔧 Verificando librerías adicionales...
call npm install pdfkit json2csv bwip-js exceljs xlsx dotenv cors morgan
if %errorlevel% neq 0 (
    color 0C
    echo ❌ Error instalando librerías extra backend.
    pause
    exit /b
)
echo ✅ Backend: librerías adicionales instaladas.
echo.

:: ---- FRONTEND ----
cd ..
cd frontend
if exist package.json (
    echo 💻 Instalando dependencias del FRONTEND...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo ❌ Error durante "npm install" en frontend.
        pause
        exit /b
    )
    echo ✅ Frontend: dependencias base instaladas.
) else (
    color 0C
    echo ❌ No se encontró frontend/package.json
    pause
    exit /b
)

echo 🔧 Verificando librerías adicionales frontend...
call npm install jspdf jspdf-autotable xlsx file-saver react-icons react-bootstrap bootstrap
if %errorlevel% neq 0 (
    color 0C
    echo ❌ Error instalando librerías extra frontend.
    pause
    exit /b
)
echo ✅ Frontend: librerías adicionales instaladas.
echo.

cd ..
echo ================================================
echo   ✅ TODAS LAS DEPENDENCIAS INSTALADAS
echo ================================================
echo.

:: -------------------------
:: 5️⃣ Levantar backend y frontend
:: -------------------------
echo 🚀 Iniciando servidores...
timeout /t 2 >nul

echo 🟢 Iniciando Backend (http://localhost:5000)
start cmd /k "title TiendaSaludable Backend & color 0A & cd backend && npm start"

echo 🔵 Iniciando Frontend (http://localhost:3000)
if exist "frontend\package.json" (
    findstr /C:"\"start\"" frontend\package.json >nul
    if %errorlevel%==0 (
        start cmd /k "title TiendaSaludable Frontend & color 09 & cd frontend && npm start"
    ) else (
        echo ⚠️ Script 'start' no encontrado. Usando 'npm run dev'...
        start cmd /k "title TiendaSaludable Frontend & color 09 & cd frontend && npm run dev"
    )
)

echo.
echo ================================================
echo   🌿 Todo listo - TiendaSaludable en ejecución
echo ================================================
echo Backend → http://localhost:5000
echo Frontend → http://localhost:3000
echo.
echo 🌍 Abriendo sistema en el navegador...
start "" "http://localhost:3000"

pause
exit
