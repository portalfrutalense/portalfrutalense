-- Adiciona 'adocao' ao CHECK constraint da tabela pets
-- Execute no SQL Editor do Supabase.

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_tipo_check;
ALTER TABLE pets ADD CONSTRAINT pets_tipo_check CHECK (tipo IN ('perdido', 'achado', 'adocao'));

-- Remove a restrição que impedia adoção de ser "reencontrada"
-- (para adocao não faz sentido reencontrado, mas o CHECK abaixo já cobre isso)
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_reencontrado_so_perdido;
ALTER TABLE pets ADD CONSTRAINT pets_reencontrado_so_perdido
  CHECK (reencontrado = FALSE OR tipo = 'perdido');
