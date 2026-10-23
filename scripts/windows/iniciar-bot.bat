@echo off
rem ------------------------------------------------------------------
rem  Mantiene el bot funcionando: si se cierra, lo vuelve a arrancar
rem  a los 10 segundos. Lo ejecuta el Programador de tareas de Windows.
rem  Parametro opcional: ruta completa de node.exe
rem ------------------------------------------------------------------
set "NODE=%~1"
if "%NODE%"=="" set "NODE=node"

rem Carpeta del proyecto (dos niveles por encima de este archivo)
cd /d "%~dp0..\.."
if not exist logs mkdir logs

:bucle
echo [%date% %time%] Arrancando el bot >> logs\bot.log
"%NODE%" dist\index.js >> logs\bot.log 2>&1
echo [%date% %time%] El bot se ha cerrado (codigo %errorlevel%). Reinicio en 10 s >> logs\bot.log
rem "timeout" no funciona sin consola, por eso se espera con ping
ping -n 11 127.0.0.1 > nul
goto bucle
