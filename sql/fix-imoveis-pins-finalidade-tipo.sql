-- ============================================================
-- Corrige a camada Imóveis (decisões confirmadas com o usuário):
--
-- 1. Fazenda, Chácara e Sítio viram um tipo só: 'fazenda_chacara_sitio'.
-- 2. Pin passa a ser configurado por FINALIDADE + TIPO (igual pets faz
--    com situação + espécie) — "Alugar Casa" e "Vender Casa" ganham
--    cor/ícone independentes, em vez de um pin só por tipo.
--
-- Idempotente — seguro rodar mais de uma vez. Execute no SQL Editor do
-- Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Migra anúncios já existentes com o tipo antigo (fazenda/chacara/
--    sitio) pro tipo novo combinado, ANTES de trocar o CHECK constraint —
--    senão a troca do constraint falha se sobrar alguma linha com valor
--    fora da nova lista.
-- ------------------------------------------------------------
UPDATE imoveis SET tipo = 'fazenda_chacara_sitio' WHERE tipo IN ('fazenda', 'chacara', 'sitio');

-- ------------------------------------------------------------
-- 1. Troca o CHECK constraint da coluna `tipo` pra nova lista de 6 valores.
-- ------------------------------------------------------------
ALTER TABLE imoveis DROP CONSTRAINT IF EXISTS imoveis_tipo_check;
ALTER TABLE imoveis ADD CONSTRAINT imoveis_tipo_check CHECK (tipo IN (
  'casa', 'apartamento', 'terreno', 'comodo_comercial', 'barracao', 'fazenda_chacara_sitio'
));

-- ------------------------------------------------------------
-- 2. Remove os 8 pins antigos (chave só por tipo) e insere os 12 novos
--    (chave = finalidade + tipo). Qualquer cor/ícone customizado que o
--    master já tenha configurado nos pins antigos é perdido — são poucas
--    linhas recém-criadas, sem uso real ainda.
-- ------------------------------------------------------------
DELETE FROM camadas_config WHERE camada = 'imoveis';

INSERT INTO camadas_config (chave, camada, rotulo, cor, ordem) VALUES
  ('imovel_aluguel_casa',                   'imoveis', 'Alugar Casa',                             '#f59e0b', 1),
  ('imovel_venda_casa',                     'imoveis', 'Vender Casa',                             '#f59e0b', 2),
  ('imovel_aluguel_apartamento',            'imoveis', 'Alugar Apartamento',                      '#f59e0b', 3),
  ('imovel_venda_apartamento',              'imoveis', 'Vender Apartamento',                      '#f59e0b', 4),
  ('imovel_aluguel_terreno',                'imoveis', 'Alugar Terreno',                          '#f59e0b', 5),
  ('imovel_venda_terreno',                  'imoveis', 'Vender Terreno',                          '#f59e0b', 6),
  ('imovel_aluguel_comodo_comercial',       'imoveis', 'Alugar Cômodo Comercial',                 '#f59e0b', 7),
  ('imovel_venda_comodo_comercial',         'imoveis', 'Vender Cômodo Comercial',                 '#f59e0b', 8),
  ('imovel_aluguel_barracao',               'imoveis', 'Alugar Barracão',                         '#f59e0b', 9),
  ('imovel_venda_barracao',                 'imoveis', 'Vender Barracão',                         '#f59e0b', 10),
  ('imovel_aluguel_fazenda_chacara_sitio',  'imoveis', 'Alugar Fazenda, Chácara ou Sítio',         '#f59e0b', 11),
  ('imovel_venda_fazenda_chacara_sitio',    'imoveis', 'Vender Fazenda, Chácara ou Sítio',         '#f59e0b', 12)
ON CONFLICT (chave) DO NOTHING;
