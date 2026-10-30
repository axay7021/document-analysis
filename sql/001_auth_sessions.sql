create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  first_name text,
  last_name text,
  email_verified boolean not null default false,
  is_active boolean not null default true,
  google_subject text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  family_id uuid not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by uuid references auth_sessions(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists auth_sessions_user_idx on auth_sessions(user_id);
create index if not exists auth_sessions_family_idx on auth_sessions(family_id);

create table if not exists email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_codes_user_idx on email_verification_codes(user_id);

alter table app_users enable row level security;
alter table auth_sessions enable row level security;
alter table email_verification_codes enable row level security;
