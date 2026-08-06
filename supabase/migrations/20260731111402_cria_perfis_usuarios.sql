-- Perfil da aplicacao, 1:1 com auth.users. A autenticacao (hash de senha,
-- sessao, refresh token) fica a cargo do Supabase Auth; aqui ficam apenas os
-- dados de negocio do usuario.
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Identidade de login, no padrao nome.sobrenome. Imutavel: e a partir dela
  -- que se deriva o e-mail interno usado pelo Supabase Auth, entao alterar
  -- depois deixaria perfil e credencial fora de sincronia.
  codusuario text not null unique
    check (codusuario ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+)*$'),
  nome_completo text not null check (length(btrim(nome_completo)) > 0),
  cargo text,
  email_contato text check (email_contato is null or email_contato ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  papel text not null default 'gestor' check (papel in ('admin', 'gestor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis is 'Perfis dos usuarios da plataforma de dashboards (1:1 com auth.users).';
comment on column public.perfis.codusuario is 'Login no padrao nome.sobrenome. Imutavel apos a criacao.';
comment on column public.perfis.papel is 'admin gerencia usuarios; gestor acessa apenas os dashboards e o proprio perfil.';

create index if not exists perfis_codusuario_idx on public.perfis (codusuario);

-- SECURITY DEFINER de proposito: as policies de `perfis` chamam esta funcao, e
-- uma consulta comum a `perfis` dentro da propria policy causaria recursao
-- infinita. Como definer, a funcao ignora RLS e quebra o ciclo.
create or replace function public.eh_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.papel = 'admin' and p.ativo
  );
$$;

-- Bloqueia alteracao de campos que o proprio usuario nao pode mudar. RLS
-- sozinha nao resolve: `with check` enxerga apenas a linha nova, e aqui e
-- preciso comparar valor antigo com novo.
create or replace function public.perfis_protege_campos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.atualizado_em := now();
  new.criado_em := old.criado_em;

  if new.id is distinct from old.id then
    raise exception 'id do perfil nao pode ser alterado';
  end if;
  if new.codusuario is distinct from old.codusuario then
    raise exception 'codusuario nao pode ser alterado';
  end if;

  if not public.eh_admin() then
    if new.papel is distinct from old.papel then
      raise exception 'apenas administradores podem alterar o papel';
    end if;
    if new.ativo is distinct from old.ativo then
      raise exception 'apenas administradores podem ativar ou desativar um usuario';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists perfis_protege_campos_trg on public.perfis;
create trigger perfis_protege_campos_trg
  before update on public.perfis
  for each row execute function public.perfis_protege_campos();

alter table public.perfis enable row level security;

drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.eh_admin());

drop policy if exists perfis_update on public.perfis;
create policy perfis_update on public.perfis
  for update to authenticated
  using (id = auth.uid() or public.eh_admin())
  with check (id = auth.uid() or public.eh_admin());

drop policy if exists perfis_insert on public.perfis;
create policy perfis_insert on public.perfis
  for insert to authenticated with check (public.eh_admin());

drop policy if exists perfis_delete on public.perfis;
create policy perfis_delete on public.perfis
  for delete to authenticated using (public.eh_admin());
