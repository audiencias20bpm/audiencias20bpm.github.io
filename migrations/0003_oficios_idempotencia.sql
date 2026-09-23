-- v0.11.2 - geração idempotente de ofícios sem consumir número na prévia.
ALTER TABLE oficios ADD COLUMN request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_oficios_request_id ON oficios(request_id) WHERE request_id IS NOT NULL;
