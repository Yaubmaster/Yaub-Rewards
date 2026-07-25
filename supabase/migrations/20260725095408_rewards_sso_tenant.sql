-- Yaub Rewards · SSO con la plataforma Yaub (Feature 1).
-- Liga cada empresa de Rewards a un tenant real de la plataforma para que sus
-- agentes vivan en la infraestructura normal (assistants, módulos, permisos).
-- 100% aditiva: una columna nueva en rewards.empresas y una función definer.

alter table rewards.empresas
  add column if not exists tenant_id uuid references public.tenants(id);

create index if not exists empresas_tenant_idx on rewards.empresas (tenant_id);

-- Provisiona (o liga) el tenant de una empresa. Idempotente.
-- Orden de resolución:
--   1. Ya tiene tenant_id → lo regresa.
--   2. El app_user tiene tenant activo no reclamado por otra empresa → lo liga.
--   3. Membresía activa a un tenant no reclamado → lo liga.
--   4. Crea tenant self_service nuevo (+ plan + suscripción + membresía).
-- Los módulos default se auto-siembran con el trigger existente de public.tenants.
create or replace function rewards.ensure_empresa_tenant(p_empresa_id uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_emp rewards.empresas;
  v_app_user public.app_users;
  v_tenant_id uuid;
  v_plan_id uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_emp from rewards.empresas where id = p_empresa_id;
  if not found then
    raise exception 'Empresa no encontrada';
  end if;
  if v_emp.user_id <> v_uid and not rewards.is_admin() then
    raise exception 'No autorizado';
  end if;

  if v_emp.tenant_id is not null then
    return v_emp.tenant_id;
  end if;

  select * into v_app_user from public.app_users where auth_user_id = v_emp.user_id;
  if not found then
    -- No debería pasar: el trigger de plataforma crea app_users en cada alta.
    raise exception 'La cuenta no tiene perfil de plataforma Yaub';
  end if;

  -- 2) tenant activo del app_user (lo creó el signup de plataforma), si está libre
  select t.id into v_tenant_id
  from public.tenants t
  where t.id = v_app_user.tenant_id
    and t.is_active
    and not exists (select 1 from rewards.empresas e2 where e2.tenant_id = t.id);

  -- 3) alguna membresía activa a un tenant libre
  if v_tenant_id is null then
    select m.tenant_id into v_tenant_id
    from public.user_tenant_memberships m
    join public.tenants t on t.id = m.tenant_id and t.is_active
    where m.app_user_id = v_app_user.id
      and m.is_active
      and not exists (select 1 from rewards.empresas e2 where e2.tenant_id = m.tenant_id)
    order by m.is_default desc, m.created_at
    limit 1;
  end if;

  -- 4) crear tenant nuevo (mismo shape que el self-signup de la plataforma)
  if v_tenant_id is null then
    v_slug := lower(regexp_replace(translate(v_emp.nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug) || '-' || substr(gen_random_uuid()::text, 1, 8);

    insert into public.tenants (name, slug, is_active, account_type, onboarding_type, company_name, source)
    values (v_emp.nombre, v_slug, true, 'self_service', 'self_service', v_emp.nombre, 'rewards')
    returning id into v_tenant_id;

    select id into v_plan_id from public.tenant_plans where slug = 'self_service' limit 1;
    if v_plan_id is null then
      select id into v_plan_id from public.tenant_plans where slug = 'free' limit 1;
    end if;
    if v_plan_id is not null then
      update public.tenants set plan_id = v_plan_id where id = v_tenant_id;
      insert into public.tenant_subscriptions (tenant_id, plan_id, status)
      values (v_tenant_id, v_plan_id, 'active');
    end if;
  end if;

  -- membresía (set_active_tenant la exige) — idempotente
  insert into public.user_tenant_memberships (app_user_id, tenant_id, role, is_active, is_default)
  values (v_app_user.id, v_tenant_id, 'BUSINESS_OWNER', true, (v_app_user.tenant_id is null))
  on conflict do nothing;

  -- si el usuario no tenía tenant activo, este se vuelve el suyo
  update public.app_users
  set tenant_id = coalesce(tenant_id, v_tenant_id)
  where id = v_app_user.id;

  update rewards.empresas set tenant_id = v_tenant_id where id = p_empresa_id;
  return v_tenant_id;
end;
$$;

revoke execute on function rewards.ensure_empresa_tenant(uuid) from public, anon;
grant execute on function rewards.ensure_empresa_tenant(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
