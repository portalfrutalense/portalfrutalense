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
