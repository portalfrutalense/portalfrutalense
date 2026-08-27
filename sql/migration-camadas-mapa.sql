-- ============================================================
-- Expansão do mapa em camadas: Pets, Classificados e Empregos
-- NADA aqui altera a tabela demandas nem suas policies.
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Configuração das camadas (cores e rótulos editáveis no painel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS camadas_config (
  chave TEXT PRIMARY KEY,          -- 'pet_perdido', 'classificado_carro', ...
  camada TEXT NOT NULL,            -- 'pets' | 'classificados' | 'empregos'
  rotulo TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#4256c8',
  icone_url TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE
);

ALTER TABLE camadas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "camadas_leitura_publica" ON camadas_config;
CREATE POLICY "camadas_leitura_publica" ON camadas_config
  FOR SELECT USING (ativo = TRUE);

DROP POLICY IF EXISTS "camadas_master_gerencia" ON camadas_config;
CREATE POLICY "camadas_master_gerencia" ON camadas_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

INSERT INTO camadas_config (chave, camada, rotulo, cor, ordem) VALUES
  ('pet_perdido',            'pets',           'Perdido',      '#dc2626', 1),
  ('pet_achado',             'pets',           'Achei na rua', '#16a34a', 2),
  ('pet_reencontrado',       'pets',           'Reencontrado', '#2563eb', 3),
  ('classificado_carro',       'classificados', 'Carro',       '#ffffff', 1),
  ('classificado_moto',        'classificados', 'Moto',        '#ffffff', 2),
  ('classificado_caminhonete', 'classificados', 'Caminhonete', '#ffffff', 3),
  ('classificado_caminhao',    'classificados', 'Caminhão',    '#ffffff', 4),
  ('emprego_vaga',           'empregos',       'Vaga',         '#0891b2', 1)
ON CONFLICT (chave) DO NOTHING;


-- ------------------------------------------------------------
-- 1. PETS — perdidos, achados na rua e reencontrados
--    'perdido' e 'achado' são registros INDEPENDENTES.
--    Só 'perdido' pode virar 'reencontrado'.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,

  -- tipo de registro: define o filtro e a cor do pin
  tipo TEXT NOT NULL CHECK (tipo IN ('perdido', 'achado')),
  reencontrado BOOLEAN NOT NULL DEFAULT FALSE,   -- só válido quando tipo = 'perdido'
  reencontrado_em TIMESTAMPTZ,

  especie TEXT NOT NULL CHECK (especie IN ('cachorro', 'gato')),
  nome_pet TEXT,                                  -- só faz sentido em 'perdido'
  raca TEXT,
  cor TEXT,
  porte TEXT CHECK (porte IN ('pequeno', 'medio', 'grande')),
  descricao TEXT NOT NULL,

  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  endereco_label TEXT,
  foto_url TEXT,
  contato TEXT NOT NULL,

  oculto BOOLEAN NOT NULL DEFAULT FALSE,          -- moderação do master
  expira_em TIMESTAMPTZ NOT NULL,                 -- mantido pelo trigger abaixo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- só perdido pode ser reencontrado
  CONSTRAINT pets_reencontrado_so_perdido
    CHECK (reencontrado = FALSE OR tipo = 'perdido')
);

-- Regra de expiração: 30 dias enquanto ativo; 7 dias após o reencontro.
CREATE OR REPLACE FUNCTION pets_calcular_expiracao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();

  IF NEW.reencontrado THEN
    IF NEW.reencontrado_em IS NULL THEN
      NEW.reencontrado_em := NOW();
    END IF;
    NEW.expira_em := NEW.reencontrado_em + INTERVAL '7 days';
  ELSE
    NEW.reencontrado_em := NULL;
    NEW.expira_em := COALESCE(NEW.created_at, NOW()) + INTERVAL '30 days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pets_expiracao ON pets;
CREATE TRIGGER pets_expiracao
  BEFORE INSERT OR UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION pets_calcular_expiracao();

CREATE INDEX IF NOT EXISTS pets_mapa_idx ON pets (tipo, reencontrado, expira_em)
  WHERE oculto = FALSE;
CREATE INDEX IF NOT EXISTS pets_user_idx ON pets (user_id);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer visitante vê os registros vigentes
DROP POLICY IF EXISTS "pets_leitura_publica" ON pets;
CREATE POLICY "pets_leitura_publica" ON pets
  FOR SELECT USING (oculto = FALSE AND expira_em > NOW());

-- O autor sempre vê os próprios registros, mesmo expirados
DROP POLICY IF EXISTS "pets_autor_ve_proprios" ON pets;
CREATE POLICY "pets_autor_ve_proprios" ON pets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pets_autor_cria" ON pets;
CREATE POLICY "pets_autor_cria" ON pets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pets_autor_edita" ON pets;
CREATE POLICY "pets_autor_edita" ON pets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pets_autor_exclui" ON pets;
CREATE POLICY "pets_autor_exclui" ON pets
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pets_master_gerencia" ON pets;
CREATE POLICY "pets_master_gerencia" ON pets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );


-- ------------------------------------------------------------
-- 2. CLASSIFICADOS — veículos, localização aproximada
--    lat/lng gravados já deslocados (estilo Airbnb): o endereço
--    exato do vendedor nunca chega ao cliente.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,

  tipo_veiculo TEXT NOT NULL
    CHECK (tipo_veiculo IN ('carro', 'moto', 'caminhonete', 'caminhao')),

  titulo TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  ano INT CHECK (ano IS NULL OR (ano >= 1900 AND ano <= 2100)),
  km INT CHECK (km IS NULL OR km >= 0),
  cor TEXT,
  preco NUMERIC(12,2) CHECK (preco IS NULL OR preco >= 0),
  aceita_troca BOOLEAN NOT NULL DEFAULT FALSE,
  descricao TEXT NOT NULL,

  lat FLOAT NOT NULL,                             -- já aproximada
  lng FLOAT NOT NULL,                             -- já aproximada
  bairro_label TEXT,                              -- "Centro", não o endereço exato
  fotos TEXT[] NOT NULL DEFAULT '{}',
  contato TEXT NOT NULL,

  vendido BOOLEAN NOT NULL DEFAULT FALSE,
  oculto BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classificados_updated_at ON classificados;
CREATE TRIGGER classificados_updated_at
  BEFORE UPDATE ON classificados
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS classificados_mapa_idx
  ON classificados (tipo_veiculo) WHERE oculto = FALSE AND vendido = FALSE;
CREATE INDEX IF NOT EXISTS classificados_user_idx ON classificados (user_id);

ALTER TABLE classificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classificados_leitura_publica" ON classificados;
CREATE POLICY "classificados_leitura_publica" ON classificados
  FOR SELECT USING (oculto = FALSE);

DROP POLICY IF EXISTS "classificados_autor_ve_proprios" ON classificados;
CREATE POLICY "classificados_autor_ve_proprios" ON classificados
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "classificados_autor_cria" ON classificados;
CREATE POLICY "classificados_autor_cria" ON classificados
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "classificados_autor_edita" ON classificados;
CREATE POLICY "classificados_autor_edita" ON classificados
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "classificados_autor_exclui" ON classificados;
CREATE POLICY "classificados_autor_exclui" ON classificados
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "classificados_master_gerencia" ON classificados;
CREATE POLICY "classificados_master_gerencia" ON classificados
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );


-- ------------------------------------------------------------
-- 3. EMPREGOS — somente perfis com role 'empresa' publicam
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empregos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  empresa_nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  area TEXT,
  contrato TEXT NOT NULL
    CHECK (contrato IN ('clt', 'pj', 'temporario', 'estagio', 'freelance')),
  salario NUMERIC(12,2) CHECK (salario IS NULL OR salario >= 0),
  salario_a_combinar BOOLEAN NOT NULL DEFAULT TRUE,
  vagas INT NOT NULL DEFAULT 1 CHECK (vagas >= 1),

  descricao TEXT NOT NULL,
  requisitos TEXT,

  lat FLOAT NOT NULL,                             -- endereço da empresa
  lng FLOAT NOT NULL,
  endereco_label TEXT,
  logo_url TEXT,
  contato TEXT NOT NULL,

  encerrada BOOLEAN NOT NULL DEFAULT FALSE,
  oculto BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS empregos_updated_at ON empregos;
CREATE TRIGGER empregos_updated_at
  BEFORE UPDATE ON empregos
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS empregos_mapa_idx
  ON empregos (encerrada) WHERE oculto = FALSE;
CREATE INDEX IF NOT EXISTS empregos_user_idx ON empregos (user_id);

ALTER TABLE empregos ENABLE ROW LEVEL SECURITY;

-- Cidadãos apenas visualizam
DROP POLICY IF EXISTS "empregos_leitura_publica" ON empregos;
CREATE POLICY "empregos_leitura_publica" ON empregos
  FOR SELECT USING (oculto = FALSE AND encerrada = FALSE);

DROP POLICY IF EXISTS "empregos_empresa_ve_proprias" ON empregos;
CREATE POLICY "empregos_empresa_ve_proprias" ON empregos
  FOR SELECT USING (auth.uid() = user_id);

-- Só quem tem role 'empresa' cria vaga
DROP POLICY IF EXISTS "empregos_empresa_cria" ON empregos;
CREATE POLICY "empregos_empresa_cria" ON empregos
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'empresa')
  );

DROP POLICY IF EXISTS "empregos_empresa_edita" ON empregos;
CREATE POLICY "empregos_empresa_edita" ON empregos
  FOR UPDATE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'empresa')
  ) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "empregos_empresa_exclui" ON empregos;
CREATE POLICY "empregos_empresa_exclui" ON empregos
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "empregos_master_gerencia" ON empregos;
CREATE POLICY "empregos_master_gerencia" ON empregos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );


-- ------------------------------------------------------------
-- 4. Permissões de tabela
--    O RLS acima é quem decide as linhas; estes GRANTs são o
--    pré-requisito para o RLS sequer ser avaliado.
--    anon: só leitura (visitante não logado vê os pins).
--    authenticated: escrita, restrita pelas policies de autor/role.
-- ------------------------------------------------------------
GRANT SELECT ON pets           TO anon;
GRANT SELECT ON classificados  TO anon;
GRANT SELECT ON empregos       TO anon;
GRANT SELECT ON camadas_config TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON pets          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON classificados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON empregos      TO authenticated;
GRANT SELECT, UPDATE                  ON camadas_config TO authenticated;
