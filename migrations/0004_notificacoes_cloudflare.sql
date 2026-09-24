-- v0.12.0 - Notificacoes 100% Cloudflare e backfill dos oficios ja gerados
CREATE INDEX IF NOT EXISTS idx_notificacoes_token_hash ON notificacoes(token_hash);
CREATE INDEX IF NOT EXISTS idx_notificacoes_oficio ON notificacoes(oficio_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_status ON notificacoes(status);

INSERT OR IGNORE INTO notificacoes (id,chave_idempotencia,audiencia_id,destinatario_id,oficio_id,tipo,telefone,template,status,tentativas,provider,criado_em,criado_por,atualizado_em)
SELECT 'ciencia-'||o.id,'ciencia-'||o.id,o.audiencia_id,o.destinatario_id,o.id,'OFICIO',COALESCE(d.telefone,''),'audiencia_ciencia','PENDENTE',0,'CLOUDFLARE',COALESCE(o.criado_em,datetime('now')),o.criado_por,COALESCE(o.atualizado_em,o.criado_em,datetime('now')) FROM oficios o LEFT JOIN destinatarios d ON d.id=o.destinatario_id WHERE o.status='GERADO';

INSERT OR IGNORE INTO notificacoes (id,chave_idempotencia,audiencia_id,destinatario_id,oficio_id,tipo,telefone,template,data_programada,status,tentativas,provider,criado_em,criado_por,atualizado_em)
SELECT 'lembrete-'||o.id,'lembrete-'||o.id,o.audiencia_id,o.destinatario_id,o.id,'LEMBRETE',COALESCE(d.telefone,''),'audiencia_lembrete',CASE WHEN a.data_hora IS NOT NULL THEN datetime(a.data_hora,'-1 day') ELSE NULL END,'PENDENTE',0,'CLOUDFLARE',COALESCE(o.criado_em,datetime('now')),o.criado_por,COALESCE(o.atualizado_em,o.criado_em,datetime('now')) FROM oficios o LEFT JOIN destinatarios d ON d.id=o.destinatario_id LEFT JOIN audiencias a ON a.id=o.audiencia_id WHERE o.status='GERADO';
