-- Area do colaborador em `perfis` + funcao de listagem da equipe.
--
-- POR QUE. O modulo Plano de Acao atribui cada acao a uma pessoa e agrupa o
-- plano por area. Hoje `perfis` tem cargo, mas nao area, e a policy
-- `perfis_select` (id = auth.uid() or eh_admin()) impede que um gestor comum
-- enxergue qualquer colega -- ou seja, ele nao conseguiria escolher responsavel.
--
-- A policy NAO deve ser relaxada: ela protege e-mail de contato e papel. Em vez
-- disso, uma funcao SECURITY DEFINER devolve apenas o minimo necessario para
-- atribuir tarefa (id, nome, cargo, area), sem e-mail e sem login. Mesmo padrao
-- ja usado por `eh_admin()` na migracao 20260731111402.

alter table public.perfis
  add column if not exists area text;

comment on column public.perfis.area is
  'Area de atuacao (Marketing, Comercial, Academico, TI...). Usada para agrupar '
  'o Plano de Acao e sugerir responsavel. Texto livre de proposito: a estrutura '
  'da FMP muda mais rapido que uma tabela de dominio.';

create index if not exists perfis_area_idx on public.perfis (area);

-- Listagem enxuta da equipe, visivel a qualquer gestor autenticado.
--
-- SECURITY DEFINER de proposito: ignora a RLS de `perfis` para devolver um
-- recorte deliberadamente pobre. NUNCA acrescentar email_contato, codusuario ou
-- papel aqui -- se precisar disso, e a tela /usuarios (admin) que resolve.
create or replace function public.equipe()
returns table (
  id uuid,
  nome_completo text,
  cargo text,
  area text
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select p.id, p.nome_completo, p.cargo, p.area
  from public.perfis p
  where p.ativo
  order by p.area nulls last, p.nome_completo;
$$;

comment on function public.equipe() is
  'Equipe ativa (id, nome, cargo, area) para atribuicao de responsavel no Plano '
  'de Acao. Recorte minimo de proposito -- nao expor e-mail, login nem papel.';

revoke all on function public.equipe() from public, anon;
grant execute on function public.equipe() to authenticated;
