-- Fecha o acesso anonimo aos dados. Antes desta migracao, a role `anon` tinha
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE em todas as tabelas de dados -- e a
-- chave anon fica embutida no bundle JS publico, entao qualquer visitante do
-- site podia ler (e apagar) tudo pela API REST, com ou sem tela de login.
--
-- Depois desta migracao:
--   anon           -> nenhum acesso as tabelas de dados
--   authenticated  -> somente leitura (via policy de SELECT)
--   service_role   -> inalterado; ignora RLS, e o que a carga de dados usa
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname <> 'perfis'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('drop policy if exists %I on public.%I',
                   'leitura_autenticados_' || r.relname, r.relname);
    execute format('create policy %I on public.%I for select to authenticated using (true)',
                   'leitura_autenticados_' || r.relname, r.relname);
    execute format('drop policy if exists %I on public.%I', 'read_' || r.relname || '_public', r.relname);
    execute format('revoke all on public.%I from anon', r.relname);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', r.relname);
    execute format('grant select on public.%I to authenticated', r.relname);
  end loop;
end $$;

revoke all on public.perfis from anon;
