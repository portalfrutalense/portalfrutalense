-- ================================================================
-- ARQUIVO COMBINADO — rode este inteiro, de uma vez, no SQL Editor
-- do Supabase. Junta os 7 arquivos pendentes (5 bloqueantes + 2 de
-- segurança) da auditoria de 2026-09-01, na ordem certa de execução.
-- Gerado a partir de:
--   1. fix_tabelas_faltantes_2026-09-01.sql
--   2. fix_pets_data_hora_2026-09-01.sql
--   3. fix_chat_conversas_2026-09-01.sql
--   4. fix_demandas_via_chatbot_2026-09-01.sql
--   5. fix_moderacao_update_2026-09-01.sql
--   6. fix_demanda_entidades_unique_2026-09-01.sql
--   7. fix_grant_pets_classificados_2026-09-01.sql
-- ================================================================


-- ################################################################
-- ## PARTE: fix_tabelas_faltantes_2026-09-01.sql
-- ################################################################
-- ============================================================
-- Erros #42/#43 da auditoria (B24-1 CRÍTICO / B24-2 CRÍTICO): quatro
-- tabelas usadas pelo código inteiro não tinham `CREATE TABLE` em nenhum
-- arquivo versionado fora de `supabase/schema.sql` (que tem aviso "não
-- rode" — é schema legado). Rodando os arquivos de sql/ num banco limpo,
-- a criação falhava: `sql/migration-demandas.sql` referencia
-- `categorias_mapa(id)` e `entidades(id)` por FK antes de essas tabelas
-- existirem em qualquer lugar versionado.
--
-- Além de criar as tabelas, `chatbot_base` nunca teve NENHUMA policy de RLS
-- versionada — e tem seu conteúdo injetado NA ÍNTEGRA no system prompt do
-- chat do site e do bot do WhatsApp. Sem RLS, qualquer usuário autenticado
-- reescreveria as instruções do bot pra todos os cidadãos. Mesma dúvida
-- (menor) valia pra `categoria_entidades`, também coberta aqui.
--
-- Rode este arquivo ANTES dos arquivos de sql/ num banco reconstruído do
-- zero. Em um banco que já tem essas tabelas, `IF NOT EXISTS` faz os
-- CREATE TABLE não fazerem nada — mas as policies de RLS são recriadas
-- (DROP + CREATE) mesmo assim, pra garantir que ficam version conforme
-- este arquivo mesmo se alguém tiver criado alguma à mão pelo painel do
-- Supabase antes.
-- ============================================================

-- ── entidades (autoridades: vereadores, secretários) ──────────────────────
-- `id` não tem FK pra auth.users de propósito: o `entidade_id` é setado
-- explicitamente igual ao `user_id` quando a autoridade tem conta própria
-- (ver /api/master/criar-perfil), mas a tabela não depende disso — evita
-- que excluir a conta do Auth cascateie e destrua respostas oficiais já
-- publicadas (essa proteção já existe via ON DELETE RESTRICT em
-- demanda_entidades.entidade_id, ver B24-4).
CREATE TABLE IF NOT EXISTS public.entidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  email TEXT NOT NULL,
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.entidades ENABLE ROW LEVEL SECURITY;

-- Leitura pública pra escolher autoridade nos formulários (nome/cargo/foto);
-- `email` já é restrito por GRANT de coluna em fix_rls_seguranca_2026-08-30.sql
-- (não repetido aqui — aquele arquivo é a fonte da verdade pra isso).
DROP POLICY IF EXISTS "leitura_publica_entidades" ON public.entidades;
CREATE POLICY "leitura_publica_entidades" ON public.entidades
  FOR SELECT USING (true);

-- Escrita só via service_role (rotas /api/master/*) — nenhuma policy de
-- INSERT/UPDATE/DELETE pra anon/authenticated de propósito.

-- ── categorias_mapa (categorias de demanda) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias_mapa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#ef4444',
  icone TEXT,
  icone_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.categorias_mapa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_publica_categorias_mapa" ON public.categorias_mapa;
CREATE POLICY "leitura_publica_categorias_mapa" ON public.categorias_mapa
  FOR SELECT USING (true);

-- master/page.tsx escreve DIRETO do navegador nesta tabela — precisa de
-- policy de escrita pra role='master', diferente de entidades/chatbot_base.
DROP POLICY IF EXISTS "master_escreve_categorias_mapa" ON public.categorias_mapa;
CREATE POLICY "master_escreve_categorias_mapa" ON public.categorias_mapa
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_atualiza_categorias_mapa" ON public.categorias_mapa;
CREATE POLICY "master_atualiza_categorias_mapa" ON public.categorias_mapa
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_exclui_categorias_mapa" ON public.categorias_mapa;
CREATE POLICY "master_exclui_categorias_mapa" ON public.categorias_mapa
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

-- ── categoria_entidades (vínculo categoria ↔ autoridade) ───────────────────
CREATE TABLE IF NOT EXISTS public.categoria_entidades (
  categoria_id UUID NOT NULL REFERENCES public.categorias_mapa(id) ON DELETE CASCADE,
  entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  PRIMARY KEY (categoria_id, entidade_id)
);

ALTER TABLE public.categoria_entidades ENABLE ROW LEVEL SECURITY;

-- Leitura pública: usada no cliente (useChatBot.ts, formulário de demanda)
-- pra escolher qual autoridade cobrar por categoria, sem precisar da IA.
DROP POLICY IF EXISTS "leitura_publica_categoria_entidades" ON public.categoria_entidades;
CREATE POLICY "leitura_publica_categoria_entidades" ON public.categoria_entidades
  FOR SELECT USING (true);

-- Escrita só via service_role (/api/master/criar-perfil, /api/master/perfis).

-- ── chatbot_base (base de conhecimento dos bots) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chatbot_base ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de sql/chatbot_config_policy.sql — só master lê e escreve.
-- Não existe leitura pública: quem usa o conteúdo é sempre o servidor
-- (supabaseServer, service_role) ao montar o prompt do chat/WhatsApp.
DROP POLICY IF EXISTS "master_le_chatbot_base" ON public.chatbot_base;
CREATE POLICY "master_le_chatbot_base" ON public.chatbot_base
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_escreve_chatbot_base" ON public.chatbot_base;
CREATE POLICY "master_escreve_chatbot_base" ON public.chatbot_base
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_atualiza_chatbot_base" ON public.chatbot_base;
CREATE POLICY "master_atualiza_chatbot_base" ON public.chatbot_base
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_exclui_chatbot_base" ON public.chatbot_base;
CREATE POLICY "master_exclui_chatbot_base" ON public.chatbot_base
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

-- Confere que ficou certo:
--   select tablename, policyname, cmd from pg_policies
--   where tablename in ('entidades','categorias_mapa','categoria_entidades','chatbot_base')
--   order by tablename, cmd;


-- ################################################################
-- ## PARTE: fix_pets_data_hora_2026-09-01.sql
-- ################################################################
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


-- ################################################################
-- ## PARTE: fix_chat_conversas_2026-09-01.sql
-- ################################################################
-- ============================================================
-- Erro #34 da auditoria (B18-2): o histórico do chat do site vinha inteiro
-- do cliente a cada mensagem, sem nenhum estado guardado no servidor — dava
-- pra forjar falas do próprio assistente editando o payload no DevTools.
-- Esta tabela replica o MESMO PADRÃO já usado em whatsapp_conversas (o
-- servidor é quem guarda e decide o histórico real), mas chaveada por
-- user_id (o chat do site sempre exige login, diferente do WhatsApp) em vez
-- de telefone, e sem as colunas de fluxo específicas do webhook
-- (etapa/dados_pendentes não fazem sentido aqui — o fluxo guiado de
-- demanda do site já é conduzido no client por useChatBot.ts).
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_chat_conversas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_conversas_updated_at ON public.chat_conversas;
CREATE TRIGGER trg_chat_conversas_updated_at
  BEFORE UPDATE ON public.chat_conversas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at_chat_conversas();

-- RLS: só o backend (service_role) mexe nessa tabela — o navegador nunca
-- acessa direto, tudo passa por /api/chat. Mesmo modelo de whatsapp_conversas.
ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "somente_service_role" ON public.chat_conversas;
CREATE POLICY "somente_service_role" ON public.chat_conversas
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Confere que ficou certo:
--   select tablename, policyname, roles, cmd from pg_policies where tablename = 'chat_conversas';


-- ################################################################
-- ## PARTE: fix_demandas_via_chatbot_2026-09-01.sql
-- ################################################################
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


-- ################################################################
-- ## PARTE: fix_moderacao_update_2026-09-01.sql
-- ################################################################
-- ============================================================
-- Erro #79 da auditoria (R2-32, confirma o crítico 2/B12-1): os gatilhos de
-- moderação de fix_bloco14_2026-08-30.sql são todos BEFORE INSERT — não
-- existe nenhum gatilho de UPDATE em pets/classificados que force a
-- reanálise ou zere ia_decisao quando o conteúdo é editado. Hoje, quem
-- garante que editar um pet/classificado já aprovado volta pra moderação é
-- só a rota `PATCH /api/camadas` (Erro #5 desta auditoria) — funciona
-- porque é o único caminho de escrita sancionado (RLS restringe o autor a
-- colunas de conteúdo, sem tocar em ia_decisao). Este arquivo é defesa em
-- profundidade: mesmo que essa garantia da API/RLS falhe ou seja
-- reconfigurada por engano no futuro, o banco não deixa um UPDATE de
-- conteúdo por fora do service_role manter ia_decisao='aprovada'.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- IMPORTANTE: não pode disparar em QUALQUER update de não-service_role.
-- `reencontrado`/`reencontrado_em` (pets) e `vendido` (classificados) são
-- colunas que o próprio dono também tem permissão de escrever direto
-- (GRANT em fix_rls_seguranca_2026-08-30.sql, botões "marcar como
-- reencontrado/vendido" em MapaDemandas.tsx) — e essa ação NÃO deveria
-- exigir reanálise da IA. Só reseta ia_decisao quando uma coluna de
-- CONTEÚDO de verdade mudou (o que o dono edita via FormPet/FormClassificado).
CREATE OR REPLACE FUNCTION public.forcar_pet_pendente_ao_editar()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.tipo IS DISTINCT FROM OLD.tipo OR
    NEW.especie IS DISTINCT FROM OLD.especie OR
    NEW.nome_pet IS DISTINCT FROM OLD.nome_pet OR
    NEW.raca IS DISTINCT FROM OLD.raca OR
    NEW.cor IS DISTINCT FROM OLD.cor OR
    NEW.porte IS DISTINCT FROM OLD.porte OR
    NEW.descricao IS DISTINCT FROM OLD.descricao OR
    NEW.data_hora_aproximada IS DISTINCT FROM OLD.data_hora_aproximada OR
    NEW.lat IS DISTINCT FROM OLD.lat OR
    NEW.lng IS DISTINCT FROM OLD.lng OR
    NEW.endereco_label IS DISTINCT FROM OLD.endereco_label OR
    NEW.foto_url IS DISTINCT FROM OLD.foto_url OR
    NEW.contato IS DISTINCT FROM OLD.contato
  ) THEN
    NEW.ia_decisao := 'pendente';
    NEW.ia_motivo := NULL;
    NEW.ia_analisado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_forcar_pet_pendente_ao_editar ON public.pets;
CREATE TRIGGER trg_forcar_pet_pendente_ao_editar
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.forcar_pet_pendente_ao_editar();

CREATE OR REPLACE FUNCTION public.forcar_classificado_pendente_ao_editar()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.tipo_veiculo IS DISTINCT FROM OLD.tipo_veiculo OR
    NEW.titulo IS DISTINCT FROM OLD.titulo OR
    NEW.marca IS DISTINCT FROM OLD.marca OR
    NEW.modelo IS DISTINCT FROM OLD.modelo OR
    NEW.ano IS DISTINCT FROM OLD.ano OR
    NEW.km IS DISTINCT FROM OLD.km OR
    NEW.cor IS DISTINCT FROM OLD.cor OR
    NEW.preco IS DISTINCT FROM OLD.preco OR
    NEW.aceita_troca IS DISTINCT FROM OLD.aceita_troca OR
    NEW.descricao IS DISTINCT FROM OLD.descricao OR
    NEW.lat IS DISTINCT FROM OLD.lat OR
    NEW.lng IS DISTINCT FROM OLD.lng OR
    NEW.bairro_label IS DISTINCT FROM OLD.bairro_label OR
    NEW.fotos IS DISTINCT FROM OLD.fotos OR
    NEW.contato IS DISTINCT FROM OLD.contato
  ) THEN
    NEW.ia_decisao := 'pendente';
    NEW.ia_motivo := NULL;
    NEW.ia_analisado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_forcar_classificado_pendente_ao_editar ON public.classificados;
CREATE TRIGGER trg_forcar_classificado_pendente_ao_editar
  BEFORE UPDATE ON public.classificados
  FOR EACH ROW EXECUTE FUNCTION public.forcar_classificado_pendente_ao_editar();

-- Nota: usa 'pendente' aqui (não NULL, como o gatilho de INSERT) porque é
-- exatamente o valor que `PATCH /api/camadas` (service_role) já grava numa
-- edição legítima — mantém as duas convenções que o painel master já sabe
-- reconhecer (estaPendenteDeIA trata `null` e `'pendente'` como
-- equivalentes), sem introduzir uma terceira.
--
-- Confere que ficou certo:
--   select tgname, tgrelid::regclass, tgtype from pg_trigger
--   where tgname like 'trg_forcar_%_pendente_ao_editar';


-- ################################################################
-- ## PARTE: fix_demanda_entidades_unique_2026-09-01.sql
-- ################################################################
-- ============================================================
-- Erro #44 da auditoria (B24-3): não existia UNIQUE (demanda_id, entidade_id)
-- em demanda_entidades — só magic_token era único. Enviando a mesma
-- autoridade repetida (`entidade_ids: ["A","A","A"]`, ou o modelo de IA do
-- WhatsApp repetindo um id), a mesma autoridade recebia múltiplos vínculos e
-- múltiplos e-mails, e /api/autoridade/denunciar e
-- /api/autoridade/marcar-resolvida (que usam `.single()`) passavam a falhar
-- sempre pra ela, com o erro enganoso "Demanda não direcionada a você".
--
-- O código (/api/demandas e /api/whatsapp/webhook) já foi corrigido pra
-- deduplicar antes de inserir — esta constraint é defesa em profundidade,
-- pra nenhum caminho futuro reintroduzir o mesmo bug sem que o banco recuse.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- Se já existirem duplicatas hoje (dos bugs acima, antes da correção), a
-- constraint falha ao criar. Rode esta query ANTES pra checar:
--   select demanda_id, entidade_id, count(*) from demanda_entidades
--   group by demanda_id, entidade_id having count(*) > 1;
-- Se aparecer alguma linha, decida manualmente quais vínculos duplicados
-- remover (mantendo o que já tiver resposta, se houver) antes de continuar.

-- Postgres não aceita "ADD CONSTRAINT IF NOT EXISTS" — o bloco abaixo checa
-- manualmente antes de adicionar, pra rodar sem erro numa segunda execução.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demanda_entidades_demanda_entidade_unique'
      AND conrelid = 'public.demanda_entidades'::regclass
  ) THEN
    ALTER TABLE public.demanda_entidades
      ADD CONSTRAINT demanda_entidades_demanda_entidade_unique
      UNIQUE (demanda_id, entidade_id);
  END IF;
END $$;

-- Confere que ficou certo:
--   select conname from pg_constraint
--   where conrelid = 'public.demanda_entidades'::regclass and contype = 'u';


-- ################################################################
-- ## PARTE: fix_grant_pets_classificados_2026-09-01.sql
-- ################################################################
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

