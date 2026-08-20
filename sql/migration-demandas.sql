-- 1. Perfis de usuários (complementa o auth do Supabase)
CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprio perfil" ON perfis FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuário cria próprio perfil" ON perfis FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuário atualiza próprio perfil" ON perfis FOR UPDATE USING (auth.uid() = id);

-- 2. Tabela de demandas (substitui denuncias + ocorrencias)
CREATE TABLE IF NOT EXISTS demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  morador_nome TEXT NOT NULL,
  morador_cpf TEXT,
  categoria_id UUID REFERENCES categorias_mapa(id),
  entidade_id UUID REFERENCES entidades(id),
  descricao TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  endereco_label TEXT,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  -- Status possíveis: pendente, aguardando_resposta, respondida, rejeitada_ia, resolvida
  ia_decisao TEXT,       -- 'aprovada' | 'rejeitada'
  ia_motivo TEXT,        -- motivo da rejeição pela IA
  ia_analisado_em TIMESTAMPTZ,
  resposta TEXT,
  respondido_em TIMESTAMPTZ,
  resposta_ip TEXT,
  magic_token TEXT UNIQUE,
  magic_token_expira_em TIMESTAMPTZ,
  link_enviado BOOLEAN DEFAULT FALSE,
  oculto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;
-- Qualquer um autenticado pode ver demandas públicas
CREATE POLICY "Autenticados veem demandas públicas" ON demandas
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    status IN ('aguardando_resposta', 'respondida', 'resolvida') AND
    oculto = FALSE
  );
-- Usuário vê suas próprias demandas
CREATE POLICY "Usuário vê suas demandas" ON demandas
  FOR SELECT USING (auth.uid() = user_id);
-- Usuário cria demanda
CREATE POLICY "Usuário cria demanda" ON demandas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Usuário exclui própria demanda
CREATE POLICY "Usuário exclui própria demanda" ON demandas
  FOR DELETE USING (auth.uid() = user_id);
-- Usuário marca como resolvida
CREATE POLICY "Usuário resolve própria demanda" ON demandas
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Configuração da IA (singleton)
CREATE TABLE IF NOT EXISTS ia_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativo BOOLEAN DEFAULT TRUE,
  prompt TEXT DEFAULT 'Analise a demanda do cidadão e decida se deve ser aprovada ou rejeitada. Rejeite se: for ofensiva, difamatória, sem relação com problemas reais do município de Frutal-MG, spam, ou conteúdo político partidário. Aprove se for uma demanda legítima de um cidadão sobre infraestrutura, saúde, educação, segurança ou outro serviço público.',
  rigor TEXT DEFAULT 'moderado', -- permissivo | moderado | rigoroso
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO ia_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4. Histórico de análises da IA
CREATE TABLE IF NOT EXISTS ia_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID REFERENCES demandas(id) ON DELETE CASCADE,
  decisao TEXT NOT NULL, -- 'aprovada' | 'rejeitada'
  motivo TEXT,
  modelo TEXT DEFAULT 'gemini-1.5-flash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
