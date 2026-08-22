-- Adiciona as colunas de configuração do chatbot que faltavam na tabela
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS nome_bot TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS descricao_bot TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS tom_voz TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS responsabilidades TEXT;
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS prompt_extra TEXT;
