-- Yaub Rewards · migración 1: schema, enums, tablas e índices.
-- Todo vive en el schema `rewards`; el schema `public` existente no se toca.

create schema if not exists rewards;

create type rewards.empresa_estado as enum ('en_revision', 'autorizada');
create type rewards.capacitacion_tipo as enum ('en_linea', 'presencial', 'ninguna');
create type rewards.referido_estatus as enum ('pendiente', 'liberado', 'pagado');

create table rewards.freelancers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre text not null,
  telefono text,
  codigo text not null unique,
  clabe text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table rewards.empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nombre text not null,
  descripcion text,
  estado rewards.empresa_estado not null default 'en_revision',
  created_at timestamptz not null default now()
);

create table rewards.ofertas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references rewards.empresas (id) on delete cascade,
  producto text not null,
  comision_mxn numeric not null default 0,
  condicion_liberacion text,
  capacitacion rewards.capacitacion_tipo not null default 'ninguna',
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table rewards.suscripciones (
  freelancer_id uuid not null references rewards.freelancers (id) on delete cascade,
  empresa_id uuid not null references rewards.empresas (id) on delete cascade,
  capacitacion_completada boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (freelancer_id, empresa_id)
);

create table rewards.referidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  freelancer_id uuid not null references rewards.freelancers (id) on delete restrict,
  oferta_id uuid not null references rewards.ofertas (id) on delete restrict,
  cliente_telefono text not null,
  -- teléfono normalizado (últimos 10 dígitos) para idempotencia y búsquedas
  tel_norm text generated always as (right(regexp_replace(cliente_telefono, '\D', '', 'g'), 10)) stored,
  monto_mxn numeric not null default 0,
  estatus rewards.referido_estatus not null default 'pendiente',
  evento_alta text,
  evento_liberacion text,
  conversation_id text,
  created_at timestamptz not null default now(),
  liberado_at timestamptz
);

create table rewards.pagos (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references rewards.freelancers (id) on delete cascade,
  monto_mxn numeric not null,
  metodo text,
  notas text,
  created_at timestamptz not null default now()
);

-- Lista de correos con acceso al panel /admin (espejo de ADMIN_EMAILS)
create table rewards.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- API keys de los agentes (se guarda solo el sha256; el plaintext se entrega una vez)
create table rewards.api_keys (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  key_hash text not null unique,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create index referidos_codigo_idx on rewards.referidos (codigo);
create index referidos_cliente_telefono_idx on rewards.referidos (cliente_telefono);
create index referidos_tel_norm_idx on rewards.referidos (tel_norm);
create index referidos_freelancer_idx on rewards.referidos (freelancer_id);
create index referidos_oferta_idx on rewards.referidos (oferta_id);
create index referidos_estatus_idx on rewards.referidos (estatus);
-- idempotencia dura: un cliente no puede registrarse dos veces a la misma oferta
create unique index referidos_oferta_tel_unq on rewards.referidos (oferta_id, tel_norm);
create index ofertas_empresa_idx on rewards.ofertas (empresa_id);
create index suscripciones_empresa_idx on rewards.suscripciones (empresa_id);
create index pagos_freelancer_idx on rewards.pagos (freelancer_id);
