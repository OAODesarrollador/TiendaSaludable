@echo off
title Tienda Natural - Ejecutar Aplicación
color 0B
echo ===============================================
echo    EJECUTANDO TIENDA NATURAL
echo ===============================================
echo.

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

echo Iniciando servidor backend...
start "Backend Server" cmd /k "cd backend && npm start"

echo Esperando a que el backend se inicie...
timeout /t 5 /nobreak >nul

echo Iniciando servidor frontend...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo Esperando a que el frontend se inicie...
timeout /t 8 /nobreak >nul

echo Abriendo aplicación en el navegador...
start "" http://localhost:5173

echo.
echo ===============================================
echo    APLICACIÓN INICIADA
echo ===============================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
pause

