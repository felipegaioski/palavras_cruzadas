@echo off
setlocal
cd /d "%~dp0"

set "NODE_DIR=C:\laragon\bin\nodejs\node-v18"
if not exist "%NODE_DIR%\node.exe" (
  echo Node.js 18 nao foi encontrado em:
  echo %NODE_DIR%
  echo.
  echo Instale o Node.js 18 ou ajuste NODE_DIR no arquivo start-app.bat.
  pause
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

echo Usando:
"%NODE_EXE%" --version

if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call "%NPM_CMD%" install
  if errorlevel 1 exit /b 1
)

echo Verificando o SQLite...
"%NODE_EXE%" -e "const D=require('better-sqlite3'); const db=new D(':memory:'); db.close()"
if errorlevel 1 (
  echo Reconstruindo o SQLite para esta versao do Node.js...
  call "%NPM_CMD%" rebuild better-sqlite3 --build-from-source
  if errorlevel 1 (
    echo.
    echo Nao foi possivel preparar o SQLite.
    pause
    exit /b 1
  )
)

echo Preparando o aplicativo...
call "%NPM_CMD%" run build
if errorlevel 1 exit /b 1
echo Iniciando Atelie de Cruzadas em http://127.0.0.1:3001
start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\wait-and-open.ps1"
"%NODE_EXE%" dist-server\server\index.js
if errorlevel 1 (
  echo.
  echo O aplicativo foi encerrado por causa de um erro.
  echo Leia a mensagem acima antes de fechar esta janela.
  pause
)
