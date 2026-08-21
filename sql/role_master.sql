-- Adiciona coluna role na tabela perfis
ALTER TABLE perfis ADD COLUMN IF NOT EXISTS role text DEFAULT 'cidadao';

-- Define o master
UPDATE perfis SET role = 'master' WHERE id = '0e6bb204-40dd-4ac9-8c2e-a52b53bc2c3c';
