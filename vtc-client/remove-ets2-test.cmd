@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-plugin\test-mode\remove-test-save.ps1" -Game ets2
pause

