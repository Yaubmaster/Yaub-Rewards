-- Rate-limit anti-spam para crear-cuenta-rewards. El signup es público y sin
-- confirmación de correo (crea usuarios pre-confirmados vía admin API), así que
-- es fácil de abusar (spam / squatting de correos). Registramos intentos por IP;
-- la edge fn rechaza (429) si hay demasiados en la ventana de 1h.
-- Solo la edge fn (service_role) escribe/lee → RLS on sin policies (service_role
-- la bypasea; nadie más necesita acceso).
create table if not exists rewards.signup_attempts (
  id         bigint generated always as identity primary key,
  ip         text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_at
  on rewards.signup_attempts (ip, created_at desc);

alter table rewards.signup_attempts enable row level security;
