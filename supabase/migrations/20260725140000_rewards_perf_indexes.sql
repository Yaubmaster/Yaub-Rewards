-- Índices para las FKs nuevas señaladas por el advisor de performance.
create index if not exists agentes_trial_tenant_idx
  on rewards.agentes_trial (tenant_id);

create index if not exists freelancer_referidos_disparador_idx
  on rewards.freelancer_referidos (referido_disparador_id);
