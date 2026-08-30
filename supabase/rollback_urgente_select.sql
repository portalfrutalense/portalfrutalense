-- ============================================================
-- ⚠️  HISTÓRICO — NÃO RODE ISTO DEPOIS DE fix_rls_seguranca_2026-08.sql
-- OU fix_rls_seguranca_2026-08-30.sql. Este arquivo reabre a exposição
-- pública de CPF, magic_token e e-mail de autoridade que esses dois
-- corrigiram — ele só existe como registro do que foi rodado numa
-- emergência específica de produção, antes do código ter sido corrigido
-- pra não depender mais de select('*') nessas tabelas. Ver SISTEMA.md
-- §13 para o estado atual esperado.
-- ============================================================

-- ============================================================
-- ROLLBACK URGENTE — restaura select(*) em demandas, demanda_entidades
-- e entidades, que quebrou em produção (403 Forbidden).
--
-- Motivo do erro: no Postgres, "SELECT *" exige permissão em TODAS
-- as colunas da tabela — diferente de nomear colunas específicas,
-- que funciona parcial. As correções anteriores restringiram por
-- coluna (GRANT parcial), e como o app usa select('*') em vários
-- lugares (MapaDemandas.tsx, /perfil), a consulta inteira passou
-- a ser bloqueada em vez de só omitir as colunas sensíveis.
--
-- Rode este arquivo AGORA no SQL Editor do Supabase pra normalizar
-- o site. As outras correções (gatilho de role em perfis, políticas
-- de master em entidades/categorias_mapa/categoria_entidades, e a
-- restrição de UPDATE em demandas) NÃO são afetadas por este rollback
-- e continuam ativas.
-- ============================================================

GRANT SELECT ON public.demandas TO anon, authenticated;
GRANT SELECT ON public.demanda_entidades TO anon, authenticated;
GRANT SELECT ON public.entidades TO anon, authenticated;
