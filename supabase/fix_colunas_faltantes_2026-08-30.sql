-- ============================================================
-- Colunas de "demandas" usadas pelo app e por arquivos de fix já
-- commitados, mas nunca criadas em nenhum arquivo SQL versionado do
-- repositório (achado da auditoria de 2026-08-30 — ver SISTEMA.md §12).
--
-- Sem este arquivo, reconstruir o banco do zero só com os SQLs
-- versionados deixaria estas 3 colunas faltando: o GRANT de
-- fix_rls_seguranca_2026-08-30.sql (linha do GRANT SELECT incluindo
-- "protocolo") e o gatilho forcar_demanda_pendente_ao_criar de
-- fix_bloco14_2026-08-30.sql (que zera email_resend_id/email_status)
-- falhariam com "column does not exist".
--
-- Idempotente (IF NOT EXISTS) — seguro rodar mesmo que as colunas já
-- existam no banco em produção (que já as tem, criadas manualmente ou
-- por uma migração que nunca chegou a ser versionada).
-- ============================================================

ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS protocolo text;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS email_resend_id text;
ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS email_status text;

-- protocolo é único por demanda (ver gerar_protocolo/gerar_protocolo_demanda
-- em fix_bloco14_2026-08-30.sql) — mesma constraint já confirmada existir
-- no banco em produção (demandas_protocolo_key). Só cria se ainda não
-- existir, pra não falhar num banco que já tem a constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'demandas_protocolo_key'
  ) THEN
    ALTER TABLE public.demandas ADD CONSTRAINT demandas_protocolo_key UNIQUE (protocolo);
  END IF;
END $$;

-- ============================================================
-- Conferência: as 3 colunas devem aparecer aqui depois de rodar.
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'demandas'
--   and column_name in ('protocolo', 'email_resend_id', 'email_status');
-- ============================================================
