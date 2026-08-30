-- Esta é a versão canônica da criação de chatbot_sem_resposta — existe
-- também uma cópia em sql/chatbot_extras.sql, com policy de INSERT mais
-- permissiva (WITH CHECK (true), sem restringir user_id). Rode só um dos
-- dois. Se os dois já tiverem sido rodados, as duas policies de INSERT
-- coexistem (RLS combina com OR) — rode supabase/fix_bloco11_2026-08-30.sql
-- pra remover a mais permissiva e manter só a restrita ao próprio user_id.
CREATE TABLE IF NOT EXISTS chatbot_sem_resposta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pergunta TEXT NOT NULL,
  resposta_bot TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Apenas master pode ler
ALTER TABLE chatbot_sem_resposta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apenas_master_le" ON chatbot_sem_resposta
  FOR SELECT USING (false); -- acesso somente via service_role (API)

-- Qualquer usuário autenticado pode inserir (via API)
CREATE POLICY "usuario_insere" ON chatbot_sem_resposta
  FOR INSERT WITH CHECK (auth.uid() = user_id);
