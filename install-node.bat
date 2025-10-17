@echo off
title Instalador de Node.js
color 0E
echo ===============================================
echo    INSTALADOR DE NODE.JS
echo ===============================================
echo.

REM Verificar si Node.js ya está instalado
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js ya está instalado:
    node --version
    echo.
    echo No es necesario instalar Node.js nuevamente.
    echo.
    pause
    exit /b 0
)

echo Node.js no está instalado en este sistema.
echo.
echo Este script te ayudará a instalar Node.js.
echo.
echo Opciones:
echo 1. Abrir página de descarga de Node.js
echo 2. Descargar e instalar automáticamente (requiere PowerShell)
echo 3. Salir
echo.
set /p choice="Selecciona una opción (1-3): "

if "%choice%"=="1" (
    echo Abriendo página de descarga...
    start "" https://nodejs.org/es/download/
    echo.
    echo Después de instalar Node.js, ejecuta start.bat
    pause
) else if "%choice%"=="2" (
    echo Descargando Node.js...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi' -OutFile 'nodejs-installer.msi'}"
    if exist nodejs-installer.msi (
        echo Instalando Node.js...
        start /wait nodejs-installer.msi
        del nodejs-installer.msi
        echo.
        echo Node.js instalado. Reinicia este script.
        pause
    ) else (
        echo Error al descargar Node.js. Usa la opción 1.
        pause
    )
) else if "%choice%"=="3" (
    echo Saliendo...
    exit /b 0
) else (
    echo Opción inválida.
    pause
    goto :eof
)

