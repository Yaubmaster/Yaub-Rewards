do $$ begin
  create type rewards.oferta_estado as enum ('borrador', 'publicada', 'pausada');
exception when duplicate_object then null; end $$;

alter table rewards.ofertas
  add column if not exists estado rewards.oferta_estado not null default 'publicada';

update rewards.ofertas
set estado = (case when activa then 'publicada' else 'pausada' end)::rewards.oferta_estado;

create index if not exists ofertas_estado_idx on rewards.ofertas (estado) where estado = 'publicada';

create or replace function rewards.tg_oferta_sinc_activa()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.activa := (new.estado = 'publicada');
  return new;
end;
$$;

drop trigger if exists trg_oferta_sinc_activa on rewards.ofertas;
create trigger trg_oferta_sinc_activa
before insert or update of estado on rewards.ofertas
for each row execute function rewards.tg_oferta_sinc_activa();

create or replace function rewards.ofertas_publicadas()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'empresa'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'oferta_id', o.id, 'producto', o.producto, 'descripcion', o.descripcion,
      'comision_mxn', o.comision_mxn, 'precio_mxn', o.precio_mxn,
      'condicion', o.condicion_liberacion, 'fotos', o.fotos,
      'empresa_id', e.id, 'empresa', e.nombre, 'assistant_id', e.assistant_id,
      'publicado_por', coalesce(t.name, e.nombre),
      'suscrito', exists (
        select 1 from rewards.suscripciones s
        where s.empresa_id = e.id and s.freelancer_id = rewards.current_freelancer_id()
      )
    ) as x
    from rewards.ofertas o
    join rewards.empresas e on e.id = o.empresa_id
    left join public.tenants t on t.id = e.tenant_id
    where o.estado = 'publicada' and e.estado = 'autorizada'
  ) s;
$$;

revoke execute on function rewards.ofertas_publicadas() from public, anon;
grant execute on function rewards.ofertas_publicadas() to authenticated, service_role;
grant update (estado) on rewards.ofertas to authenticated;

-- Fusion del duplicado de Prestamee: la fila "Agente - PRESTAME" se creo vacia
-- al activar Rewards. Se mueve su agente a "Prestamee" (que conserva su oferta
-- y sus 2 suscripciones) y se borra la vacia.
do $$
declare v_vacia uuid; v_buena uuid; v_asst uuid; v_tenant uuid;
begin
  select id, assistant_id, tenant_id into v_vacia, v_asst, v_tenant
  from rewards.empresas where nombre = 'Agente - PRESTAME' and assistant_id is not null;

  select id into v_buena from rewards.empresas where nombre = 'Prestamee' and assistant_id is null;

  if v_vacia is not null and v_buena is not null then
    delete from rewards.agentes_trial where empresa_id = v_vacia;
    delete from rewards.empresas where id = v_vacia;

    update rewards.empresas set assistant_id = v_asst, tenant_id = v_tenant where id = v_buena;

    insert into rewards.agentes_trial (assistant_id, empresa_id, tenant_id)
    values (v_asst, v_buena, v_tenant)
    on conflict (assistant_id) do update set empresa_id = excluded.empresa_id;
  end if;
end $$;

notify pgrst, 'reload schema';
