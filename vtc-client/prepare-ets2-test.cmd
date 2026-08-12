@echo off
cd /d "%~dp0"
if exist "%~dp0active-test-save.json" goto starttest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-plugin\test-mode\prepare-test-save.ps1" -Game ets2
if errorlevel 1 (pause & exit /b 1)
:starttest
echo.
echo Starte VTC-Client, TAB-Overlay und ETS2 ...
start "VTC Truck Hub Client Test" /min cmd.exe /c "set VTC_LOCAL_PORT=27111&& node launcher.mjs"
timeout /t 2 >nul
start "VTC Ingame Overlay Test" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-plugin\overlay-host\overlay-host.ps1" -Port 27111
start "" "C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\eurotrucks2.exe"
echo Lade im Spiel den Spielstand "VTC Dispatcher Test - Kiel nach Malmo".
pause
