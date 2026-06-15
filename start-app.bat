@echo off
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

:: --- CONFIGURAÇÃO PORTÁTIL / CUSTOMIZADA ---
:: set "NODE_DIR=C:\laragon\bin\nodejs\node-v18"

:: Se a variável NODE_DIR foi definida acima, injeta ela no PATH
if defined NODE_DIR (
    if exist "%NODE_DIR%\node.exe" (
        set "PATH=%NODE_DIR%;%PATH%"
        echo [Aviso] Usando Node.js customizado de: %NODE_DIR%
    ) else (
        echo [Erro] NODE_DIR foi definida, mas node.exe nao foi encontrado em: %NODE_DIR%
        pause
        exit /b 1
    )
)

:: Valida se o Node.js está acessível (seja global ou via NODE_DIR)
where node >nul 2>nul
if errorlevel 1 (
    echo [Erro] Node.js nao foi encontrado no sistema 'Global' nem via configuracao local.
    echo Por favor, instale o Node.js ou configure a variavel NODE_DIR dentro deste script.
    pause
    exit /b 1
)

echo Usando versao do Node:
node --version

:: --- INSTALAÇÃO E DEPENDÊNCIAS ---
if not exist node_modules (
    echo Instalando dependencias pela primeira vez...
    call npm install
    if errorlevel 1 exit /b 1
)

echo Verificando o SQLite...
node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); db.close()" 2>nul
if errorlevel 1 (
    echo Reconstruindo o SQLite para esta versao do Node.js...
    call npm rebuild better-sqlite3 --build-from-source
    if errorlevel 1 (
        echo.
        echo Nao foi possivel preparar o SQLite.
        pause
        exit /b 1
    )
)

:: --- INICIALIZAÇÃO DO APP ---
echo Preparando o aplicativo...
call npm run build
if errorlevel 1 exit /b 1

echo Iniciando Atelie de Cruzadas em http://127.0.0.1:3001
start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\wait-and-open.ps1"

node dist-server\server\index.js
if errorlevel 1 (
    echo.
    echo O aplicativo foi encerrado por causa de um erro.
    echo Leia a mensagem acima antes de fechar esta janela.
    pause
)