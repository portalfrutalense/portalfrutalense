-- ============================================================
-- Lista TODA policy de RLS em qualquer tabela pública que permita leitura
-- (SELECT) totalmente aberta (qual = 'true' ou similar) pra role pública —
-- é exatamente o padrão que causou o achado de chatbot_base. Roda isso pra
-- checar se sobrou mais alguma em tabela sensível.
--
-- Tabelas onde leitura pública É esperada e correta (não é bug se
-- aparecer): entidades, categorias_mapa, categoria_entidades,
-- camadas_mapa, camadas_config, pets, classificados, empregos, demandas,
-- demanda_entidades — todas essas são conteúdo do mapa, feito pra
-- aparecer publicamente (com as colunas sensíveis já restritas por GRANT
-- separado, não por RLS).
--
-- Tabelas onde leitura pública NÃO deveria aparecer aqui — se aparecer, é
-- bug de verdade: perfis, ia_config, chatbot_config, chatbot_base,
-- chatbot_sem_resposta, whatsapp_conversas, chat_conversas.
-- ============================================================

select tablename, policyname, roles, qual
from pg_policies
where schemaname = 'public'
  and cmd = 'SELECT'
  and qual = 'true'
order by tablename, policyname;
