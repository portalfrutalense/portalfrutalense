-- ============================================================
-- Corrige o formato do protocolo de imoveis, que nasceu errado
-- ("IM-XXXXXXXX") em vez de seguir o padrão das outras camadas
-- (LETRA + ANO(4) + 6 DÍGITOS — ex: P2026662101, C2026217546,
-- E2026206028, D2026897430). Imóveis usa a letra "I": I2026123456.
-- Execute no SQL Editor do Supabase — idempotente, seguro rodar mais de uma vez.
-- ============================================================

ALTER TABLE imoveis ALTER COLUMN protocolo SET DEFAULT (
  'I' || to_char(NOW(), 'YYYY') || lpad(floor(random() * 1000000)::text, 6, '0')
);

-- Opcional: corrige o(s) anúncio(s) já criados no formato antigo, se houver.
-- Comente este bloco se preferir manter o protocolo já gerado.
UPDATE imoveis
SET protocolo = 'I' || to_char(created_at, 'YYYY') || lpad(floor(random() * 1000000)::text, 6, '0')
WHERE protocolo LIKE 'IM-%';
