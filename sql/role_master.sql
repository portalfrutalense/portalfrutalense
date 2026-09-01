-- Adiciona coluna role na tabela perfis
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS role text DEFAULT 'cidadao';

-- BUG CORRIGIDO (R2-37): num banco reconstruído do zero, este passo não
-- promove ninguém sozinho — o sistema nasce sem NENHUMA conta master, e
-- como só o master cria autoridade/empresa (/api/master/criar-perfil), não
-- existe caminho automático de bootstrap. Isso é esperado (deixar um UUID
-- de produção real hardcoded no repositório seria um problema de segurança
-- maior) — mas o passo manual precisa ficar claro:
--
-- 1. Crie a conta normalmente pelo site (cadastro de cidadão comum).
-- 2. Descubra o UUID dela rodando esta query:
--      select id, email from auth.users where email = 'seu-email-aqui@exemplo.com';
-- 3. Troque SEU_UUID_AQUI abaixo pelo UUID encontrado e rode o UPDATE.
--
-- Define o master — substitua SEU_UUID_AQUI pelo id (auth.users.id) da conta
-- que deve virar master neste ambiente. Já foi rodado uma vez em produção
-- com o UUID da conta master original; mantido como placeholder aqui pra não
-- deixar esse identificador específico no arquivo versionado.
UPDATE perfis SET role = 'master' WHERE id = 'SEU_UUID_AQUI';
