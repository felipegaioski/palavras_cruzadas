# Ateliê de Cruzadas

Aplicativo local para criar, salvar e imprimir palavras cruzadas no estilo
Coquetel. Funciona no Chrome e no Edge e não precisa de internet depois da
instalação.

## Requisitos

- Windows 10 ou 11;
- Node.js 18 ou mais recente;
- Chrome ou Edge atualizado.

## Iniciar no Windows

1. Dê dois cliques em `start-app.bat`.
2. Na primeira execução, aguarde a instalação das dependências.
3. O navegador abrirá em `http://127.0.0.1:3001`.
4. Mantenha a janela preta aberta enquanto estiver usando o aplicativo.

Também é possível iniciar pelo terminal:

```powershell
npm install
npm run build
npm start
```

Para desenvolvimento, com atualização automática:

```powershell
npm run dev
```

O frontend usa `http://127.0.0.1:5173` e a API usa
`http://127.0.0.1:3001`.

## Onde os dados ficam

As cruzadas são salvas em:

```text
data/palavras-cruzadas.sqlite
```

Essa pasta não é substituída pelo build. Não apague o arquivo SQLite durante
uma atualização.

## Backup e restauração

Feche o aplicativo e dê dois cliques em `backup-data.bat`. A cópia será criada
na pasta `backups`, com data e hora no nome.

Para restaurar:

1. Feche o aplicativo.
2. Renomeie o arquivo atual em `data` para guardá-lo.
3. Copie o backup escolhido para `data`.
4. Renomeie a cópia para `palavras-cruzadas.sqlite`.

## Atualizar

1. Feche o aplicativo.
2. Faça um backup.
3. Substitua os arquivos do projeto, preservando a pasta `data`.
4. Execute:

```powershell
npm install
npm run build
```

As migrações necessárias são aplicadas automaticamente ao iniciar.

## Testes

```powershell
npm run check
npm test
npm run test:e2e
```

O teste de navegador requer o Chromium do Playwright. Se ainda não estiver
instalado:

```powershell
npx playwright install chromium
```

## Estrutura

- `src/client`: interface React e editor SVG;
- `src/server`: API Fastify e persistência Drizzle/SQLite;
- `src/shared`: modelo, subdivisão retangular e validações compartilhadas;
- `drizzle`: migração inicial;
- `tests`: testes Vitest;
- `e2e`: fluxos Playwright;
- `docs`: especificações e guia de uso.

Consulte [docs/03-guia-de-uso.md](docs/03-guia-de-uso.md) para o passo a passo
do editor.
