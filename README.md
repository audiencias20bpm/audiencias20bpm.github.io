# Sistema de Audiências — 20º BPM

Versão 0.12.4 — backend operacional em Cloudflare Workers + D1 + R2.

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
