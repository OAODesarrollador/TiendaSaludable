@echo off
title Tienda Natural - Sistema POS
color 0A
echo ===============================================
echo    TIENDA NATURAL - SISTEMA POS
echo ===============================================
echo.

REM Moverse a la carpeta donde está este script
cd /d "%~dp0"

REM Verificar si Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js no está instalado.
    echo.
    echo Opciones:
    echo 1. Instalar Node.js automáticamente
    echo 2. Abrir página de descarga manual
    echo 3. Salir
    echo.
    set /p choice="Selecciona una opción (1-3): "
    
    if "%choice%"=="1" (
        echo Ejecutando instalador de Node.js...
        call install-node.bat
        if %errorlevel% neq 0 (
            echo Error en la instalación. Usa la opción 2.
            pause
            exit /b 1
        )
    ) else if "%choice%"=="2" (
        start "" https://nodejs.org/es/download/
        echo Después de instalar Node.js, ejecuta start.bat nuevamente
        pause
        exit /b 1
    ) else (
        echo Saliendo...
        exit /b 1
    )
)

echo [1/5] Verificando Node.js... ✓
echo.

REM Instalar dependencias del backend
echo [2/5] Instalando dependencias del backend...
pushd backend
if not exist node_modules (
    echo Instalando dependencias del backend...
    call npm ci || call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Falló la instalación de dependencias del backend
        pause
        exit /b 1
    )
) else (
    if not exist node_modules\dotenv (
        echo Reparando dependencias del backend (falta dotenv)...
        call npm install
        if %errorlevel% neq 0 (
            echo ERROR: Falló la reparación de dependencias del backend
            pause
            exit /b 1
        )
    ) else (
        echo Dependencias del backend ya instaladas ✓
    )
)
popd

REM Instalar dependencias del frontend
echo [3/5] Instalando dependencias del frontend...
pushd frontend
if not exist node_modules (
    echo Instalando dependencias del frontend...
    call npm ci || call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Falló la instalación de dependencias del frontend
        pause
        exit /b 1
    )
) else (
    if not exist node_modules\react (
        echo Reparando dependencias del frontend...
        call npm install
        if %errorlevel% neq 0 (
            echo ERROR: Falló la reparación de dependencias del frontend
            pause
            exit /b 1
        )
    ) else (
        echo Dependencias del frontend ya instaladas ✓
    )
)
popd

REM Configurar base de datos
echo [4/5] Configurando base de datos...
cd backend
call npm run setup
if %errorlevel% neq 0 (
    echo ERROR: Falló la configuración de la base de datos
    pause
    exit /b 1
)
cd ..

echo [5/5] Iniciando aplicación...
echo.

REM Crear archivos de inicio para backend y frontend
echo Iniciando servidor backend...
start "Backend Server" cmd /k "cd backend && npm start"

REM Esperar a que el backend se inicie
echo Esperando a que el backend se inicie...
timeout /t 8 /nobreak >nul

echo Iniciando servidor frontend...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

REM Esperar a que el frontend se inicie
echo Esperando a que el frontend se inicie...
timeout /t 10 /nobreak >nul

REM Abrir el navegador
echo Abriendo aplicación en el navegador...
start "" http://localhost:5173

echo.
echo ===============================================
echo    APLICACIÓN INICIADA CORRECTAMENTE
echo ===============================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Para detener la aplicación, cierra las ventanas
echo de comandos que se abrieron.
echo.
pause
