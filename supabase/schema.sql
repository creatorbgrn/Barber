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
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'completed', 'cancelled')),
  revenue numeric(10,2) default 0,
  website_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_status_idx on public.bookings (status);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_settings (
  key text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references public.websites(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  description text not null,
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

create or replace function public.is_superadmin()
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
    and user_id in (
      select au.user_id
      from public.admin_users au
      join auth.users u on au.user_id = u.id
      where u.email like '%superadmin%' or u.email like '%admin%'
    )
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.get_slot_booking_count(p_day date, p_time time)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.bookings
  where preferred_day = p_day
    and preferred_time = p_time
    and status in ('new', 'contacted', 'confirmed');
$$;

revoke all on function public.get_slot_booking_count(date, time) from public;
grant execute on function public.get_slot_booking_count(date, time) to anon, authenticated;

alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.websites enable row level security;
alter table public.notifications enable row level security;
alter table public.products enable row level security;

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

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings"
  on public.site_settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Superadmins can manage websites" on public.websites;
create policy "Superadmins can manage websites"
  on public.websites
  for all
  to authenticated
  using (public.is_superadmin());

drop policy if exists "Superadmins can manage notifications" on public.notifications;
create policy "Superadmins can manage notifications"
  on public.notifications
  for all
  to authenticated
  using (public.is_superadmin());

drop policy if exists "Superadmins can manage products" on public.products;
create policy "Superadmins can manage products"
  on public.products
  for all
  to authenticated
  using (public.is_superadmin());

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
  on public.products
  for select
  to anon, authenticated
  using (true);

insert into public.site_settings (key, settings)
values ('main', '{}'::jsonb)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-photos',
  'site-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read site photos" on storage.objects;
create policy "Public can read site photos"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-photos');

drop policy if exists "Admins can upload site photos" on storage.objects;
create policy "Admins can upload site photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'site-photos' and public.is_admin());

drop policy if exists "Admins can update site photos" on storage.objects;
create policy "Admins can update site photos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'site-photos' and public.is_admin())
  with check (bucket_id = 'site-photos' and public.is_admin());

drop policy if exists "Admins can delete site photos" on storage.objects;
create policy "Admins can delete site photos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'site-photos' and public.is_admin());

comment on table public.bookings is 'Booking requests submitted from the public website.';
comment on table public.admin_users is 'Supabase auth users who can access the admin dashboard.';
comment on table public.site_settings is 'Editable website services, gallery photos, and booking availability rules.';

-- After creating your admin user in Supabase Auth, add the user here:
-- insert into public.admin_users (user_id) values ('YOUR_ADMIN_USER_UUID');
