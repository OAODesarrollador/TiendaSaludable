@echo off
title Tienda Natural - POS (Método Rápido)
color 0A
echo ===============================================
echo    TIENDA NATURAL - MÉTODO RÁPIDO
echo ===============================================
echo.

REM Moverse a la carpeta donde está este script
cd /d "%~dp0"

REM Verificar si las dependencias están instaladas
if not exist "backend\node_modules" (
    echo ERROR: Las dependencias no están instaladas.
    echo Ejecuta primero: start.bat
    echo.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo ERROR: Las dependencias no están instaladas.
    echo Ejecuta primero: start.bat
    echo.
    pause
    exit /b 1
)

echo Iniciando solo el backend (método rápido)...
cd backend
start "" cmd /k "npm start"
cd ..

echo Esperando a que el servidor arranque...
timeout /t 5 /nobreak >nul

echo Abriendo aplicación en el navegador...
start "" http://localhost:3000

echo ===============================================
echo   Backend iniciado correctamente
echo ===============================================
echo.
echo NOTA: Este método solo inicia el backend.
echo Para la aplicación completa, usa: start.bat
echo.
pause
