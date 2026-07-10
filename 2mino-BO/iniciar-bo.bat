@echo off
title 2mino BO - Iniciando...
cd /d "%~dp0"

echo ============================================
echo   2mino Back Office - iniciando
echo ============================================
echo.

REM El BO necesita el backend de 2mino corriendo (api-integracion:3000).
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop no esta corriendo. Iniciandolo...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  echo Esperando a que Docker este listo, esto puede tardar 1-2 minutos...
  :esperar_docker
  timeout /t 3 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto esperar_docker
  echo Docker listo.
)

echo.
echo Levantando el backend (api-integracion, ms-usuarios, etc.)...
pushd ..
docker compose up -d
popd

echo.
echo Iniciando el servidor del Back Office en una ventana aparte...
start "2mino BO - servidor (no cerrar)" cmd /k "npm run dev"

echo.
echo Abriendo el tunel SSH a produccion en otra ventana aparte...
echo (Necesario para que el boton "Prod" del panel funcione. No cierres esa ventana.)
start "2mino BO - Tunel a Produccion (no cerrar)" cmd /k "node scripts\tunnel-prod.cjs"

echo Esperando a que el panel responda...
:esperar_bo
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:5174 > "%TEMP%\2mino_bo_status.txt" 2>nul
set /p STATUS=<"%TEMP%\2mino_bo_status.txt"
if not "%STATUS%"=="200" goto esperar_bo

echo.
echo Listo! Abriendo http://localhost:5174 ...
start http://localhost:5174

echo.
echo Esta ventana se puede cerrar. NO cierres "2mino BO - servidor" ni "2mino BO - Tunel a Produccion".
pause
