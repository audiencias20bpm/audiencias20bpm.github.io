# Sistema de Audiências — Backend Cloudflare v0.11.0

Fundação de migração do Google Apps Script para Cloudflare Workers + D1 + R2.

## Estado desta entrega
- D1: schema completo baseado nas abas/campos existentes do Apps Script.
- R2: binding preparado para PDFs/documentos.
- Sessões: modelo D1 com token armazenado somente como hash.
- Passkeys/WebAuthn: tabelas e endpoints de desafio preparados. O backend não armazena biometria.
- Rotas já implementadas nesta fundação: health, session, logout, audiencias_list, destinatarios_list, usuarios_list, biometria_status, passkey_register_options, passkey_login_options.
- Rotas de escrita, login por senha, validação criptográfica WebAuthn, ofícios e notificações serão portadas no próximo bloco antes de trocar API_BASE_URL do frontend.

IMPORTANTE: não apontar o frontend de produção para este Worker ainda. O Apps Script continua como fallback até equivalência funcional e importação dos dados.
