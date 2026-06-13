-- Registration profiles linked to Supabase Auth phone users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null,
  last_name text not null,
  first_name text not null,
  middle_name text not null default '',
  birth_year text not null,
  birth_month smallint not null check (birth_month between 1 and 12),
  barangay text not null,
  municipality text not null default 'Minglanilla',
  pin_hash text not null,
  registration_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_unique unique (phone)
);

create index if not exists profiles_phone_idx on public.profiles (phone);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile once"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_profiles_updated_at();
