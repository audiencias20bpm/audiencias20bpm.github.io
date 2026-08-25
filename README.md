# Sistema de Audiências

Frontend web/PWA do Sistema de Audiências.

## Estrutura

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

A autenticação, a autorização e a validade real da sessão permanecem controladas pelo backend.

## Estado atual

Login por senha, validação/restauração da sessão, contador visual e logout seguro implementados. Dashboard e Passkey/WebAuthn permanecem para etapas posteriores.

## 0.2.1 - Integração do login

- leitura do token alinhada ao contrato real do Apps Script: `data.sessao.token`;
- armazenamento temporário em `sessionStorage`;
- cache do PWA versionado para evitar JavaScript antigo após deploy;
- backend e regras de autenticação preservados.

## 0.2.2 - Controle visual da sessão

- valida sessão existente no backend ao recarregar a página;
- exibe contador visual de 30 minutos;
- estados de atenção em 5 minutos e crítico em 1 minuto;
- renova a sessão somente em resposta à atividade do usuário, com limite de chamadas;
- limpa a sessão local quando expira.

## 0.2.3 - Restauração da sessão

- evita exibir o formulário de login durante a validação de uma sessão já existente;
- mostra `Validando sessão...` durante F5/reabertura da página;
- limita o contador visual ao máximo de `30:00`, preservando a validade real controlada pelo backend.

## 0.2.4 - Logout seguro

- adiciona botão `Sair` somente na área autenticada;
- exibe imediatamente `Encerrando sessão...`;
- bloqueia cliques repetidos durante o logout;
- invalida o token pela rota `POST logout` do backend;
- limpa os dados locais somente após confirmação do servidor;
- retorna ao login após o encerramento confirmado;
- em falha de rede, preserva a sessão local e permite nova tentativa, evitando declarar logout seguro sem confirmação do backend.
