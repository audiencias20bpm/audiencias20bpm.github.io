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

Login por senha, validação/restauração da sessão, contador visual, logout seguro e dashboard básico por perfil implementados. Os módulos funcionais e Passkey/WebAuthn permanecem para etapas posteriores.

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

## 0.3.0 - Dashboard básico e perfis

- substitui a tela de confirmação de login pelo painel principal autenticado;
- mantém contador de sessão e logout no cabeçalho do painel;
- exibe módulos operacionais para DEV e ADMINISTRADOR;
- exibe a seção `Administração DEV` somente para o perfil DEV;
- mantém os módulos como estrutura visual sem executar operações ainda;
- deixa explícito que a autorização real continua sendo validada no backend;
- adiciona `js/dashboard.js` para manter a renderização do painel separada da autenticação.

## 0.4.0 - Identidade visual e favicon

- adiciona favicon profissional do Sistema de Audiências;
- inclui ícones 32, 180, 192 e 512 px;
- integra favicon ao navegador e ícones ao manifest da PWA;
- atualiza cache do Service Worker para incluir os novos ativos;
- preserva integralmente login, sessão, logout e dashboard v0.3.0.

## v0.4.0 - Audiencias Fase 1

- card Audiências passa a abrir o modulo funcional;
- listagem protegida por sessao valida;
- autorizacao real no Apps Script para DEV e ADMINISTRADOR;
- estados de carregamento, vazio e erro;
- nenhuma criacao, edicao ou exclusao nesta fase;
- backend: adicionar `Audiencias.gs` e substituir `Router.gs` pela versao entregue.


## v0.5.0 — Cadastro de Audiências

- mantém listagem segura da v0.4.0;
- adiciona formulário responsivo de nova audiência;
- adiciona rota backend `POST audiencias_create`;
- código pode ser informado ou gerado automaticamente;
- status inicial é controlado pelo backend como `AGENDADA`;
- campos técnicos e de auditoria são preenchidos pelo servidor;
- criação exige sessão válida e perfil DEV ou ADMINISTRADOR;
- após salvar, a lista é recarregada e exibe o novo registro.


## v0.6.3 — Múltiplos militares por audiência

- substitui o campo manual `destinatario_id` por seleção operacional de militares via RG;
- permite adicionar vários militares à mesma audiência;
- consulta RG no backend e preenche Nome/CPF/WhatsApp/Unidade quando já cadastrado;
- se o RG não existir, o operador informa os dados e o cadastro é persistido automaticamente ao salvar a audiência;
- cria a relação normalizada `AUDIENCIA_DESTINATARIOS`;
- mantém `destinatario_id` em AUDIENCIAS apenas como compatibilidade legada, apontando para o primeiro militar;
- adiciona coluna Militares à listagem de audiências;
- base cadastral inicial fornecida pelo responsável pode ser importada uma única vez no Apps Script;
- nenhum CPF/RG da base é colocado no repositório público do frontend.


## v0.6.3 — Busca cadastral e WhatsApp

- campo Código removido do formulário; o backend sempre gera o identificador da audiência;
- RG, CPF e Nome consultam a mesma base cadastral;
- busca por nome oferece sugestões quando há mais de um resultado;
- WhatsApp informado é persistido no cadastro do militar ao salvar a audiência;
- em usos futuros, o WhatsApp salvo retorna automaticamente junto com RG, CPF e Nome.


## v0.6.3
- adiciona botão **Limpar dados** no cadastro do militar;
- preserva CPFs com zero à esquerda;
- mantém busca por RG, CPF ou Nome;
- mantém gravação e retorno automático do WhatsApp.


## v0.6.3 — Rodapé institucional

- remove a mensagem técnica de HTTPS do rodapé;
- move a versão para o canto superior direito do cartão principal;
- adiciona identificação institucional do Sistema de Audiências • 20º BPM;
- informa desenvolvimento pelo P4/20º BPM;
- adiciona canal clicável para dúvidas, sugestões ou problemas: audiencias.20.bpm@gmail.com.
