-- ============================================================
-- Erro #82 da auditoria (R2-40, confirma B11-1 por outra via): o GRANT de
-- coluna de `fix_rls_seguranca_2026-08-30.sql` libera UPDATE direto pra
-- `authenticated` em TODAS as colunas de conteúdo de pets/classificados
-- (incluindo lat/lng) — na época em que foi escrito, isso ainda fazia
-- sentido, porque editar ia direto do cliente.
--
-- Isso mudou nesta mesma sessão de auditoria (Erro #5): editar pet ou
-- classificado agora SEMPRE passa por `PATCH /api/camadas`, que roda como
-- service_role (ignora GRANT/RLS) — é o único jeito de reenviar o registro
-- pra moderação da IA ao editar. O GRANT antigo ficou mais permissivo do
-- que qualquer fluxo legítimo precisa: um cliente alterado (ou uma chamada
-- direta à API do Supabase) ainda pode gravar lat/lng exatos em
-- classificados, contornando `aproximarCoordenada` (a "localização
-- aproximada" prometida na interface) — e editar QUALQUER campo de
-- conteúdo sem passar pela reanálise da IA, o próprio buraco que o Erro #5
-- fechou no código, ainda aberto no banco.
--
-- As ÚNICAS escritas diretas do cliente que continuam legítimas em
-- pets/classificados são os botões "marcar como reencontrado"/"marcar como
-- vendido" (MapaDemandas.tsx) — nada mais.
--
-- Empregos NÃO entra aqui: edição de vaga continua direto do cliente
-- (decisão de produto — vagas nunca passaram por moderação de IA), então o
-- GRANT amplo de `empregos` continua necessário e não foi tocado.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

REVOKE UPDATE ON public.pets FROM authenticated;
GRANT UPDATE (reencontrado, reencontrado_em) ON public.pets TO authenticated;

REVOKE UPDATE ON public.classificados FROM authenticated;
GRANT UPDATE (vendido) ON public.classificados TO authenticated;

-- Depois de rodar: teste "marcar como reencontrado" (pet perdido) e "marcar
-- como vendido" (classificado) direto no mapa — devem continuar
-- funcionando. Teste também editar um pet/classificado pelo formulário
-- (deve seguir funcionando, porque passa por /api/camadas, não por essas
-- colunas liberadas aqui).
--
-- Confere que ficou certo:
--   select table_name, column_name, privilege_type from information_schema.column_privileges
--   where table_name in ('pets','classificados') and grantee = 'authenticated' and privilege_type = 'UPDATE'
--   order by table_name, column_name;
