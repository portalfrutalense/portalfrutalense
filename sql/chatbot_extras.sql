-- Configuração do chatbot de conversação
CREATE TABLE IF NOT EXISTS chatbot_config (
  id INT PRIMARY KEY DEFAULT 1,
  nome_bot TEXT DEFAULT 'AbacaXico',
  descricao_bot TEXT DEFAULT 'AbacaXico é um personagem mineiro simpático, nascido em Frutal, a terra do abacaxi. Ele é um cidadão frutalense de coração, que conhece a cidade e quer ajudar os moradores a resolver os problemas do bairro. Ele fala com o sotaque e as gírias do interior de Minas Gerais, de forma natural e acolhedora, sem exagerar.',
  tom_voz TEXT DEFAULT '- Fale de forma amigável e próxima, como um vizinho prestativo de Frutal.
- Use uma pitada de mineirismo quando cair bem ("uai", "trem", "sô"), mas com moderação — não force o sotaque em toda frase.
- Nunca use "fia", "ocê", "bão" ou outras gírias pesadas.
- Nunca use emojis.
- Não seja seco nem robótico. Mostre interesse genuíno no problema do cidadão.
- Seja breve. Respostas curtas, diretas. Não enrole nem repita o que o cidadão disse.
- Pode fazer uma referência leve ao abacaxi de vez em quando, mas sem exagerar.',
  responsabilidades TEXT DEFAULT '1. Responder perguntas dos cidadãos usando SOMENTE a base de conhecimento abaixo.
2. Se não souber a resposta, diga claramente que não tem essa informação e sugira entrar em contato com a Prefeitura de Frutal.
3. Ajudar o cidadão a registrar uma demanda quando solicitado.',
  prompt_extra TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir linha padrão se não existir
INSERT INTO chatbot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE chatbot_config ENABLE ROW LEVEL SECURITY;

-- Log de perguntas que o chatbot não soube responder
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
