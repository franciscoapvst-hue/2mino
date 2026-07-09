# Registra la tarea programada de Windows que sirve dist/ en
# localhost:5174 al iniciar sesión, sin ventana visible. Correr una vez
# por máquina (requiere haber hecho `npm run build` antes, para que
# dist/ exista). Para desinstalar: Unregister-ScheduledTask -TaskName "2mino-BO-serve"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath = Join-Path $scriptDir "serve-pwa.vbs"

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "2mino-BO-serve" `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description "Sirve el Back Office de 2mino (PWA) en localhost:5174 al iniciar sesion" `
  -Force

Write-Host "Tarea '2mino-BO-serve' registrada. Se ejecuta automaticamente en cada inicio de sesion."
Write-Host "Para probarla ahora mismo: Start-ScheduledTask -TaskName '2mino-BO-serve'"
