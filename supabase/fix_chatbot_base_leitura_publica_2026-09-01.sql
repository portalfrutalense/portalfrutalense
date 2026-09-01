-- ============================================================
-- CRÍTICO — achado ao vivo em 2026-09-01, fora do escopo original da
-- auditoria: existe uma policy "leitura publica chatbot_base" com
-- roles={public} e qual=true — leitura TOTALMENTE aberta, inclusive pra
-- quem não está logado, via chamada direta à API REST do Supabase (só com
-- a chave anônima, que já é pública no próprio site).
--
-- `chatbot_base` é o texto que vai inteiro pro system prompt dos dois bots
-- (site e WhatsApp) — não deveria ter leitura pública nenhuma; o servidor
-- (service_role, que ignora RLS) é quem sempre leu essa tabela pra montar
-- o prompt. Essa policy não veio de nenhum arquivo desta auditoria — é
-- anterior, origem desconhecida — e anula a restrição de
-- `master_le_chatbot_base` (policies de RLS se combinam com OR).
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

DROP POLICY IF EXISTS "leitura publica chatbot_base" ON public.chatbot_base;

-- Confere que ficou certo (deve sobrar só as 4 policies master_*):
--   select policyname, cmd, roles, qual from pg_policies where tablename = 'chatbot_base';
