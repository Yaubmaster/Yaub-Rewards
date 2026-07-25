-- Estadísticas públicas de la landing (rewards.yaub.ai).
-- Solo agregados (sin PII) para que la sección "Números que motivan" muestre
-- cifras REALES y verificables en vez de placeholders. Ejecutable por anon
-- porque la landing la ven visitantes sin sesión.
create or replace function rewards.stats_publicas()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'comisiones_pagadas_mxn', (
      select coalesce(sum(monto_mxn), 0)::numeric
      from rewards.referidos where estatus = 'pagado'
    ),
    'vendedores_activos', (
      select count(*) from rewards.freelancers where activo
    ),
    'ventas_cerradas', (
      select count(*) from rewards.referidos where estatus in ('liberado', 'pagado')
    ),
    'empresas_publicadas', (
      select count(*) from rewards.empresas where estado = 'autorizada'
    )
  );
$$;

revoke execute on function rewards.stats_publicas() from public;
grant execute on function rewards.stats_publicas() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
