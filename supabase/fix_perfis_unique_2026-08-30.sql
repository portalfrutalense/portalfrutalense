-- ============================================================
-- Corrige: CPF e e-mail de "perfis" não tinham nenhuma constraint UNIQUE
-- no banco. A checagem de duplicidade em ModalCPF.tsx é feita só do lado
-- do cliente (um SELECT antes do INSERT) — sujeita a corrida: dois
-- cadastros quase simultâneos com o mesmo CPF podem passar pela checagem
-- antes de qualquer um gravar, e nada no banco impede os dois de existirem.
-- "whatsapp" já tinha UNIQUE (supabase/whatsapp_setup.sql) — isso completa
-- a mesma proteção pra cpf e email.
--
-- UNIQUE no Postgres permite múltiplos NULL (autoridade/empresa não têm
-- CPF), então isso não afeta quem já não preenche esses campos.
--
-- Versão idempotente: pode rodar de novo sem erro se alguma das duas
-- constraints já existir (ex: tentativa anterior que só criou uma delas).
-- ============================================================

-- Se alguma dessas falhar dizendo que já existem valores duplicados, rode
-- a query abaixo pra achar as linhas conflitantes ANTES de tentar de novo:
--   select cpf, count(*) from perfis where cpf is not null group by cpf having count(*) > 1;
--   select email, count(*) from perfis where email is not null group by email having count(*) > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfis_cpf_unique' AND conrelid = 'public.perfis'::regclass
  ) THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_cpf_unique UNIQUE (cpf);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfis_email_unique' AND conrelid = 'public.perfis'::regclass
  ) THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_email_unique UNIQUE (email);
  END IF;
END $$;

-- ------------------------------------------------------------
-- Limpeza: "whatsapp" tinha DUAS constraints UNIQUE fazendo a mesma
-- coisa (perfis_whatsapp_key e perfis_whatsapp_unique) — achado ao
-- conferir o estado real do banco antes de rodar o resto deste arquivo.
-- Mantém a mais antiga (perfis_whatsapp_key, criada junto com a coluna),
-- remove a duplicata.
-- ------------------------------------------------------------
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_whatsapp_unique;

-- Confere o resultado final:
select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.perfis'::regclass and contype = 'u';
