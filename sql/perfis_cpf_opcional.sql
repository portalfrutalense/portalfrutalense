-- CPF só é obrigatório para cidadãos. Autoridades e empresas não têm CPF.
ALTER TABLE perfis ALTER COLUMN cpf DROP NOT NULL;
