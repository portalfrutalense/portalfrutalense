-- Permite que usuários com role='master' leiam e escrevam na config do chatbot
DROP POLICY IF EXISTS "master_le_chatbot_config" ON chatbot_config;
CREATE POLICY "master_le_chatbot_config" ON chatbot_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_escreve_chatbot_config" ON chatbot_config;
CREATE POLICY "master_escreve_chatbot_config" ON chatbot_config
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_atualiza_chatbot_config" ON chatbot_config;
CREATE POLICY "master_atualiza_chatbot_config" ON chatbot_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );
