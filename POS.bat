@echo off
:: --- Forzar ejecución como administrador ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)



@echo off
title Iniciando Proyecto POS
color 0A

echo ===========================================
echo         INICIANDO PROYECTO POS
echo ===========================================
echo.

:: Moverse a la carpeta donde está este archivo
cd /d "%~dp0"

echo Iniciando backend y frontend desde la raiz...
start cmd /k "npm start"

:: Esperar unos segundos para dar tiempo a que el servidor levante
echo Esperando que el servidor inicie...
timeout /t 10 /nobreak >nul

:: Abrir el navegador (ajusta el puerto si usás otro)
start http://localhost:3000

echo ===========================================
echo El proyecto se ha iniciado correctamente.
echo ===========================================
pause
exit
