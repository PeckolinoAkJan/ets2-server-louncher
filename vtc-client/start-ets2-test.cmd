@echo off
cd /d "%~dp0"
if not exist "%~dp0active-test-save.json" (
  echo Der VTC-Test-Spielstand ist nicht vorbereitet. Starte zuerst prepare-ets2-test.cmd.
  pause
  exit /b 1
)
start "VTC Truck Hub Client Test" /min cmd.exe /c "set VTC_LOCAL_PORT=27111&& node launcher.mjs"
timeout /t 2 >nul
start "VTC Ingame Overlay Test" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-plugin\overlay-host\overlay-host.ps1" -Port 27111
start "" "C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\eurotrucks2.exe"
echo VTC-Test gestartet. Lade in ETS2: VTC Dispatcher Test - Kiel nach Malmo
echo Im Spiel oeffnet und schliesst TAB den Dispatcher.
