@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-VTC-ETS2-Client.ps1"
if errorlevel 1 (
  echo.
  echo Installation fehlgeschlagen. Bitte die angezeigte Meldung notieren.
  pause
  exit /b 1
)
echo.
echo VTC Truck Hub ETS2 Client wurde installiert.
pause
