-- El panel empresarial se abre si el usuario ya tiene agentes en la plataforma,
-- aunque se haya registrado como vendedor: cada agente es una empresa potencial.
create or replace function rewards.tengo_panel_empresa()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with yo as (
    select au.id as app_user_id, au.tenant_id
    from public.app_users au
    where au.auth_user_id = (select auth.uid())
  )
  select exists (select 1 from rewards.empresas e where e.user_id = (select auth.uid()))
      or exists (
        select 1
        from public.assistants a
        where a.archived_at is null
          and (
            a.tenant_id = (select tenant_id from yo)
            or a.tenant_id in (
              select m.tenant_id
              from public.user_tenant_memberships m, yo
              where m.app_user_id = yo.app_user_id and m.is_active
            )
          )
      );
$$;

revoke execute on function rewards.tengo_panel_empresa() from public, anon;
grant execute on function rewards.tengo_panel_empresa() to authenticated, service_role;

notify pgrst, 'reload schema';
