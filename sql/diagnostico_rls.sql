-- Lista todas as tabelas do schema public e se RLS está ativado (rowsecurity = false significa "Unrestricted")
SELECT
  tablename AS tabela,
  rowsecurity AS rls_ativado
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;
