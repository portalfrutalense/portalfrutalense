-- ============================================================
-- Estrutura pro fluxo do ChatBot via WhatsApp (Evolution API)
-- Rode este arquivo no SQL Editor do Supabase.
-- ============================================================

-- Liga um número de WhatsApp a uma conta existente (perfis).
-- Nullable e único: cada telefone só pode estar vinculado a 1 conta.
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS whatsapp TEXT UNIQUE;

-- Guarda o estado da conversa por telefone, já que não existe "tela"
-- no WhatsApp segurando isso como o navegador faz com o ChatBot do site.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  etapa TEXT NOT NULL DEFAULT 'nenhuma',
  dados_pendentes JSONB DEFAULT NULL, -- guarda descrição/categoria detectada enquanto espera cadastro
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_whatsapp_conversas_updated_at ON public.whatsapp_conversas;
CREATE TRIGGER trg_whatsapp_conversas_updated_at
  BEFORE UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at_whatsapp();

-- RLS: só o backend (service_role) mexe nessa tabela — o navegador nunca
-- acessa direto, tudo passa pela rota /api/whatsapp/webhook.
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "somente_service_role" ON public.whatsapp_conversas;
CREATE POLICY "somente_service_role" ON public.whatsapp_conversas
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
