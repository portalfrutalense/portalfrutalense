-- ============================================================
-- Nova camada do mapa: Imóveis (aluguel/venda)
-- Mesmo padrão de pets/classificados/empregos (migration-camadas-mapa.sql).
-- NADA aqui altera as outras tabelas. Execute no SQL Editor do Supabase.
--
-- Decisão confirmada com o usuário: "marcar vendido/alugado" NÃO é uma
-- flag como `classificados.vendido`/`empregos.encerrada` — o app agora
-- EXCLUI o registro de verdade (linha + fotos do Storage) quando marcado,
-- sem deixar rastro. Por isso esta tabela não tem coluna de status
-- vendido/alugado nenhuma: o registro simplesmente deixa de existir.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Pins por FINALIDADE + TIPO de imóvel (cor/ícone editáveis no painel
--    master) — decisão confirmada com o usuário: mesmo mecanismo de
--    chaveConfigPet (CamadaPets.tsx), "Alugar Casa" e "Vender Casa" são
--    pins independentes, não um pin só por tipo. Fazenda/Chácara/Sítio
--    viram um tipo só (fazenda_chacara_sitio).
-- ------------------------------------------------------------
INSERT INTO camadas_config (chave, camada, rotulo, cor, ordem) VALUES
  ('imovel_aluguel_casa',                   'imoveis', 'Alugar Casa',                     '#f59e0b', 1),
  ('imovel_venda_casa',                     'imoveis', 'Vender Casa',                     '#f59e0b', 2),
  ('imovel_aluguel_apartamento',            'imoveis', 'Alugar Apartamento',              '#f59e0b', 3),
  ('imovel_venda_apartamento',              'imoveis', 'Vender Apartamento',              '#f59e0b', 4),
  ('imovel_aluguel_terreno',                'imoveis', 'Alugar Terreno',                  '#f59e0b', 5),
  ('imovel_venda_terreno',                  'imoveis', 'Vender Terreno',                  '#f59e0b', 6),
  ('imovel_aluguel_comodo_comercial',       'imoveis', 'Alugar Cômodo Comercial',         '#f59e0b', 7),
  ('imovel_venda_comodo_comercial',         'imoveis', 'Vender Cômodo Comercial',         '#f59e0b', 8),
  ('imovel_aluguel_barracao',               'imoveis', 'Alugar Barracão',                 '#f59e0b', 9),
  ('imovel_venda_barracao',                 'imoveis', 'Vender Barracão',                 '#f59e0b', 10),
  ('imovel_aluguel_fazenda_chacara_sitio',  'imoveis', 'Alugar Fazenda, Chácara ou Sítio', '#f59e0b', 11),
  ('imovel_venda_fazenda_chacara_sitio',    'imoveis', 'Vender Fazenda, Chácara ou Sítio', '#f59e0b', 12)
ON CONFLICT (chave) DO NOTHING;

-- ------------------------------------------------------------
-- 1. Moderação por IA — mesma tabela ia_config já usada por
--    demandas(1)/pets(2)/classificados(3). Imóveis usa o id 4.
--    A tabela nasceu (migration-demandas.sql) com CHECK (id = 1) — os ids
--    2/3 já em uso em produção só existem porque essa constraint foi
--    removida manualmente em algum momento não versionado (mesmo caso de
--    outras peças do schema, documentado em SISTEMA.md §9). Remove aqui de
--    novo, se ainda existir, pra esta migração funcionar num banco que
--    ainda tenha a constraint original.
-- ------------------------------------------------------------
ALTER TABLE ia_config DROP CONSTRAINT IF EXISTS ia_config_id_check;

INSERT INTO ia_config (id, ativo, rigor, prompt)
VALUES (4, TRUE, 'moderado', 'Analise o anúncio de imóvel e decida se deve ser aprovado ou rejeitado. Rejeite apenas se for claramente spam, ofensivo ou sem relação com locação/venda de imóvel.')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. IMÓVEIS — localização EXATA (sem aproximar, ao contrário de
--    classificados — decisão confirmada com o usuário).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,

  finalidade TEXT NOT NULL CHECK (finalidade IN ('aluguel', 'venda')),
  -- Fazenda/Chácara/Sítio viram um tipo só (decisão confirmada com o
  -- usuário): 'fazenda_chacara_sitio'.
  tipo TEXT NOT NULL CHECK (tipo IN (
    'casa', 'apartamento', 'terreno', 'comodo_comercial',
    'barracao', 'fazenda_chacara_sitio'
  )),

  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) CHECK (valor IS NULL OR valor >= 0),
  contato TEXT NOT NULL,

  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  endereco_label TEXT,
  fotos TEXT[] NOT NULL DEFAULT '{}',

  oculto BOOLEAN NOT NULL DEFAULT FALSE,
  ia_decisao TEXT,
  ia_motivo TEXT,
  ia_analisado_em TIMESTAMPTZ,
  -- BUG CORRIGIDO (padrão errado — decisão confirmada com o usuário): as
  -- outras camadas seguem "LETRA + ANO(4) + 6 DÍGITOS" (P2026662101 =
  -- pets, C2026217546 = classificados, E2026206028 = empregos,
  -- D2026897430 = demandas) — inventei um formato "IM-XXXXXXXX" próprio
  -- em vez de seguir esse padrão (nunca documentado em `sql/`, só existia
  -- no banco de produção, mesmo caso de outras peças do schema não
  -- versionadas). Imóveis usa a letra "I": I2026123456.
  protocolo TEXT UNIQUE NOT NULL DEFAULT (
    'I' || to_char(NOW(), 'YYYY') || lpad(floor(random() * 1000000)::text, 6, '0')
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS imoveis_updated_at ON imoveis;
CREATE TRIGGER imoveis_updated_at
  BEFORE UPDATE ON imoveis
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS imoveis_mapa_idx ON imoveis (finalidade) WHERE oculto = FALSE;
CREATE INDEX IF NOT EXISTS imoveis_user_idx ON imoveis (user_id);

ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imoveis_leitura_publica" ON imoveis;
CREATE POLICY "imoveis_leitura_publica" ON imoveis
  FOR SELECT USING (oculto = FALSE);

DROP POLICY IF EXISTS "imoveis_autor_ve_proprios" ON imoveis;
CREATE POLICY "imoveis_autor_ve_proprios" ON imoveis
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "imoveis_autor_cria" ON imoveis;
CREATE POLICY "imoveis_autor_cria" ON imoveis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "imoveis_autor_edita" ON imoveis;
CREATE POLICY "imoveis_autor_edita" ON imoveis
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "imoveis_autor_exclui" ON imoveis;
CREATE POLICY "imoveis_autor_exclui" ON imoveis
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "imoveis_master_gerencia" ON imoveis;
CREATE POLICY "imoveis_master_gerencia" ON imoveis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

GRANT SELECT ON imoveis TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON imoveis TO authenticated;

-- ------------------------------------------------------------
-- 3. Storage — criação do bucket ainda é passo MANUAL, fora deste SQL:
--    Supabase Dashboard → Storage → New bucket "imoveis-fotos",
--    marcado como Public (mesmo padrão de pets-fotos/classificados-fotos/
--    empregos-fotos).
--
--    "Public" só libera LEITURA sem autenticação — o Storage também tem
--    RLS na tabela storage.objects, separada disso, que controla quem pode
--    fazer upload/remover arquivo. Sem as policies abaixo, o upload falha
--    com "new row violates row-level security policy" mesmo com o bucket
--    marcado como público. Rode isto DEPOIS de criar o bucket pelo painel
--    (a policy referencia um bucket_id que precisa já existir).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "imoveis_fotos_upload" ON storage.objects;
CREATE POLICY "imoveis_fotos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imoveis-fotos');

DROP POLICY IF EXISTS "imoveis_fotos_leitura" ON storage.objects;
CREATE POLICY "imoveis_fotos_leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'imoveis-fotos');

-- Remoção: o formulário (FormImovel.tsx) apaga uma foto órfã direto do
-- cliente (limparFotoOrfa) quando o usuário remove uma imagem antes de
-- salvar, ou quando um upload falha no meio do lote — precisa de policy de
-- DELETE pro autor autenticado, mesmo padrão das outras 3 camadas.
-- Restrita a `owner = auth.uid()` (coluna que o Storage já preenche sozinho
-- no upload) — quem fez o upload pode remover, ninguém remove arquivo
-- alheio. A exclusão em nome do dono/master (linha da tabela) continua
-- passando pelo backend com service_role (`/api/camadas/excluir`,
-- `/api/master/camada`), que ignora esta policy.
DROP POLICY IF EXISTS "imoveis_fotos_exclusao" ON storage.objects;
CREATE POLICY "imoveis_fotos_exclusao" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'imoveis-fotos' AND owner = auth.uid());
