-- ============================================================
-- Correções da auditoria ao vivo do Supabase (BLOCO 14) — rode este
-- arquivo inteiro no SQL Editor do Supabase.
--
-- O app (todas as rotas /api/demandas, /api/camadas, webhook do
-- WhatsApp) sempre insere usando o cliente service_role — nada aqui
-- muda o comportamento normal do site. Isso só fecha um caminho que
-- só existe pra quem chama a API do Supabase diretamente, por fora
-- do app.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 🔴 CRÍTICO 1 — demanda podia nascer já "aprovada", pulando IA e
-- master por completo.
-- (O gatilho do Bloco 11, restringir_status_demanda, só protege
-- UPDATE — nunca foi testado o caminho de INSERT. Os GRANTs por
-- coluna liberam status/ia_decisao/oculto/magic_token etc. pra
-- INSERT de "authenticated", e a policy de INSERT só confere
-- auth.uid() = user_id, sem restringir nenhum valor. Uma chamada
-- direta à API do Supabase podia criar a própria demanda já com
-- status='aguardando_resposta' e ia_decisao='aprovada'.)
--
-- Fix: gatilho BEFORE INSERT que força os campos de moderação/e-mail
-- pros valores seguros de uma demanda recém-criada, fora do backend.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.forcar_demanda_pendente_ao_criar()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.status := 'pendente';
    NEW.ia_decisao := NULL;
    NEW.ia_motivo := NULL;
    NEW.ia_analisado_em := NULL;
    NEW.oculto := false;
    NEW.magic_token := NULL;
    NEW.magic_token_expira_em := NULL;
    NEW.link_enviado := false;
    NEW.resposta := NULL;
    NEW.respondido_em := NULL;
    NEW.resposta_ip := NULL;
    NEW.email_resend_id := NULL;
    NEW.email_status := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_forcar_demanda_pendente_ao_criar ON public.demandas;
CREATE TRIGGER trg_forcar_demanda_pendente_ao_criar
  BEFORE INSERT ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.forcar_demanda_pendente_ao_criar();

-- ────────────────────────────────────────────────────────────
-- 🔴 CRÍTICO 1b — mesma classe de problema em pets e classificados:
-- um registro podia nascer já com ia_decisao='aprovada', disfarçando
-- que já passou pela moderação (sai da fila "Pendente IA" do painel
-- master sem ter sido revisado de verdade).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.forcar_pet_pendente_ao_criar()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.ia_decisao := NULL;
    NEW.ia_motivo := NULL;
    NEW.ia_analisado_em := NULL;
    NEW.oculto := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_forcar_pet_pendente_ao_criar ON public.pets;
CREATE TRIGGER trg_forcar_pet_pendente_ao_criar
  BEFORE INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.forcar_pet_pendente_ao_criar();

CREATE OR REPLACE FUNCTION public.forcar_classificado_pendente_ao_criar()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.ia_decisao := NULL;
    NEW.ia_motivo := NULL;
    NEW.ia_analisado_em := NULL;
    NEW.oculto := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_forcar_classificado_pendente_ao_criar ON public.classificados;
CREATE TRIGGER trg_forcar_classificado_pendente_ao_criar
  BEFORE INSERT ON public.classificados
  FOR EACH ROW EXECUTE FUNCTION public.forcar_classificado_pendente_ao_criar();

-- ────────────────────────────────────────────────────────────
-- 🔴 CRÍTICO 2 — demandas "não resolvida" são invisíveis no mapa
-- público: nenhuma das duas policies de SELECT público incluía
-- 'nao_resolvida' na lista de status permitidos — bug que já vinha
-- do schema original (migration-demandas.sql), nunca corrigido.
-- Além disso havia DUAS policies fazendo praticamente a mesma coisa
-- ("Autenticados veem demandas públicas" exige auth.role() =
-- 'authenticated'; "leitura publica demandas" não exige nada) — RLS
-- combina as duas com OR, então a exigência de autenticação da
-- primeira já era neutralizada pela segunda na prática. Mantém só
-- uma, com o status corrigido.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados veem demandas públicas" ON public.demandas;
DROP POLICY IF EXISTS "leitura publica demandas" ON public.demandas;

CREATE POLICY "leitura publica demandas" ON public.demandas
  FOR SELECT USING (
    oculto = false AND
    status IN ('aguardando_resposta', 'respondida', 'resolvida', 'nao_resolvida')
  );

-- ============================================================
-- Depois de rodar, confira:
--   1. Tente inserir uma demanda de teste (autenticado, cliente
--      normal — não service_role) com status='aguardando_resposta'
--      forçado no payload; o registro deve gravar mesmo assim como
--      'pendente'.
--   2. select status, count(*) from demandas group by status;
--      — deve continuar existindo demandas 'nao_resolvida', e agora
--      elas devem aparecer numa consulta pública (sem estar logado)
--      contra a tabela.
-- ============================================================
