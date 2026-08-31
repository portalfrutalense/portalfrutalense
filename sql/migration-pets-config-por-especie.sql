-- Separa a configuração de cor/ícone dos pins de pets por espécie também,
-- não só por situação. Antes: 4 chaves (pet_perdido, pet_achado, pet_adocao,
-- pet_reencontrado), uma cor/ícone servindo pra cachorro e gato ao mesmo
-- tempo. Agora: 8 chaves (situação + espécie), cada combinação com sua
-- própria cor e ícone independentes.
--
-- Reaproveita a cor que já existia em cada situação como ponto de partida
-- pras duas espécies (master pode diferenciar depois pelo painel).

INSERT INTO camadas_config (chave, camada, rotulo, cor, icone_url, ordem, ativo)
SELECT
  chave || '_' || especie,
  'pets',
  rotulo || ' — ' || CASE especie WHEN 'cachorro' THEN 'Cachorro' ELSE 'Gato' END,
  cor,
  icone_url,
  ordem * 10 + CASE especie WHEN 'cachorro' THEN 1 ELSE 2 END,
  ativo
FROM camadas_config
CROSS JOIN (VALUES ('cachorro'), ('gato')) AS e(especie)
WHERE camada = 'pets'
  AND chave IN ('pet_perdido', 'pet_achado', 'pet_adocao', 'pet_reencontrado')
ON CONFLICT (chave) DO NOTHING;

-- Remove as 4 chaves antigas (sem espécie) — o código não lê mais elas,
-- ficariam só como entrada morta e confusa no painel master.
DELETE FROM camadas_config
WHERE camada = 'pets'
  AND chave IN ('pet_perdido', 'pet_achado', 'pet_adocao', 'pet_reencontrado');

-- Conferência: deve mostrar 8 linhas (4 situações x 2 espécies).
-- select chave, rotulo, cor, ordem from camadas_config where camada = 'pets' order by ordem;
