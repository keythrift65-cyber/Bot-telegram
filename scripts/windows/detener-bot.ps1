# ------------------------------------------------------------------
#  Para el bot (hasta el proximo reinicio del portatil o hasta que
#  ejecutes: Start-ScheduledTask -TaskName BotOposiciones).
#
#  Ejecutar en PowerShell COMO ADMINISTRADOR:
#    powershell -ExecutionPolicy Bypass -File scripts\windows\detener-bot.ps1
# ------------------------------------------------------------------
$TaskName = "BotOposiciones"

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# Primero el bucle que lo reinicia y despues el propio bot
$procs = Get-CimInstance Win32_Process -Filter "Name='cmd.exe' OR Name='node.exe'"
$procs | Where-Object { $_.Name -eq "cmd.exe" -and $_.CommandLine -like "*iniciar-bot.bat*" } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
$procs | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -like "*dist\index.js*" } |
    ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }

Write-Host "Bot detenido."
