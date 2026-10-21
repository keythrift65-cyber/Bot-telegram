# ------------------------------------------------------------------
#  Configura el bot para que arranque solo al encender Windows
#  (aunque nadie inicie sesión) y lo pone en marcha ahora mismo.
#
#  Ejecutar en PowerShell COMO ADMINISTRADOR desde la carpeta del bot:
#    powershell -ExecutionPolicy Bypass -File scripts\windows\instalar-inicio.ps1
# ------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$TaskName = "BotOposiciones"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$bat = Join-Path $PSScriptRoot "iniciar-bot.bat"

# 1. Comprobaciones previas
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: abre PowerShell como administrador (clic derecho > Ejecutar como administrador)." -ForegroundColor Red
    exit 1
}
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "ERROR: no se encuentra Node.js. Instalalo desde https://nodejs.org (version LTS)." -ForegroundColor Red
    exit 1
}
$node = $nodeCmd.Source
if (-not (Test-Path (Join-Path $root ".env"))) {
    Write-Host "ERROR: falta el archivo .env en $root (copia .env.example y pon BOT_TOKEN y ADMIN_ID)." -ForegroundColor Red
    exit 1
}

# 2. Si el bot estaba arrancado con pm2, lo paramos (dos copias a la vez darian error)
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Write-Host "Parando pm2 por si el bot estaba arrancado con el..."
    cmd /c "pm2 delete bot-oposiciones >nul 2>&1 & pm2 kill >nul 2>&1"
}

# 3. Compilamos el bot
Write-Host "Compilando el bot..."
Push-Location $root
cmd /c "npm run build"
$buildOk = ($LASTEXITCODE -eq 0)
Pop-Location
if (-not $buildOk) {
    Write-Host "ERROR: fallo la compilacion. Ejecuta 'npm install' y vuelve a intentarlo." -ForegroundColor Red
    exit 1
}

# 4. Creamos la tarea programada
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"`"$bat`" `"$node`"`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskUser = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

& (Join-Path $PSScriptRoot "detener-bot.ps1") | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $taskUser -Settings $settings -Force | Out-Null

# 5. Lo arrancamos ya
Start-ScheduledTask -TaskName $TaskName
Write-Host ""
Write-Host "OK: el bot esta en marcha y arrancara solo cada vez que se encienda el portatil." -ForegroundColor Green
Write-Host "Ver los logs en directo:  Get-Content logs\bot.log -Wait -Tail 30"
Write-Host "Parar el bot:             powershell -ExecutionPolicy Bypass -File scripts\windows\detener-bot.ps1"
Write-Host "Volver a arrancarlo:      Start-ScheduledTask -TaskName $TaskName"
