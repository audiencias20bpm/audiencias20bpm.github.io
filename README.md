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

## v0.6.4 — Saída rápida global

- adiciona botão **Sair** em posição consistente ao final de todas as telas autenticadas;
- reutiliza o logout seguro já aprovado, sem duplicar lógica;
- remove o botão de saída exclusivo do painel para evitar duplicidade;
- mantém o botão invisível na tela de login;
- atualiza versão e cache do frontend para `0.6.4`.

## v0.8.0 — Destinatários Fase 1

- habilita o módulo **Destinatários** no painel;
- lista a base cadastral dos militares para usuários autenticados;
- adiciona pesquisa instantânea por RG, CPF, Nome ou WhatsApp;
- exibe RG, Nome, CPF, WhatsApp, Unidade e Status;
- preserva zeros à esquerda em CPF;
- mantém autorização real no backend para DEV e ADMINISTRADOR;
- não implementa edição, exclusão ou cadastro manual nesta fase;
- adiciona `js/destinatarios.js` ao frontend.

## v0.8.0

- padroniza altura e alinhamento dos botões;
- mantém cards do painel com ações alinhadas;
- remove scroll horizontal desnecessário das tabelas em desktop;
- permite quebra controlada de nomes e textos longos;
- melhora o aproveitamento da largura da tabela de Audiências e Destinatários;
- preserva rolagem horizontal apenas em telas menores quando necessária.

## v0.8.0

- Destinatários Fase 2: edição segura de cadastro.
- Permite atualizar RG, CPF, Nome, WhatsApp, Unidade e Status.
- Preserva IDs e vínculos existentes com audiências.
- Não há exclusão física de destinatários.

## v0.8.1 — Dados fixos e contato atualizável

- RG, CPF e Nome passam a ser somente leitura na manutenção cadastral comum.
- WhatsApp, Unidade e Status permanecem editáveis.
- O backend ignora tentativas de alteração dos dados fixos nessa rota e preserva os valores já cadastrados.
- WhatsApp informado durante uma audiência continua podendo atualizar o cadastro para retornar automaticamente nos próximos usos.

## v0.8.2 — Pesquisa de audiências e limpeza do painel

- adiciona pesquisa instantânea na lista de audiências;
- permite localizar audiências por RG, CPF ou Nome do militar;
- também pesquisa por código, processo, assunto, local, modalidade e status;
- mostra quantidade de resultados filtrados;
- adiciona ação para limpar a busca;
- remove texto explicativo desnecessário do painel principal;
- não altera backend, autenticação, sessões ou regras de negócio.

## v0.8.3 — Detalhes completos da audiência

- adiciona ação **Ver detalhes** na listagem de audiências;
- exibe Processo, Assunto, Data/hora, Modalidade, Local, Link, Observações e Status;
- lista todos os militares vinculados com RG, CPF, WhatsApp e Unidade disponíveis;
- usa os dados já retornados pela API de listagem, sem criar nova rota ou chamadas extras;
- mantém busca, cadastro, destinatários, sessão e logout já aprovados;
- não altera o Google Apps Script nesta etapa.

## v0.9.0 — Estrutura de Ofícios

- habilita o módulo Documentos/Ofícios;
- adiciona configuração inicial do ano e último número já utilizado;
- calcula o próximo número sem consumi-lo;
- adiciona configuração do signatário padrão;
- adiciona Posto/Graduação como dado atualizável do militar;
- preserva RG, CPF e Nome como dados fixos;
- prepara as abas CONFIGURACOES e OFICIOS no backend;
- não gera PDF nem envia WhatsApp nesta fase.

## v0.9.2 — Nome de guerra do signatário

- mantém o nome completo do signatário como texto puro;
- adiciona marcação separada do nome de guerra para renderização em negrito no ofício;
- permite selecionar o trecho e usar botão visível em desktop/mobile;
- aceita Ctrl+B e Ctrl+N no desktop;
- adiciona prévia da assinatura;
- adiciona botão Limpar dados para facilitar mudança de comando;
- não gera PDF nem envia WhatsApp nesta fase.

## v0.9.3 — Painel operacional de Ofícios

- Ofícios abre em visão operacional quando a configuração já existe.
- Exibe próximo número, signatário atual e situação da configuração.
- A configuração fica acessível por botão próprio e deixa de ser a tela principal do uso diário.
- Instalações ainda não configuradas continuam abrindo diretamente a configuração inicial.
- Geração de PDF e histórico permanecem preparados visualmente para as próximas etapas, sem funções simuladas.
- Nenhuma alteração de backend nesta versão.

## v0.9.4 — Preparação e prévia de Ofícios

- habilita a ação **Gerar ofício** no painel operacional;
- carrega as audiências já cadastradas sem criar nova rota;
- permite selecionar um militar vinculado à audiência;
- preenche automaticamente processo, data, local, posto/graduação, RG e WhatsApp disponíveis;
- usa a próxima numeração configurada apenas como prévia, sem consumi-la;
- solicita somente o destinatário judicial e, opcionalmente, o trecho complementar em vermelho;
- monta prévia do conteúdo com texto-base padronizado e assinatura configurada;
- mantém a geração de PDF desabilitada até a próxima fase;
- não altera o Google Apps Script nesta versão.

## v0.9.7 — Ofício fiel ao modelo e geração de PDF

- usa os três brasões extraídos do modelo oficial fornecido;
- inclui campo editável de Posto/Graduação do militar, preenchido automaticamente quando disponível;
- atualiza o Posto/Graduação cadastral quando alterado durante a emissão;
- remove negrito indevido do militar, processo e número;
- preserva negrito institucional do cabeçalho, Assunto e nome de guerra do signatário;
- gera PDF A4 real no navegador, salva cópia no Google Drive via backend e baixa uma cópia no dispositivo;
- reserva a numeração anual atomicamente antes da emissão e registra o ofício para histórico.

## v0.9.7 — estabilização da reserva e prévia A4

- consolida o backend de Ofícios com as funções auxiliares exigidas pela emissão;
- evita falha `ERRO_RESERVA_OFICIO` causada por função ausente;
- adiciona rollback defensivo para não consumir numeração em caso de falha;
- ajusta a prévia para uma apresentação visual mais próxima de uma folha A4;
- em larguras intermediárias, formulário e prévia passam a empilhar para evitar documento excessivamente estreito.

## v0.9.7

- mantém a prévia do ofício sempre abaixo do formulário;
- centraliza a folha em proporção A4 e limita sua largura visual;
- melhora a leitura em desktop, tablet, Android e iOS;
- evita a mensagem técnica de AbortSignal e apresenta mensagem amigável em timeout;
- aumenta o timeout de comunicação com o Apps Script para 45 segundos.

Deploy retry: v0.9.7
