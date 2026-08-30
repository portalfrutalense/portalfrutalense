-- Configuração do chatbot de conversação
CREATE TABLE IF NOT EXISTS chatbot_config (
  id INT PRIMARY KEY DEFAULT 1,
  nome_bot TEXT,
  descricao_bot TEXT,
  tom_voz TEXT,
  responsabilidades TEXT,
  prompt_extra TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir linha padrão se não existir
INSERT INTO chatbot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;

-- Log de perguntas que o chatbot não soube responder
-- ATENÇÃO: cópia duplicada da criação desta tabela — a versão canônica é
-- sql/chatbot_sem_resposta.sql, com policy de INSERT restrita ao próprio
-- user_id (a policy "insere_sem_resposta" abaixo, WITH CHECK (true), é mais
-- permissiva e não deve ser aplicada junto com a de lá). Se ambas já tiverem
-- sido rodadas, rode supabase/fix_bloco11_2026-08-30.sql pra remover a
-- policy mais permissiva.
CREATE TABLE IF NOT EXISTS chatbot_sem_resposta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pergunta TEXT NOT NULL,
  resposta_bot TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chatbot_sem_resposta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insere_sem_resposta" ON chatbot_sem_resposta
  FOR INSERT WITH CHECK (true);

CREATE POLICY "sem_resposta_nao_le" ON chatbot_sem_resposta
  FOR SELECT USING (false);
