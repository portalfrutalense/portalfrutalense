-- Habilita a extensão pg_cron (rodar uma vez no SQL Editor do Supabase)
-- Se já estiver habilitada, ignore esta linha
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job diário às 03:00 — marca como "nao_resolvida" demandas com mais de 30 dias
-- que ainda estejam em aguardando_resposta ou respondida
SELECT cron.schedule(
  'marcar_nao_resolvida',   -- nome do job
  '0 3 * * *',              -- todo dia às 03:00
  $$
    UPDATE demandas
    SET status = 'nao_resolvida'
    WHERE status IN ('aguardando_resposta', 'respondida')
      AND created_at < NOW() - INTERVAL '30 days';
  $$
);

-- Para verificar jobs agendados:
-- SELECT * FROM cron.job;

-- Para remover o job (se precisar recriar):
-- SELECT cron.unschedule('marcar_nao_resolvida');
