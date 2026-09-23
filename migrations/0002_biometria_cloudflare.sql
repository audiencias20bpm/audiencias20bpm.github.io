-- v0.11.1 - suporte ao token de dispositivo protegido pela biometria/PRF local.
ALTER TABLE passkeys ADD COLUMN device_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_active ON passkeys(credential_id, revogada_em);
