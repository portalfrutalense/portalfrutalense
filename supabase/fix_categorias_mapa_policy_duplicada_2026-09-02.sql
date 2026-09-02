-- ============================================================
-- Limpeza cosmética (achado dentro de B21-3, 2026-09-02): categorias_mapa
-- tem duas policies fazendo a MESMA checagem (role='master') pra cada
-- comando de escrita (INSERT/UPDATE/DELETE) — uma criada em
-- fix_rls_seguranca_2026-08.sql ("admin_*"), outra em
-- fix_tabelas_faltantes_2026-09-01.sql ("master_*"). RLS combina policies
-- permissivas com OR, então a duplicata não é insegura — mas como as duas
-- exigem exatamente a mesma coisa, é peso morto: nenhuma diferença de
-- comportamento, só duas checagens onde bastava uma.
--
-- Mantém o conjunto "master_*" (mais recente, nome consistente com o
-- resto de fix_tabelas_faltantes_2026-09-01.sql) e remove o "admin_*".
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

DROP POLICY IF EXISTS "admin_inserir_categorias" ON public.categorias_mapa;
DROP POLICY IF EXISTS "admin_atualizar_categorias" ON public.categorias_mapa;
DROP POLICY IF EXISTS "admin_excluir_categorias" ON public.categorias_mapa;

-- Confere que ficou só um par de policies por comando:
--   select tablename, policyname, cmd from pg_policies
--   where tablename = 'categorias_mapa' and cmd in ('INSERT','UPDATE','DELETE')
--   order by cmd, policyname;
