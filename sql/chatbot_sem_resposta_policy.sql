-- A policy de SELECT original bloqueava leitura para todo mundo (USING false),
-- então o painel Master nunca conseguia exibir as perguntas sem resposta.
-- Substitui por: só usuários com role='master' podem ler.

DROP POLICY IF EXISTS "apenas_master_le" ON chatbot_sem_resposta;
DROP POLICY IF EXISTS "sem_resposta_nao_le" ON chatbot_sem_resposta;

DROP POLICY IF EXISTS "master_le_sem_resposta" ON chatbot_sem_resposta;
CREATE POLICY "master_le_sem_resposta" ON chatbot_sem_resposta
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

DROP POLICY IF EXISTS "master_exclui_sem_resposta" ON chatbot_sem_resposta;
CREATE POLICY "master_exclui_sem_resposta" ON chatbot_sem_resposta
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );
