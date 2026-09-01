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
