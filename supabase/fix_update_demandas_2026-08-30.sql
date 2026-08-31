-- ============================================================
-- Restringe UPDATE por coluna em "demandas" e "demanda_entidades" — rode
-- este arquivo inteiro no SQL Editor do Supabase.
--
-- Achado: fix_rls_seguranca_2026-08-30.sql (§13) só restringiu SELECT
-- nessas tabelas (CPF/magic_token/e-mail públicos) e UPDATE em
-- pets/classificados/empregos (auto-aprovação). Nunca restringiu UPDATE em
-- "demandas"/"demanda_entidades" — o GRANT de coluna ainda libera
-- magic_token, magic_token_expira_em, resposta_ip, email_resend_id e
-- email_status pra escrita de authenticated/anon, sem nenhuma policy de
-- RLS restringindo QUAL coluna pode ser alterada (só QUAL linha, via
-- auth.uid() = user_id).
--
-- Risco real: um cidadão logado, via chamada direta à API do Supabase
-- (fora do app), pode sobrescrever o magic_token/resposta_ip/email_status
-- da PRÓPRIA demanda com qualquer valor. Não expõe dado de terceiros (a
-- policy de linha continua exigindo ser o dono), mas corrompe o link de
-- resposta da própria demanda ou forja o status de e-mail exibido no
-- painel master.
--
-- "demanda_entidades" já está protegida no nível de RLS (a única policy
-- que permite UPDATE ali exige auth.role() = 'service_role' — nenhuma
-- linha é alterável por authenticated/anon, então o GRANT de coluna hoje
-- é inofensivo). Revogado mesmo assim, por higiene: não depender de só
-- uma camada de proteção segurar a barra.
-- ============================================================

-- "status" é o único campo que o app ainda deixa o cidadão alterar via
-- RLS direta (marcar a própria demanda como resolvida) — e mesmo esse já
-- tem o valor restringido pelo gatilho restringir_status_demanda (só
-- aceita ir pra "resolvida", só a partir de aguardando_resposta/
-- respondida/nao_resolvida). Hoje o app em si sempre passa por
-- POST /api/cidadao/marcar-resolvida (service_role) — mantido aqui só
-- como camada extra pra quem chamar a API do Supabase direto.
REVOKE UPDATE ON public.demandas FROM anon, authenticated;
GRANT UPDATE (status) ON public.demandas TO authenticated;

-- Nenhum fluxo do app escreve em demanda_entidades fora do backend
-- (service_role) — authenticated/anon não precisam de UPDATE nenhum aqui.
REVOKE UPDATE ON public.demanda_entidades FROM anon, authenticated;

-- ============================================================
-- Depois de rodar, teste: marcar a própria demanda como resolvida em
-- /perfil e pelo popup do mapa (ambos já passam por
-- POST /api/cidadao/marcar-resolvida, que usa service_role e não é
-- afetado por este GRANT). Responder demanda (autoridade, painel e
-- e-mail), aprovar/rejeitar/reenviar link pelo master — todos usam
-- service_role e também não são afetados.
--
-- Para conferir depois:
--   select table_name, column_name, grantee, privilege_type
--   from information_schema.column_privileges
--   where table_schema = 'public' and grantee in ('anon','authenticated')
--     and table_name in ('demandas','demanda_entidades')
--     and privilege_type = 'UPDATE';
--   -- Deve retornar só: demandas | status | authenticated | UPDATE
-- ============================================================
