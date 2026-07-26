-- Yaub Rewards · chat web automático y números de WhatsApp del agente.
--
-- 1) Todo agente con Rewards debe poder probarse dentro de Rewards. Si no
--    tiene el widget prendido, se le prende solo: llave `wk_` + 24
--    alfanuméricos (el formato que exige KEY_RE de widget-chat) y
--    `rewards.yaub.ai` en allowed_domains. NO se pisa nada de lo que ya haya
--    en widget_config (color, saludo, logo): solo se agrega lo indispensable.
-- 2) El agente puede tener números de WhatsApp ligados en
--    `public.whatsapp_numbers`. Antes solo mirábamos
--    `assistants.whatsapp_phone_number`, que en la práctica viene nulo aunque
--    el número exista — por eso el foquito de WhatsApp no prendía.
--
-- Ambas van SECURITY INVOKER: manda la RLS de la plataforma.

-- ── Prender el chat web ─────────────────────────────────────────────────────
create or replace function rewards.asegurar_chat_web(p_assistant_id uuid)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_key   text;
  v_cfg   jsonb;
  v_doms  jsonb;
  v_n     int;
begin
  select a.widget_public_key, coalesce(a.widget_config, '{}'::jsonb)
    into v_key, v_cfg
  from public.assistants a
  where a.id = p_assistant_id and a.archived_at is null;

  if not found then
    raise exception 'No tienes permiso para editar este agente';
  end if;

  -- wk_ + 24 alfanuméricos (formato que exige KEY_RE de widget-chat).
  -- gen_random_uuid vive en pg_catalog, que siempre resuelve aunque
  -- search_path esté vacío; gen_random_bytes es de pgcrypto y NO resolvería.
  if v_key is null then
    v_key := 'wk_' || substr(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      1, 24
    );
  end if;

  -- rewards.yaub.ai en allowed_domains, conservando los que ya estuvieran
  v_doms := coalesce(v_cfg->'allowed_domains', '[]'::jsonb);
  if not (v_doms @> '["rewards.yaub.ai"]'::jsonb) then
    v_doms := v_doms || '["rewards.yaub.ai"]'::jsonb;
  end if;

  update public.assistants
     set widget_public_key = v_key,
         widget_config = v_cfg || jsonb_build_object('enabled', true, 'allowed_domains', v_doms)
   where id = p_assistant_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'No tienes permiso para editar este agente';
  end if;

  return jsonb_build_object('ok', true, 'widget_key', v_key);
end;
$$;

revoke execute on function rewards.asegurar_chat_web(uuid) from public, anon;
grant execute on function rewards.asegurar_chat_web(uuid) to authenticated, service_role;

-- ── Números de WhatsApp del agente ──────────────────────────────────────────
-- Se usa dentro de otras funciones INVOKER, así que hereda su RLS.
create or replace function rewards.numeros_whatsapp(p_assistant_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', w.id,
        'numero', w.phone_number,
        'nombre', w.display_name,
        'activo', coalesce(w.is_active, false)
      ) order by w.created_at
    ),
    '[]'::jsonb
  )
  from public.whatsapp_numbers w
  where w.assistant_id = p_assistant_id;
$$;

revoke execute on function rewards.numeros_whatsapp(uuid) from public, anon;
grant execute on function rewards.numeros_whatsapp(uuid) to authenticated, service_role;

-- ── Los listados ahora traen los números ────────────────────────────────────
create or replace function rewards.mis_empresas_agentes()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'creada'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'empresa_id', e.id,
      'empresa', e.nombre,
      'estado', e.estado,
      'creada', e.created_at,
      'tenant_id', e.tenant_id,
      'ofertas', (select count(*) from rewards.ofertas o where o.empresa_id = e.id and o.activa),
      'agente', case when a.id is null then null else jsonb_build_object(
        'id', a.id,
        'nombre', a.name,
        'avatar_url', a.avatar_url,
        'activo', a.is_active,
        'widget_key', a.widget_public_key,
        'whatsapp', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', w.id, 'numero', w.phone_number,
            'nombre', w.display_name, 'activo', coalesce(w.is_active, false)
          ) order by w.created_at)
          from public.whatsapp_numbers w where w.assistant_id = a.id
        ), '[]'::jsonb),
        'interacciones_incluidas', coalesce(t.interacciones_incluidas, 100),
        'interacciones_usadas', case
          when t.id is null then 0
          else rewards.interacciones_agente(a.id, t.trial_started_at)
        end,
        'trial_activo', (t.id is not null and t.activated_at is null),
        'activado', (t.activated_at is not null),
        'pausado', (t.paused_at is not null or not a.is_active)
      ) end
    ) as x
    from rewards.empresas e
    left join public.assistants a
      on a.id = e.assistant_id and a.archived_at is null
    left join rewards.agentes_trial t on t.assistant_id = a.id
    where e.user_id = (select auth.uid())
  ) s;
$$;

-- ── El foquito de WhatsApp también sale de whatsapp_numbers ─────────────────
create or replace function rewards.ofertas_publicadas()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'publicado_por', x->>'empresa'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'oferta_id', o.id, 'producto', o.producto, 'descripcion', o.descripcion,
      'comision_mxn', o.comision_mxn, 'precio_mxn', o.precio_mxn,
      'condicion', o.condicion_liberacion, 'capacitacion', o.capacitacion::text,
      'fotos', o.fotos, 'creada', o.created_at,
      'empresa_id', e.id, 'empresa', e.nombre, 'assistant_id', e.assistant_id,
      'agente', a.name,
      'agente_avatar', a.avatar_url,
      'tenant_id', e.tenant_id,
      'publicado_por', coalesce(t.name, e.nombre),
      'tenant_avatar', coalesce(t.logo_url, t.logo_url_light),
      'canales', case when a.id is null then '[]'::jsonb else
        coalesce(a.channels, '[]'::jsonb)
        || case
             when a.whatsapp_phone_number is not null
               or exists (
                 select 1 from public.whatsapp_numbers w
                 where w.assistant_id = a.id and coalesce(w.is_active, false)
               )
             then '["whatsapp"]'::jsonb else '[]'::jsonb
           end
        || case when a.widget_public_key is not null then '["web"]'::jsonb else '[]'::jsonb end
      end,
      'agente_activo', coalesce(a.is_active, false),
      'suscrito', exists (
        select 1 from rewards.suscripciones s
        where s.empresa_id = e.id and s.freelancer_id = rewards.current_freelancer_id()
      ),
      'favorita', exists (
        select 1 from rewards.ofertas_favoritas f
        where f.oferta_id = o.id and f.freelancer_id = rewards.current_freelancer_id()
      )
    ) as x
    from rewards.ofertas o
    join rewards.empresas e on e.id = o.empresa_id
    left join public.assistants a on a.id = e.assistant_id
    left join public.tenants t on t.id = e.tenant_id
    where o.estado = 'publicada' and e.estado = 'autorizada'
  ) s;
$$;

revoke execute on function rewards.ofertas_publicadas() from public, anon;
grant execute on function rewards.ofertas_publicadas() to authenticated, service_role;

notify pgrst, 'reload schema';
