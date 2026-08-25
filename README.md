# Sistema de Audiências

Frontend web/PWA do Sistema de Audiências.

## Estrutura inicial

- `index.html`
- `manifest.json`
- `sw.js`
- `css/app.css`
- `js/config.js`
- `js/api.js`
- `js/auth.js`
- `js/session.js`
- `assets/icons/`
- `assets/img/`

## Arquitetura

- Frontend: HTML, CSS e JavaScript puro
- Hospedagem: GitHub Pages
- Backend: Google Apps Script
- Banco: Google Sheets
- Documentos: Google Drive

## Segurança

Nenhuma senha, hash, salt, `PASSWORD_PEPPER`, `SESSION_SECRET`, token da Meta ou outra credencial sensível deve ser armazenada neste repositório.

A autorização real permanece no backend.

## Estado atual

Estrutura inicial do frontend criada. Login, sessão e dashboard ainda não foram implementados nesta etapa.

## 0.2.1 - Correcao de integracao do login

- leitura do token alinhada ao contrato real do Apps Script: `data.sessao.token`;
- armazenamento temporario em `sessionStorage`;
- cache do PWA versionado para evitar JavaScript antigo apos deploy;
- assets do login com cache-busting `v=0.2.1`;
- backend e regras de autenticacao preservados.


## Versao 0.2.2
- valida sessao existente no backend ao recarregar a pagina;
- exibe contador visual de 30 minutos;
- estados de atencao em 5 minutos e critico em 1 minuto;
- renova a sessao somente em resposta a atividade do usuario, com limite de chamadas;
- limpa a sessao local quando expira;
- preserva login e backend aprovados.
