@echo off
title Deteniendo Tienda Natural
color 0C
echo ===============================================
echo    DETENIENDO APLICACIÓN
echo ===============================================
echo.

REM Moverse a la carpeta donde está este script
cd /d "%~dp0"

echo Cerrando procesos de Node.js...
taskkill /f /im node.exe >nul 2>&1

echo Cerrando ventanas de servidores...
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq Backend Server*" >nul 2>&1
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq Frontend Server*" >nul 2>&1

echo.
echo ===============================================
echo    APLICACIÓN DETENIDA
echo ===============================================
echo.
pause

