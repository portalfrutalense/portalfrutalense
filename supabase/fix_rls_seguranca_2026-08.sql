-- ============================================================
-- Correção de falhas de RLS encontradas em auditoria (BLOCO 14)
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- Depois de rodar, re-execute a query de pg_policies pra conferir.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CRÍTICO 1 — Usuário conseguia se autopromover a master
-- (UPDATE em perfis não tinha with_check, e nenhum controle de
-- coluna: qualquer um podia mandar {"role":"master"} pro próprio id)
--
-- Fix: gatilho que bloqueia MUDANÇA de role/bloqueado quando quem
-- está editando não é o backend (service_role). Não usa GRANT por
-- coluna de propósito: o ModalCPF faz um upsert que reenvia
-- {role:'cidadao'} mesmo em perfis já existentes — se o valor
-- enviado for igual ao que já está salvo, nada é bloqueado; só
-- barra quando alguém tenta de fato MUDAR o valor por conta própria.
-- O painel /master (que usa a service key no backend) continua livre.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloquear_autopromocao_perfil()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio cargo (role).';
    END IF;
    IF NEW.bloqueado IS DISTINCT FROM OLD.bloqueado THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio status de bloqueio.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_bloquear_autopromocao_perfil ON public.perfis;
CREATE TRIGGER trg_bloquear_autopromocao_perfil
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_autopromocao_perfil();

-- ────────────────────────────────────────────────────────────
-- CRÍTICO 2 — magic_token de demanda_entidades público pra todo mundo
-- (SELECT com qual=true, sem filtro nenhum, expunha a coluna
-- magic_token — o segredo do link /responder/{token})
-- Fix: restringe por GRANT de coluna — remove magic_token,
-- magic_token_expira_em e resposta_ip da leitura pública/autenticada.
-- O app nunca usa essas colunas no client (só resposta/status/entidade),
-- então nada quebra.
-- ────────────────────────────────────────────────────────────
REVOKE SELECT ON public.demanda_entidades FROM anon, authenticated;
GRANT SELECT (id, demanda_id, entidade_id, status, resposta, respondida_em, created_at)
  ON public.demanda_entidades TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- CRÍTICO 2b — CPF do cidadão exposto publicamente via demandas
-- (a tela do /mapa faz select('*') em demandas; a policy de leitura
-- pública não restringe coluna nenhuma, então morador_cpf também
-- vaza pra qualquer um — logado ou não — que consulte a API direto)
-- Fix: restringe por GRANT de coluna — some com morador_cpf,
-- magic_token, magic_token_expira_em e resposta_ip da leitura
-- pública/autenticada. Nenhuma tela usa essas colunas no client.
-- ────────────────────────────────────────────────────────────
REVOKE SELECT ON public.demandas FROM anon, authenticated;
GRANT SELECT (
  id, user_id, morador_nome, categoria_id, entidade_id, descricao,
  lat, lng, endereco_label, foto_url, status, ia_motivo, resposta,
  respondido_em, link_enviado, oculto, created_at
) ON public.demandas TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- MÉDIO 3 — e-mail de autoridade público via entidades
-- (a tabela entidades não restringe coluna nenhuma na leitura
-- pública — nome/cargo devem ser públicos, mas o e-mail direto
-- da autoridade não precisa ser; o app nunca renderiza esse campo
-- pro cidadão, só usa internamente pra enviar notificação)
-- ────────────────────────────────────────────────────────────
REVOKE SELECT ON public.entidades FROM anon, authenticated;
GRANT SELECT (id, nome, cargo, foto_url, ativo, created_at) ON public.entidades TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- CRÍTICO 3 — entidades e categorias_mapa: "admin_*" sem checar master
-- (políticas chamadas admin_* mas com qual/with_check = true,
-- liberado pra {public} — inclusive visitante anônimo)
-- Fix: exige perfis.role = 'master' de verdade.
-- ────────────────────────────────────────────────────────────

-- entidades
DROP POLICY IF EXISTS "admin_excluir_entidades" ON public.entidades;
CREATE POLICY "admin_excluir_entidades" ON public.entidades
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

DROP POLICY IF EXISTS "admin_inserir_entidades" ON public.entidades;
CREATE POLICY "admin_inserir_entidades" ON public.entidades
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

DROP POLICY IF EXISTS "admin_atualizar_entidades" ON public.entidades;
CREATE POLICY "admin_atualizar_entidades" ON public.entidades
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

-- categorias_mapa
DROP POLICY IF EXISTS "admin_excluir_categorias" ON public.categorias_mapa;
CREATE POLICY "admin_excluir_categorias" ON public.categorias_mapa
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

DROP POLICY IF EXISTS "admin_inserir_categorias" ON public.categorias_mapa;
CREATE POLICY "admin_inserir_categorias" ON public.categorias_mapa
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

DROP POLICY IF EXISTS "admin_atualizar_categorias" ON public.categorias_mapa;
CREATE POLICY "admin_atualizar_categorias" ON public.categorias_mapa
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

-- ────────────────────────────────────────────────────────────
-- MÉDIO 1 — categoria_entidades liberado pra qualquer autenticado
-- (devia ser só master, igual entidades/categorias_mapa)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "escrita autenticada categoria_entidades" ON public.categoria_entidades;
CREATE POLICY "escrita master categoria_entidades" ON public.categoria_entidades
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'));

-- ────────────────────────────────────────────────────────────
-- MÉDIO 2 — dono da demanda podia alterar qualquer coluna via API direta
-- (UPDATE só filtra por auth.uid() = user_id, sem restringir QUAL coluna
-- pode mudar — a UI só chama update({status:'resolvida'}), mas a API
-- crua permitiria alterar ia_decisao, ia_motivo, magic_token, etc.)
-- Fix: restringe por GRANT de coluna — dono só pode mudar "status".
-- ────────────────────────────────────────────────────────────
REVOKE UPDATE ON public.demandas FROM authenticated;
GRANT UPDATE (status) ON public.demandas TO authenticated;

-- ────────────────────────────────────────────────────────────
-- BAIXO — chatbot_sem_resposta aceitava INSERT de visitante anônimo
-- (só cidadão logado usa o ChatBot, não precisa ser público)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "insere_sem_resposta" ON public.chatbot_sem_resposta;
CREATE POLICY "insere_sem_resposta" ON public.chatbot_sem_resposta
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- Fim. Depois de rodar, confira com:
--   select schemaname, tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, cmd;
-- ============================================================
