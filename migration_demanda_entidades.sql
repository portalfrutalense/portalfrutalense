-- Migration: suporte a múltiplas autoridades por demanda
-- Rodar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS demanda_entidades (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  demanda_id            uuid NOT NULL REFERENCES demandas(id) ON DELETE CASCADE,
  entidade_id           uuid NOT NULL REFERENCES entidades(id),
  status                text NOT NULL DEFAULT 'aguardando_resposta',
  resposta              text,
  respondida_em         timestamptz,
  resposta_ip           text,
  magic_token           text UNIQUE,
  magic_token_expira_em timestamptz,
  link_enviado          boolean DEFAULT false,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demanda_entidades_demanda_id_idx ON demanda_entidades(demanda_id);
CREATE INDEX IF NOT EXISTS demanda_entidades_magic_token_idx ON demanda_entidades(magic_token);

-- RLS: leitura pública (respostas são públicas no mapa)
--
-- ATENÇÃO (R2-42, auditoria 2026-09-01): esta policy sozinha é leitura
-- TOTALMENTE aberta — `magic_token`/`resposta_ip`/`email_resend_id`/
-- `email_status` só ficam protegidos por causa do GRANT por coluna feito
-- separadamente em supabase/fix_rls_seguranca_2026-08-30.sql (confirmado
-- em produção no §13.5 do SISTEMA.md). Se algum dia alguém rodar
-- `GRANT SELECT ON demanda_entidades TO authenticated` sem lista de
-- colunas (exatamente o que supabase/rollback_urgente_select.sql fez uma
-- vez, em emergência), essa proteção inteira volta a ficar aberta — NUNCA
-- rode um GRANT SELECT sem colunas nesta tabela.
ALTER TABLE demanda_entidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura_publica" ON demanda_entidades
  FOR SELECT USING (true);

CREATE POLICY "escrita_service_role" ON demanda_entidades
  FOR ALL USING (auth.role() = 'service_role');
