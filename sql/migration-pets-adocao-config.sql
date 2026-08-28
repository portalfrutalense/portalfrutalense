-- Corrige rótulos existentes dos pins de pets
UPDATE camadas_config SET rotulo = 'Perdidos'    WHERE chave = 'pet_perdido';
UPDATE camadas_config SET rotulo = 'Abandonados' WHERE chave = 'pet_achado';
UPDATE camadas_config SET rotulo = 'Reencontrado' WHERE chave = 'pet_reencontrado';

-- Insere pin de adoção (se ainda não existir)
INSERT INTO camadas_config (chave, camada, rotulo, cor, ordem)
VALUES ('pet_adocao', 'pets', 'Adoção', '#7c3aed', 4)
ON CONFLICT (chave) DO NOTHING;
