-- ============================================================
-- Diagnóstico de pendências — roda tudo de uma vez e devolve uma tabela
-- só, com o status de cada item. Copia o resultado inteiro (todas as
-- linhas) e cola de volta na conversa.
-- ============================================================

select * from (

  -- 1. fix_perfis_unique_2026-08-30.sql
  select '1. fix_perfis_unique — CPF único' as item,
    case when exists (select 1 from pg_constraint where conname = 'perfis_cpf_unique' and conrelid = 'public.perfis'::regclass)
      then 'OK — constraint existe' else 'FALTA RODAR' end as status
  union all
  select '1. fix_perfis_unique — email único',
    case when exists (select 1 from pg_constraint where conname = 'perfis_email_unique' and conrelid = 'public.perfis'::regclass)
      then 'OK — constraint existe' else 'FALTA RODAR' end

  union all

  -- 2. fix_classificados_onibus_2026-08-30.sql
  select '2. fix_classificados_onibus',
    coalesce((select 'OK — ' || pg_get_constraintdef(oid) from pg_constraint
      where conrelid = 'public.classificados'::regclass and contype = 'c' and conname ilike '%tipo_veiculo%' limit 1),
      'FALTA RODAR (constraint não encontrada)')

  union all

  -- 3. chatbot_sem_resposta_policy.sql
  select '3. chatbot_sem_resposta — policy de leitura do master',
    case when exists (select 1 from pg_policies where tablename = 'chatbot_sem_resposta' and cmd = 'SELECT')
      then 'OK — existe policy de SELECT' else 'FALTA RODAR (sem policy de SELECT — aba fica vazia)' end

  union all

  -- 4. fix_bloco11_2026-08-30.sql
  select '4. fix_bloco11 — gatilho restringir_status_demanda',
    case when exists (select 1 from pg_trigger where tgname ilike '%restringir_status%')
      then 'OK — gatilho existe' else 'FALTA RODAR' end
  union all
  select '4. fix_bloco11 — tabela ia_historico removida',
    case when to_regclass('public.ia_historico') is null
      then 'OK — não existe mais' else 'FALTA RODAR (ia_historico ainda existe)' end

  union all

  -- 5. fix_bloco14_2026-08-30.sql
  select '5. fix_bloco14 — gatilhos forcar_pendente_ao_criar (pets/classificados)',
    case when (select count(*) from pg_trigger where tgname like 'trg_forcar_%_pendente_ao_criar') >= 2
      then 'OK — gatilhos existem' else 'FALTA RODAR' end
  union all
  select '5. fix_bloco14 — demandas nao_resolvida visível no mapa público',
    case when exists (
        select 1 from pg_policies where tablename = 'demandas' and cmd = 'SELECT'
          and qual ilike '%nao_resolvida%'
      ) then 'OK — policy inclui nao_resolvida' else 'FALTA RODAR (ou já era diferente)' end

  union all

  -- 6. sql/migration-pets-config-por-especie.sql
  select '6. migration-pets-config-por-especie',
    coalesce((select 'OK — ' || count(*) || ' linhas pet_* em camadas_config'
      from camadas_config where chave like 'pet_%'), 'FALTA RODAR (tabela/linhas não encontradas)')

  union all

  -- 7. Confirmação extra: os 7 arquivos de 2026-09-01 (fix_TUDO_pendente) já rodados
  select '7. fix_TUDO — tabelas novas (entidades/categorias_mapa/categoria_entidades/chatbot_base/chat_conversas)',
    (select count(*)::text || '/5 encontradas' from pg_tables where schemaname = 'public'
      and tablename in ('entidades','categorias_mapa','categoria_entidades','chatbot_base','chat_conversas'))
  union all
  select '7. fix_TUDO — pets.data_hora_aproximada',
    case when exists (select 1 from information_schema.columns where table_name='pets' and column_name='data_hora_aproximada')
      then 'OK' else 'FALTA' end
  union all
  select '7. fix_TUDO — demandas.via_chatbot',
    case when exists (select 1 from information_schema.columns where table_name='demandas' and column_name='via_chatbot')
      then 'OK' else 'FALTA' end
  union all
  select '7. fix_TUDO — UNIQUE demanda_entidades',
    case when exists (select 1 from pg_constraint where conname = 'demanda_entidades_demanda_entidade_unique')
      then 'OK' else 'FALTA' end
  union all
  select '7. fix_TUDO — gatilhos forcar_pendente_ao_editar',
    case when (select count(*) from pg_trigger where tgname like 'trg_forcar_%_pendente_ao_editar') >= 2
      then 'OK' else 'FALTA' end
  union all
  select '7. fix_TUDO — GRANT restrito (pets/classificados só reencontrado/vendido)',
    (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
      from information_schema.column_privileges
      where table_name in ('pets','classificados') and grantee = 'authenticated' and privilege_type = 'UPDATE')

) t
order by item;
