-- ============================================================
-- Correções da auditoria do BLOCO 11 (Migrações SQL) — rode este
-- arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 🔴 CRÍTICO — cidadão podia pular a moderação da própria demanda
-- (GRANT UPDATE (status) restringe a COLUNA, mas nenhum CHECK ou
-- trigger restringe o VALOR — uma chamada direta à API do Supabase
-- podia setar status de uma demanda "pendente" (nunca moderada)
-- direto pra "resolvida", pulando IA e master por completo)
--
-- Fix: gatilho no mesmo estilo de bloquear_autopromocao_perfil —
-- fora do backend (service_role), só permite ir para "resolvida",
-- e só a partir de aguardando_resposta/respondida/nao_resolvida.
-- O painel /master e as rotas de IA (que usam service_role) não são
-- afetados.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restringir_status_demanda()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status <> 'resolvida' OR OLD.status NOT IN ('aguardando_resposta', 'respondida', 'nao_resolvida') THEN
      RAISE EXCEPTION 'Só é permitido marcar a própria demanda como resolvida, a partir de aguardando resposta, respondida ou não resolvida.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_restringir_status_demanda ON public.demandas;
CREATE TRIGGER trg_restringir_status_demanda
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.restringir_status_demanda();

-- ────────────────────────────────────────────────────────────
-- 🟡 MÉDIO — "marcar como não resolvida" deixou de ser um job
-- automático (pg_cron) — o usuário decidiu não usar cron/job nenhum
-- pra isso, mesma escolha já feita antes para "reprocessar pendentes"
-- (ver POST /api/master/reprocessar-pendentes). Passa a ser um botão
-- manual no painel master: POST /api/master/marcar-nao-resolvidas
-- (rota nova, criada no código — nada a rodar aqui pra essa parte).
-- Se o job "marcar_nao_resolvida" chegou a ser agendado antes (via
-- sql/job_nao_resolvida.sql), desagenda com:
--   SELECT cron.unschedule('marcar_nao_resolvida');
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 🟡 MÉDIO — chatbot_sem_resposta foi criada em dois arquivos diferentes
-- (sql/chatbot_sem_resposta.sql e sql/chatbot_extras.sql), cada um com
-- sua própria policy de INSERT: uma restrita a auth.uid() = user_id,
-- outra com WITH CHECK (true). Se ambas foram rodadas em algum momento,
-- RLS combina as duas com OR — a mais permissiva neutraliza a mais
-- restrita, permitindo inserir com user_id de outra pessoa. Remove a
-- permissiva; mantém só a restrita.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "insere_sem_resposta" ON public.chatbot_sem_resposta;
DROP POLICY IF EXISTS "usuario_insere" ON public.chatbot_sem_resposta;
CREATE POLICY "usuario_insere" ON public.chatbot_sem_resposta
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- ⚪ BAIXO — ia_historico nunca é usada pelo código da aplicação
-- (histórico de decisão da IA vive nas colunas ia_decisao/ia_motivo/
-- ia_analisado_em de cada tabela). Remove a tabela morta, se existir.
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.ia_historico;

-- ────────────────────────────────────────────────────────────
-- ⚪ BAIXO — empregos_empresa_edita: o WITH CHECK não repetia a
-- condição role='empresa' presente no USING (assimetria, não uma
-- brecha explorável na prática, mas incorreta por princípio).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "empregos_empresa_edita" ON public.empregos;
CREATE POLICY "empregos_empresa_edita" ON public.empregos
  FOR UPDATE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'empresa')
  ) WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'empresa')
  );

-- ============================================================
-- Depois de rodar, confira o gatilho de status com uma tentativa de
-- burlar (deve falhar): update demandas set status = 'aguardando_resposta'
-- numa demanda que está com status = 'pendente', logado como o próprio
-- autor — deve dar erro "Só é permitido marcar...".
-- ============================================================
