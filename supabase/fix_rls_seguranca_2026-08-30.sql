-- ============================================================
-- Correções de RLS da auditoria de 2026-08-30 — rode este arquivo
-- inteiro no SQL Editor do Supabase.
--
-- Contexto: a auditoria de 2026-08 (fix_rls_seguranca_2026-08.sql) já
-- tinha identificado e corrigido a exposição pública de CPF, magic_token
-- e e-mail de autoridade — mas a correção teve que ser revertida em
-- produção (rollback_urgente_select.sql) porque o app ainda fazia
-- select('*') em demandas/demanda_entidades/entidades, e o Postgres exige
-- GRANT em TODAS as colunas para select('*') funcionar.
--
-- Nesta sessão, todo select('*') nessas três tabelas foi removido do
-- código (trocado por listas explícitas de coluna) — então agora dá para
-- reaplicar a restrição sem quebrar o site de novo.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CRÍTICO 1 — CPF, magic_token e e-mail de autoridade expostos
-- Reaplica a restrição por coluna, agora com a lista completa do que o
-- app realmente usa (a tentativa de 2026-08 esqueceu "protocolo" e
-- "ia_motivo", que o /perfil e o mapa usam — por isso incluí aqui).
-- ────────────────────────────────────────────────────────────
REVOKE SELECT ON public.demandas FROM anon, authenticated;
GRANT SELECT (
  id, user_id, morador_nome, categoria_id, entidade_id, descricao,
  lat, lng, endereco_label, foto_url, status, ia_motivo, resposta,
  respondido_em, link_enviado, oculto, created_at, protocolo
) ON public.demandas TO anon, authenticated;

REVOKE SELECT ON public.demanda_entidades FROM anon, authenticated;
GRANT SELECT (id, demanda_id, entidade_id, status, resposta, respondida_em, created_at)
  ON public.demanda_entidades TO anon, authenticated;

REVOKE SELECT ON public.entidades FROM anon, authenticated;
GRANT SELECT (id, nome, cargo, foto_url, ativo, created_at) ON public.entidades TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- CRÍTICO 2 — pets/classificados/empregos podiam se auto-aprovar
-- (o autor podia mudar oculto/ia_decisao/ia_motivo/expira_em do próprio
-- registro via API direta do Supabase, revertendo moderação sozinho —
-- a mesma falha que já tinha sido corrigida em "demandas", nunca
-- replicada aqui)
--
-- Pré-requisito já resolvido nesta sessão: a moderação do painel master
-- (toggle de oculto/encerrada) passou a usar uma rota de servidor com
-- service_role (/api/master/camada), que ignora este GRANT — então
-- restringir o autor aqui não quebra o painel administrativo.
--
-- As colunas liberadas abaixo são exatamente as que os formulários de
-- edição do próprio autor usam (FormPet.tsx, FormClassificado.tsx,
-- CamadaEmpregos.tsx, e os botões "marcar como reencontrado/vendido/
-- encerrar vaga") — nada de moderação (oculto, ia_decisao, ia_motivo,
-- ia_analisado_em, expira_em) entra na lista.
-- ────────────────────────────────────────────────────────────
REVOKE UPDATE ON public.pets FROM authenticated;
GRANT UPDATE (
  autor_nome, tipo, especie, nome_pet, raca, cor, porte, descricao,
  lat, lng, endereco_label, foto_url, contato, reencontrado, reencontrado_em
) ON public.pets TO authenticated;

REVOKE UPDATE ON public.classificados FROM authenticated;
GRANT UPDATE (
  autor_nome, tipo_veiculo, titulo, marca, modelo, ano, km, cor, preco,
  aceita_troca, descricao, lat, lng, bairro_label, fotos, contato, vendido
) ON public.classificados TO authenticated;

REVOKE UPDATE ON public.empregos FROM authenticated;
GRANT UPDATE (
  empresa_nome, cargo, area, contrato, salario, salario_a_combinar, vagas,
  descricao, requisitos, lat, lng, endereco_label, logo_url, contato, encerrada
) ON public.empregos TO authenticated;

-- ============================================================
-- Depois de rodar: teste o app inteiro (mapa de demandas, /perfil,
-- editar/ocultar/reexibir pet, classificado e vaga pelo painel master,
-- reencontrar pet, marcar vendido, encerrar vaga) antes de considerar
-- concluído. Se algo voltar a dar 403, o motivo é sempre o mesmo: uma
-- consulta pedindo select('*') ou update(objeto-inteiro) numa coluna
-- que não está na lista acima — ache a query e restrinja as colunas
-- nela, não abra o GRANT de novo.
--
-- Para conferir o estado atual de tudo:
--   select schemaname, tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'public' order by tablename, cmd;
-- ============================================================
