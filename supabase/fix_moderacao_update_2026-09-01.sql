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
