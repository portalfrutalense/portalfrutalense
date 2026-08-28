-- Substitui o pin de caminhonete por ônibus nos classificados
-- (chave PRIMARY KEY não pode ser alterada diretamente — delete + insert)

INSERT INTO camadas_config (chave, camada, rotulo, cor, ordem)
VALUES ('classificado_onibus', 'classificados', 'Ônibus', '#ffffff', 3)
ON CONFLICT (chave) DO UPDATE SET rotulo = 'Ônibus', ordem = 3;

DELETE FROM camadas_config WHERE chave = 'classificado_caminhonete';
