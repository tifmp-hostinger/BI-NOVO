-- Funcoes de gestao de usuarios. Todas SECURITY DEFINER porque escrevem em
-- auth.users; o acesso e fechado (revoke) e liberado apenas para service_role,
-- ou seja, so as Edge Functions as alcancam. Nunca expostas ao navegador.

-- E-mail interno derivado do codusuario. O Supabase Auth exige e-mail como
-- identificador; a plataforma faz login por codusuario. Dominio .local de
-- proposito: nao e roteavel, evitando que um fluxo de e-mail escape para um
-- endereco real.
create or replace function public.email_interno(p_codusuario text)
returns text language sql immutable as $$
  select lower(btrim(p_codusuario)) || '@bi.fmp.local';
$$;

create or replace function public.admin_criar_usuario(
  p_codusuario text, p_nome_completo text, p_cargo text,
  p_papel text, p_senha text, p_email_contato text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid := extensions.uuid_generate_v4();
  v_cod text := lower(btrim(p_codusuario));
  v_email text := public.email_interno(v_cod);
begin
  if length(coalesce(p_senha, '')) < 10 then
    raise exception 'senha deve ter ao menos 10 caracteres';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_super_admin, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
    jsonb_build_object('codusuario', v_cod, 'nome_completo', p_nome_completo),
    now(), now(), '', '', '', '', false, false, false
  );

  -- Sem a identidade correspondente o GoTrue nao reconhece o provedor de senha.
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    extensions.uuid_generate_v4(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  insert into public.perfis (id, codusuario, nome_completo, cargo, papel, email_contato)
  values (v_id, v_cod, p_nome_completo, p_cargo, coalesce(p_papel,'gestor'), p_email_contato);

  return v_id;
end;
$$;

create or replace function public.admin_definir_senha(p_id uuid, p_senha text)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if length(coalesce(p_senha, '')) < 10 then
    raise exception 'senha deve ter ao menos 10 caracteres';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_id;
  if not found then raise exception 'usuario nao encontrado'; end if;
end;
$$;

-- Confere a senha atual antes de permitir a troca. Devolve apenas booleano:
-- nenhum hash sai da funcao.
create or replace function public.senha_confere(p_id uuid, p_senha text)
returns boolean language sql security definer
set search_path = public, extensions, pg_temp stable
as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_id
      and u.encrypted_password = extensions.crypt(p_senha, u.encrypted_password)
  );
$$;

create or replace function public.admin_remover_usuario(p_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- perfis tem ON DELETE CASCADE a partir de auth.users
  delete from auth.users where id = p_id;
  if not found then raise exception 'usuario nao encontrado'; end if;
end;
$$;

revoke all on function public.admin_criar_usuario(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_definir_senha(uuid, text) from public, anon, authenticated;
revoke all on function public.senha_confere(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_remover_usuario(uuid) from public, anon, authenticated;

grant execute on function public.admin_criar_usuario(text, text, text, text, text, text) to service_role;
grant execute on function public.admin_definir_senha(uuid, text) to service_role;
grant execute on function public.senha_confere(uuid, text) to service_role;
grant execute on function public.admin_remover_usuario(uuid) to service_role;
