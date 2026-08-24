-- ============================================================
-- Correção: evita reprocessar a mesma mensagem duas vezes
-- (webhook duplicado, comportamento comum de APIs de webhook)
-- ============================================================

ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS ultimo_message_id TEXT;
