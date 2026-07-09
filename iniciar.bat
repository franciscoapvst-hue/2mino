@echo off
title 2mino - Iniciando...
cd /d "%~dp0"

echo ============================================
echo   2mino - levantando el sitio local
echo ============================================
echo.

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
) else (
  echo Docker ya estaba corriendo.
)

echo.
echo Levantando los servicios (esto puede tardar un poco la primera vez)...
docker compose up -d
if errorlevel 1 (
  echo.
  echo Algo fallo al levantar los servicios. Revisa el mensaje de arriba.
  pause
  exit /b 1
)

echo.
echo Esperando a que el sitio responda...
:esperar_sitio
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost > "%TEMP%\2mino_status.txt" 2>nul
set /p STATUS=<"%TEMP%\2mino_status.txt"
if not "%STATUS%"=="200" goto esperar_sitio

echo.
echo Listo! Abriendo http://localhost ...
start http://localhost

echo.
echo Podes cerrar esta ventana cuando quieras (los servicios siguen corriendo).
pause
