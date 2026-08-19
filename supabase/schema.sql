-- ============================================================
-- Portal Frutalense - Schema do Banco de Dados (Supabase)
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Tabela: entidades (vereadores, secretarias, etc.)
CREATE TABLE IF NOT EXISTS entidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  email TEXT NOT NULL,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: categorias_mapa (tipos de ocorrência urbana)
CREATE TABLE IF NOT EXISTS categorias_mapa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#ef4444', -- hex color
  icone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: denuncias (fórum de cobranças públicas)
CREATE TABLE IF NOT EXISTS denuncias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  morador_nome TEXT NOT NULL,
  morador_cpf TEXT NOT NULL,           -- apenas dígitos: "12345678900"
  morador_cpf_display TEXT NOT NULL,   -- formatado: "123.456.789-00"
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aguardando_resposta', 'respondida', 'rejeitada')),
  entidade_id UUID REFERENCES entidades(id) ON DELETE SET NULL,
  resposta TEXT,
  respondido_em TIMESTAMPTZ,
  magic_token TEXT UNIQUE,
  magic_token_expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: ocorrencias (mapa de problemas urbanos)
CREATE TABLE IF NOT EXISTS ocorrencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  morador_nome TEXT NOT NULL,
  morador_cpf TEXT NOT NULL,
  descricao TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'publicada', 'rejeitada', 'resolvida')),
  categoria_id UUID REFERENCES categorias_mapa(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER denuncias_updated_at
  BEFORE UPDATE ON denuncias
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER ocorrencias_updated_at
  BEFORE UPDATE ON ocorrencias
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

-- ============================================================
-- RLS (Row Level Security) - Segurança por linha
-- ============================================================

ALTER TABLE entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_mapa ENABLE ROW LEVEL SECURITY;
ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;

-- Entidades: leitura pública
CREATE POLICY "entidades_leitura_publica" ON entidades
  FOR SELECT USING (ativo = true);

-- Categorias: leitura pública
CREATE POLICY "categorias_leitura_publica" ON categorias_mapa
  FOR SELECT USING (ativo = true);

-- Denúncias: leitura pública apenas para aprovadas/respondidas
CREATE POLICY "denuncias_leitura_publica" ON denuncias
  FOR SELECT USING (status IN ('aguardando_resposta', 'respondida'));

-- Denúncias: inserção pública (qualquer pessoa pode enviar)
CREATE POLICY "denuncias_insercao_publica" ON denuncias
  FOR INSERT WITH CHECK (true);

-- Ocorrências: leitura pública apenas das publicadas
CREATE POLICY "ocorrencias_leitura_publica" ON ocorrencias
  FOR SELECT USING (status = 'publicada');

-- Ocorrências: inserção pública
CREATE POLICY "ocorrencias_insercao_publica" ON ocorrencias
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Dados iniciais de exemplo
-- ============================================================

INSERT INTO categorias_mapa (nome, cor) VALUES
  ('Buraco na Via', '#ef4444'),
  ('Iluminação Pública', '#f59e0b'),
  ('Lixo / Entulho', '#84cc16'),
  ('Esgoto / Vazamento', '#3b82f6'),
  ('Mato Alto', '#22c55e'),
  ('Calçada Danificada', '#8b5cf6')
ON CONFLICT DO NOTHING;
