# Sistema de Audiências — 20º BPM

Versão 0.12.5 — backend operacional em Cloudflare Workers + D1 + R2.

## Arquitetura atual
- Frontend/PWA estático.
- API: Cloudflare Worker `audiencias20bpm-api`.
- Banco: Cloudflare D1 `audiencias20bpm`.
- Documentos: Cloudflare R2 `audiencias20bpm-documentos`.
- Autenticação, sessões, usuários, destinatários, audiências, ofícios, documentos, notificações e confirmação pública atendidos pelo Worker.
- Google Apps Script não é dependência operacional do frontend/API desta versão.
- WhatsApp permanece em MODO TESTE até a configuração das credenciais/templates do Meta Developers.

## Segurança
Segredos não são versionados. PASSWORD_PEPPER e SESSION_SECRET permanecem como Wrangler secrets. Credenciais futuras da Meta também devem ser secrets.


## WhatsApp Cloud API — webhook (v0.12.5)

Endpoint de produção preparado no Worker: `/api/whatsapp/webhook`.

Segredos obrigatórios no Cloudflare Worker (nunca versionar no Git):

- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: token privado criado pelo administrador para a verificação do webhook da Meta.
- `META_APP_SECRET`: segredo do app da Meta usado para validar `X-Hub-Signature-256` nos eventos recebidos.

Nesta versão o envio real pelo WhatsApp continua desativado. O webhook já valida a assinatura da Meta, registra mensagens recebidas em `eventos` e atualiza estados de notificações quando existir correspondência por `wamid`.
