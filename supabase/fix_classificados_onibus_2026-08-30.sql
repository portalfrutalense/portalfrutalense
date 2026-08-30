-- ============================================================
-- Corrige o bug: "Ônibus" é uma opção selecionável no formulário de
-- classificados, mas o CHECK constraint da tabela nunca foi atualizado
-- quando o pin "caminhonete" virou "ônibus" (sql/migration-classificados-
-- onibus.sql só mexeu na tabela camadas_config, não em "classificados").
-- Resultado: hoje, publicar um classificado do tipo Ônibus falha com erro
-- do banco. Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- Se o nome abaixo não bater com o real, rode antes esta query pra achar:
--   select conname from pg_constraint
--   where conrelid = 'public.classificados'::regclass and contype = 'c';
-- e troque "classificados_tipo_veiculo_check" pelo nome que aparecer.

ALTER TABLE public.classificados DROP CONSTRAINT IF EXISTS classificados_tipo_veiculo_check;

ALTER TABLE public.classificados ADD CONSTRAINT classificados_tipo_veiculo_check
  CHECK (tipo_veiculo IN ('carro', 'moto', 'onibus', 'caminhao'));

-- Confere que ficou certo:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.classificados'::regclass and contype = 'c';
