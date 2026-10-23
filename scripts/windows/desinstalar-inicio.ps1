# ------------------------------------------------------------------
#  Para el bot y quita el arranque automatico al encender Windows.
#
#  Ejecutar en PowerShell COMO ADMINISTRADOR:
#    powershell -ExecutionPolicy Bypass -File scripts\windows\desinstalar-inicio.ps1
# ------------------------------------------------------------------
$TaskName = "BotOposiciones"

& (Join-Path $PSScriptRoot "detener-bot.ps1")
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Arranque automatico eliminado."
