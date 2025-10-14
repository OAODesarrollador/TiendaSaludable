@echo off
title Iniciando aplicación POS
echo ===============================
echo   Iniciando el servidor...
echo ===============================

REM Ir al directorio del backend (ajustá si es necesario)
cd backend

REM Iniciar el servidor en una nueva ventana
start "" cmd /k "npm start"

REM Esperar unos segundos para que el servidor arranque
timeout /t 5 /nobreak >nul

REM Abrir la aplicación en el navegador predeterminado
start "" http://localhost:3000

echo ===============================
echo   Aplicación iniciada correctamente
echo ===============================
pause
