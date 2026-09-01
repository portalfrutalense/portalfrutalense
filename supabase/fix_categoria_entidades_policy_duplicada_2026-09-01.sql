-- ============================================================
-- Limpeza (não é bug de segurança): `categoria_entidades` tinha duas
-- policies de SELECT fazendo exatamente a mesma coisa (leitura pública) —
-- uma de origem anterior desconhecida ("leitura publica categoria_entidades",
-- com espaço no nome) e outra criada por fix_tabelas_faltantes_2026-09-01.sql
-- ("leitura_publica_categoria_entidades", com underscore). Remove a
-- duplicata antiga, mantém a versionada.
-- ============================================================

DROP POLICY IF EXISTS "leitura publica categoria_entidades" ON public.categoria_entidades;

-- Confere que ficou certo (deve sobrar só 1 policy de SELECT):
--   select policyname, cmd from pg_policies where tablename = 'categoria_entidades';
