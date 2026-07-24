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
echo Verificando que el puerto 5174 este libre...
REM Si quedo un serve-pwa.cjs (u otro "npm run dev") de una sesion
REM anterior ocupando el 5174, vite falla al arrancar (strictPort: true,
REM ver vite.config.ts) EN SU PROPIA VENTANA -- que nadie mira -- mientras
REM el chequeo de mas abajo sigue viendo un 200 (del proceso viejo) y abre
REM el navegador contento con el build desactualizado. Se mata cualquier
REM cosa en el 5174 antes de arrancar, asi el puerto siempre queda para
REM el vite de esta sesion.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5174" ^| findstr "LISTENING"') do (
  echo Matando proceso viejo en el puerto 5174 ^(PID %%P^)...
  taskkill /F /PID %%P >nul 2>&1
)

echo.
echo Iniciando el servidor del Back Office en una ventana aparte...
start "2mino BO - servidor (no cerrar)" cmd /k "npm run dev"

echo.
echo Abriendo el tunel SSH a produccion en otra ventana aparte...
echo (Necesario para que el boton "Prod" del panel funcione. No cierres esa ventana.)
start "2mino BO - Tunel a Produccion (no cerrar)" cmd /k "node scripts\tunnel-prod.cjs"

echo.
echo Iniciando el lanzador de Grafana en otra ventana aparte...
echo (Necesario para que el boton "Grafana" del panel funcione. No cierres esa ventana.)
start "2mino BO - Lanzador de Grafana (no cerrar)" cmd /k "node scripts\grafana-launcher.cjs"

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
