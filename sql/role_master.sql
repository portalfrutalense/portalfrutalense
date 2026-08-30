-- Adiciona coluna role na tabela perfis
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS role text DEFAULT 'cidadao';

-- Define o master — substitua SEU_UUID_AQUI pelo id (auth.users.id) da conta
-- que deve virar master neste ambiente. Já foi rodado uma vez em produção
-- com o UUID da conta master original; mantido como placeholder aqui pra não
-- deixar esse identificador específico no arquivo versionado.
UPDATE perfis SET role = 'master' WHERE id = 'SEU_UUID_AQUI';
