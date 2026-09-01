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
