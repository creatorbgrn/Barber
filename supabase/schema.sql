create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(trim(client_name)) >= 2),
  phone text not null check (char_length(trim(phone)) >= 5),
  email text not null check (position('@' in email) > 1),
  service text not null check (char_length(trim(service)) >= 2),
  preferred_day date not null,
  preferred_time time not null,
  notes text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_status_idx on public.bookings (status);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can insert bookings" on public.bookings;
create policy "Public can insert bookings"
  on public.bookings
  for insert
  to anon, authenticated
  with check (status = 'new');

drop policy if exists "Admins can read bookings" on public.bookings;
create policy "Admins can read bookings"
  on public.bookings
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update bookings" on public.bookings;
create policy "Admins can update bookings"
  on public.bookings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can read their own admin row" on public.admin_users;
create policy "Users can read their own admin row"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.bookings is 'Booking requests submitted from the public website.';
comment on table public.admin_users is 'Supabase auth users who can access the admin dashboard.';

-- After creating your admin user in Supabase Auth, add the user here:
-- insert into public.admin_users (user_id) values ('YOUR_ADMIN_USER_UUID');
