-- ia_config foi criada sem RLS (ficava "Unrestricted" no Supabase, qualquer um podia ler/escrever).
-- Restringe leitura e escrita a usuários com role='master'.

ALTER TABLE ia_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_le_ia_config" ON ia_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

CREATE POLICY "master_atualiza_ia_config" ON ia_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );

CREATE POLICY "master_insere_ia_config" ON ia_config
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master')
  );
