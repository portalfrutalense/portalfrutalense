-- Adiciona constraint para os roles válidos da tabela perfis
-- Roles existentes: master, cidadao
-- Roles novos: autoridade, empresa

ALTER TABLE perfis
  DROP CONSTRAINT IF EXISTS perfis_role_check;

ALTER TABLE perfis
  ADD CONSTRAINT perfis_role_check
  CHECK (role IN ('master', 'cidadao', 'autoridade', 'empresa'));
