-- ------------------------------------------------------------
-- Foto de autoridade (entidades.foto_url) + ranking (/ranking)
-- Criado em 2026-09-04.
--
-- A coluna entidades.foto_url já existe desde
-- fix_tabelas_faltantes_2026-09-01.sql — nunca teve UI de upload até agora.
-- Isso aqui só cria o bucket de Storage + as policies de INSERT/DELETE
-- necessárias (mesmo padrão de imoveis-fotos, ver migration-imoveis.sql).
--
-- PASSO MANUAL primeiro: Supabase Dashboard → Storage → New bucket
-- "entidades-fotos", marcado como Public. "Public" só libera LEITURA sem
-- autenticação — o Storage tem RLS própria em storage.objects que decide
-- quem pode fazer INSERT/DELETE, por isso as policies abaixo. Rode isto
-- DEPOIS de criar o bucket pelo painel.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "entidades_fotos_upload" ON storage.objects;
CREATE POLICY "entidades_fotos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'entidades-fotos');

DROP POLICY IF EXISTS "entidades_fotos_leitura" ON storage.objects;
CREATE POLICY "entidades_fotos_leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'entidades-fotos');

-- Só o master sobe/troca foto de autoridade (MasterPerfis, painel /master),
-- sempre autenticado como a própria conta master — não há um "dono" autor
-- como nas outras camadas (quem publica a foto nunca é a própria
-- autoridade). Restringe update/delete a quem tem role=master, em vez de
-- só `owner = auth.uid()`.
DROP POLICY IF EXISTS "entidades_fotos_update" ON storage.objects;
CREATE POLICY "entidades_fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'entidades-fotos' AND EXISTS (
    SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'
  ));

DROP POLICY IF EXISTS "entidades_fotos_exclusao" ON storage.objects;
CREATE POLICY "entidades_fotos_exclusao" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'entidades-fotos' AND EXISTS (
    SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'master'
  ));
