@echo off
setlocal
cd /d "%~dp0"
if not exist data\palavras-cruzadas.sqlite (
  echo Ainda nao existe um banco de dados para copiar.
  pause
  exit /b 1
)
if not exist backups mkdir backups
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set stamp=%%I
if not defined stamp set stamp=backup
copy /y "data\palavras-cruzadas.sqlite" "backups\palavras-cruzadas-%stamp%.sqlite" >nul
if errorlevel 1 (
  echo Nao foi possivel criar o backup. Feche o aplicativo e tente novamente.
  pause
  exit /b 1
)
echo Backup criado em backups\palavras-cruzadas-%stamp%.sqlite
pause
