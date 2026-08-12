@echo off
cd /d "%~dp0"
set "VTC_NODE=%~dp0runtime-node\node.exe"
if not exist "%VTC_NODE%" set "VTC_NODE=node.exe"
if not exist "%VTC_NODE%" where node.exe >nul 2>nul || (echo Die VTC-Client-Laufzeit fehlt.& pause & exit /b 1)
start "VTC Truck Hub Client" /min "%VTC_NODE%" "launcher.mjs"
start "VTC Ingame Overlay" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-plugin\overlay-host\overlay-host.ps1"
start "VTC Truck Hub Launcher" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0launcher-window.ps1"
exit /b 0
