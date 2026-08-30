-- ============================================================
-- BLOCO 14 — Auditoria ao Vivo do Supabase (só leitura, nada é alterado)
--
-- Roda tudo de uma vez no SQL Editor do Supabase. O resultado sai numa
-- única célula, em JSON formatado — copie o resultado inteiro e cole na
-- conversa. Cobre: tabelas e colunas, RLS ligado/desligado, policies,
-- GRANTs por tabela e por coluna, constraints (CHECK/UNIQUE/FK/PK),
-- índices, triggers, funções customizadas, extensões instaladas e
-- buckets do Storage.
--
-- Não cobre pg_cron (schema separado, pode nem existir) — tem uma
-- consulta extra e opcional no final deste arquivo pra isso.
-- ============================================================

select jsonb_pretty(jsonb_build_object(

  'tabelas_e_colunas', (
    select jsonb_agg(t order by t->>'tabela')
    from (
      select jsonb_build_object(
        'tabela', c.table_name,
        'rls_ativado', (
          select pt.rowsecurity from pg_tables pt
          where pt.schemaname = 'public' and pt.tablename = c.table_name
        ),
        'colunas', jsonb_agg(
          jsonb_build_object(
            'coluna', c.column_name,
            'tipo', c.data_type,
            'nulavel', c.is_nullable,
            'default', c.column_default
          ) order by c.ordinal_position
        )
      ) as t
      from information_schema.columns c
      where c.table_schema = 'public'
      group by c.table_name
    ) x
  ),

  'rls_policies', (
    select jsonb_agg(jsonb_build_object(
      'schema', schemaname,
      'tabela', tablename,
      'policy', policyname,
      'comando', cmd,
      'roles', roles,
      'using', qual,
      'with_check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies
    where schemaname in ('public', 'storage')
  ),

  'grants_por_tabela', (
    select jsonb_agg(jsonb_build_object(
      'tabela', table_name,
      'role', grantee,
      'privilegio', privilege_type
    ) order by table_name, grantee, privilege_type)
    from information_schema.table_privileges
    where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
  ),

  'grants_por_coluna', (
    select jsonb_agg(jsonb_build_object(
      'tabela', table_name,
      'coluna', column_name,
      'role', grantee,
      'privilegio', privilege_type
    ) order by table_name, grantee, column_name, privilege_type)
    from information_schema.column_privileges
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
  ),

  'constraints', (
    select jsonb_agg(jsonb_build_object(
      'tabela', conrelid::regclass::text,
      'nome', conname,
      'tipo', case contype
        when 'p' then 'PRIMARY KEY'
        when 'f' then 'FOREIGN KEY'
        when 'u' then 'UNIQUE'
        when 'c' then 'CHECK'
        else contype::text
      end,
      'definicao', pg_get_constraintdef(oid)
    ) order by conrelid::regclass::text, conname)
    from pg_constraint
    where connamespace = 'public'::regnamespace
  ),

  'indices', (
    select jsonb_agg(jsonb_build_object(
      'tabela', tablename,
      'nome', indexname,
      'definicao', indexdef
    ) order by tablename, indexname)
    from pg_indexes
    where schemaname = 'public'
  ),

  'triggers', (
    select jsonb_agg(jsonb_build_object(
      'tabela', event_object_table,
      'nome', trigger_name,
      'evento', event_manipulation,
      'timing', action_timing,
      'acao', action_statement
    ) order by event_object_table, trigger_name)
    from information_schema.triggers
    where trigger_schema = 'public'
  ),

  'funcoes_customizadas', (
    select jsonb_agg(jsonb_build_object(
      'nome', p.proname,
      'seguranca', case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
      'definicao', pg_get_functiondef(p.oid)
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ),

  'extensoes_instaladas', (
    select jsonb_agg(jsonb_build_object('nome', extname, 'versao', extversion) order by extname)
    from pg_extension
  ),

  'storage_buckets', (
    select jsonb_agg(jsonb_build_object(
      'nome', name,
      'publico', public,
      'limite_tamanho_bytes', file_size_limit,
      'tipos_mime_permitidos', allowed_mime_types
    ) order by name)
    from storage.buckets
  )

)) as auditoria_completa;

-- ============================================================
-- Opcional — só roda se você já tiver rodado supabase/fix_bloco11_2026-08-30.sql
-- (o gatilho de status de demandas), que precisa do pg_cron habilitado como
-- efeito colateral. Se der erro "schema cron does not exist", ignore: quer
-- dizer que não há nenhum job de cron agendado neste projeto, o que é
-- esperado desde que o job de "marcar não resolvida" virou um botão manual.
-- ============================================================
-- select jobname, schedule, command, active from cron.job;
