-- Pausar la oferta de prueba (queda en el panel de su dueño, fuera del marketplace)
update rewards.ofertas o
set estado = 'pausada'
from rewards.empresas e
where e.id = o.empresa_id and (e.nombre = 'Prueba' or o.producto = 'prueba');

-- Marketplace jerarquico para el vendedor: tenant -> agentes/empresas -> ofertas.
-- Incluye la autoria (que cuenta la publica) y los canales encendidos del agente
-- para poder pintar los "foquitos".
create or replace function rewards.ofertas_publicadas()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'publicado_por', x->>'empresa'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'oferta_id', o.id,
      'producto', o.producto,
      'descripcion', o.descripcion,
      'comision_mxn', o.comision_mxn,
      'precio_mxn', o.precio_mxn,
      'condicion', o.condicion_liberacion,
      'capacitacion', o.capacitacion::text,
      'fotos', o.fotos,
      'creada', o.created_at,
      'empresa_id', e.id,
      'empresa', e.nombre,
      'assistant_id', e.assistant_id,
      'agente', a.name,
      -- canales encendidos del agente (whatsapp, web, voz…)
      'canales', case
        when a.id is null then '[]'::jsonb
        else coalesce(a.channels, '[]'::jsonb)
             || case when a.whatsapp_phone_number is not null then '["whatsapp"]'::jsonb else '[]'::jsonb end
             || case when a.widget_public_key is not null then '["web"]'::jsonb else '[]'::jsonb end
      end,
      'agente_activo', coalesce(a.is_active, false),
      'tenant_id', e.tenant_id,
      'publicado_por', coalesce(t.name, e.nombre),
      'suscrito', exists (
        select 1 from rewards.suscripciones s
        where s.empresa_id = e.id and s.freelancer_id = rewards.current_freelancer_id()
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
