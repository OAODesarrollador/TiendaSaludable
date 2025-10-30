@echo off
title Migrador Tienda Natural
echo ===========================================
echo   🧰 MIGRADOR DE BASE DE DATOS - TIENDA NATURAL
echo ===========================================
echo.

echo Creando copia de seguridad...
if exist backend\database.sqlite (
  copy backend\database.sqlite backend\database_backup.sqlite >nul
  echo ✅ Backup creado correctamente.
) else (
  echo ⚠️ No se encontró el archivo backend\database.sqlite
  pause
  exit /b
)

echo.
echo Ejecutando migrador...
node migrador.js

echo.
echo 🔄 Proceso finalizado. Verifique mensajes anteriores.
pause
