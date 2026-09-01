-- ============================================================
-- Erro #36 da auditoria (B10-1): o campo "data e hora aproximada" (quando
-- o pet sumiu/foi encontrado) é obrigatório no formulário de pets
-- perdido/achado, mas nunca era salvo em lugar nenhum — nem existia coluna
-- pra isso na tabela. O cidadão era forçado a preencher um dado descartado,
-- e pior: editar um pet perdido/achado sempre falhava na validação (o campo
-- nascia vazio na tela de edição, por não ter de onde vir).
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS data_hora_aproximada TIMESTAMPTZ;

-- Confere que ficou certo:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'pets' and column_name = 'data_hora_aproximada';
