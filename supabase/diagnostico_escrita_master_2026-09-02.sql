-- ============================================================
-- Diagnóstico B21-3 (2026-09-02): confirma se as 6 tabelas que
-- master/page.tsx e MasterCamadas.tsx escrevem DIRETO DO NAVEGADOR
-- (sem passar por rota de API/service_role) estão protegidas por RLS
-- pra que só o master consiga de fato gravar nelas.
--
-- Versão combinada num único SELECT — roda tudo de uma vez, um resultado
-- só, sem precisar rodar bloco por bloco.
-- ============================================================

select 'GRANT' as tipo, table_name as tabela, grantee as detalhe_1,
       string_agg(privilege_type, ', ' order by privilege_type) as detalhe_2, null as detalhe_3
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('categorias_mapa', 'ia_config', 'chatbot_config', 'chatbot_base', 'chatbot_sem_resposta', 'camadas_config')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
group by table_name, grantee

union all

select 'POLICY' as tipo, tablename as tabela, cmd as detalhe_1,
       roles::text as detalhe_2, coalesce(qual, with_check) as detalhe_3
from pg_policies
where schemaname = 'public'
  and tablename in ('categorias_mapa', 'ia_config', 'chatbot_config', 'chatbot_base', 'chatbot_sem_resposta', 'camadas_config')
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')

union all

select 'RLS_LIGADO' as tipo, relname as tabela, relrowsecurity::text as detalhe_1, null, null
from pg_class
where relname in ('categorias_mapa', 'ia_config', 'chatbot_config', 'chatbot_base', 'chatbot_sem_resposta', 'camadas_config')
  and relnamespace = 'public'::regnamespace

order by tabela, tipo;
