@echo off
title 2mino BO - Tunel a Produccion
cd /d "%~dp0"

echo ============================================
echo   Tunel SSH hacia produccion (VPS)
echo ============================================
echo.
echo Mientras esta ventana quede abierta, el boton "Prod" del
echo Back Office puede hablar con el backend real (localhost:3001).
echo Cerrar esta ventana corta la conexion.
echo.

node scripts\tunnel-prod.cjs
pause
