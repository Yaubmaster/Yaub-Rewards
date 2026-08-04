-- Yaub Rewards · fix: pausar una oferta desde el panel de empresa la saca de
-- verdad del marketplace del vendedor.
--
-- `rewards.ofertas` arrastra dos banderas: `estado` (borrador/publicada/pausada),
-- que es la que filtra rewards.ofertas_publicadas(), y `activa` (boolean, la
-- original de la migración 1). El trigger que las sincronizaba solo disparaba
-- con `update of estado`; el panel de empresa escribe `activa`, así que al
-- desactivar una oferta `estado` se quedaba en 'publicada' y el vendedor la
-- seguía viendo en el marketplace y en "Mis ofertas".
--
-- Ahora el trigger corre en cualquier insert/update y sincroniza en los dos
-- sentidos: manda el campo que cambió, y `activa` siempre queda derivada de
-- `estado`. Así el bug no vuelve aunque otro cliente escriba la bandera vieja.

create or replace function rewards.tg_oferta_sinc_activa()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- alta explícita con activa=false: nace pausada aunque `estado` traiga el default
    if new.activa is false and new.estado = 'publicada'::rewards.oferta_estado then
      new.estado := 'pausada'::rewards.oferta_estado;
    end if;
  elsif new.estado is not distinct from old.estado
        and new.activa is distinct from old.activa then
    -- solo se movió la bandera vieja: se traduce a estado
    new.estado := (case when new.activa then 'publicada' else 'pausada' end)::rewards.oferta_estado;
  end if;

  new.activa := (new.estado = 'publicada'::rewards.oferta_estado);
  return new;
end;
$$;

drop trigger if exists trg_oferta_sinc_activa on rewards.ofertas;
create trigger trg_oferta_sinc_activa
before insert or update on rewards.ofertas
for each row execute function rewards.tg_oferta_sinc_activa();

-- Ofertas que ya quedaron desincronizadas: se desactivaron desde el panel pero
-- siguen publicadas. Se pausan de verdad.
update rewards.ofertas
set estado = 'pausada'::rewards.oferta_estado
where activa is false
  and estado = 'publicada'::rewards.oferta_estado;

-- Resto de desincronizaciones (activa=true sobre una pausada/borrador): manda
-- `estado`. El `set estado = estado` no cambia ninguna de las dos columnas, así
-- que ninguna rama del trigger aplica y solo corre la línea que deriva `activa`.
update rewards.ofertas
set estado = estado
where activa is distinct from (estado = 'publicada'::rewards.oferta_estado);

notify pgrst, 'reload schema';
