-- Sobrou da migracao anterior: o nome da policy antiga desta tabela nao seguia
-- o padrao read_<tabela>_public (era "read_rubeus_public", tabela
-- "rubeus_registros_personalizada"), entao o drop generico nao a alcancou.
drop policy if exists read_rubeus_public on public.rubeus_registros_personalizada;
