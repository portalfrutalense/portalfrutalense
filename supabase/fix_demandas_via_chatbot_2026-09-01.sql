-- ============================================================
-- Erro #92 da auditoria (B18-8): o chat do site já manda `via_chatbot: true`
-- no corpo de POST /api/demandas, mas a rota sempre ignorou o campo — não
-- existia coluna pra guardar isso, nem forma nenhuma de saber quais
-- demandas vieram do assistente de IA (site ou WhatsApp) vs. do formulário
-- direto do mapa.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS via_chatbot BOOLEAN NOT NULL DEFAULT false;

-- Confere que ficou certo:
--   select column_name, data_type, column_default from information_schema.columns
--   where table_name = 'demandas' and column_name = 'via_chatbot';
