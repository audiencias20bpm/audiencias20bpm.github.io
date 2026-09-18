# Sistema de Audiências — Cloudflare backend v0.11.1

Bloco de migração do backend Google para Cloudflare.

## Incluído
- Login compatível com o hash legado do Apps Script (10.000 SHA-256).
- Sessões persistidas no D1 e protegidas por HMAC-SHA256.
- Listagens iniciais de audiências, destinatários e usuários.
- Base para WebAuthn/passkeys.
- Gerador local de SQL para importar o XLSX atual sem versionar dados pessoais/credenciais.

## Segurança
O arquivo `.local/import_current.sql` contém dados reais e é ignorado pelo Git. PASSWORD_PEPPER e SESSION_SECRET devem ser configurados como Cloudflare secrets e nunca gravados no repositório.

## Importação
1. Coloque `SISTEMA_AUDIENCIAS_DB.xlsx` na raiz do projeto.
2. Instale openpyxl localmente se necessário: `py -m pip install openpyxl`.
3. Execute: `py tools/generate_d1_import.py SISTEMA_AUDIENCIAS_DB.xlsx .local/import_current.sql`.
4. Importe: `npx wrangler d1 execute audiencias20bpm --remote --file=.local/import_current.sql`.
