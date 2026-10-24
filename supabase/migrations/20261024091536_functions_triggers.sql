-- SalonFlow — Phase 1: helper functions and triggers

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer so they can read salons/profiles without
-- recursing into RLS). Kept in the non-exposed "private" schema.
-- ---------------------------------------------------------------------------
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super_admin'
  );
$$;

create or replace function private.owns_salon(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salons
    where id = p_salon_id and owner_id = (select auth.uid())
  );
$$;

-- A salon is visible to the public when published and not suspended.
create or replace function private.is_public_salon(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salons
    where id = p_salon_id and is_published and status = 'active'
  );
$$;

-- True when the current statement comes from an API client (anon/authenticated)
-- rather than from a privileged context (SQL editor, service role, migrations).
create or replace function private.is_api_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

-- ---------------------------------------------------------------------------
-- Generic updated_at
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.salons
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.specialists
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Accounts: create a profile for every new auth user.
-- The role is never taken from user metadata: every sign-up is a salon owner.
-- Super admins are promoted manually (see docs/phase-1-database.md).
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_user_email();

-- Only super admins (or privileged contexts) may change role, id or email.
create or replace function private.protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_api_request() and not private.is_super_admin() then
    if new.role is distinct from old.role then
      raise exception 'not allowed to change role' using errcode = '42501';
    end if;
    if new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'not allowed to change id or email' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile before update on public.profiles
  for each row execute function private.protect_profile();

-- ---------------------------------------------------------------------------
-- Salons
-- ---------------------------------------------------------------------------
create or replace function private.validate_salon()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;

  -- Owners cannot transfer ownership or change the account status themselves.
  if private.is_api_request() and not private.is_super_admin() then
    if tg_op = 'INSERT' then
      new.status := 'active';
    elsif new.owner_id is distinct from old.owner_id or new.status is distinct from old.status then
      raise exception 'not allowed to change owner or status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_salon before insert or update on public.salons
  for each row execute function private.validate_salon();

-- Every new salon starts a 30-day trial.
create or replace function private.create_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (salon_id) values (new.id);
  return new;
end;
$$;

create trigger create_trial_subscription after insert on public.salons
  for each row execute function private.create_trial_subscription();

-- ---------------------------------------------------------------------------
-- Bookings: integrity rules that constraints alone cannot express.
-- ---------------------------------------------------------------------------
create or replace function private.validate_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then
      raise exception 'a booking cannot be created as cancelled' using errcode = '23514';
    end if;
  else
    -- Status flow: pending -> confirmed | cancelled, confirmed -> cancelled.
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'a cancelled booking cannot be reopened' using errcode = '23514';
    end if;
    if old.status = 'confirmed' and new.status = 'pending' then
      raise exception 'a confirmed booking cannot return to pending' using errcode = '23514';
    end if;
    if new.salon_id is distinct from old.salon_id then
      raise exception 'a booking cannot move to another salon' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
    new.cancelled_at := case when new.status = 'cancelled' then now() end;
  end if;

  if tg_op = 'INSERT'
     or new.service_id is distinct from old.service_id
     or new.specialist_id is distinct from old.specialist_id then
    if not exists (
      select 1 from public.specialist_services
      where specialist_id = new.specialist_id and service_id = new.service_id
    ) then
      raise exception 'this specialist does not offer this service' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_booking before insert or update on public.bookings
  for each row execute function private.validate_booking();

-- ---------------------------------------------------------------------------
-- Function privileges: nothing in "private" is callable by default; only the
-- RLS helpers are granted, since policies run them as the API role.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_super_admin() to anon, authenticated;
grant execute on function private.owns_salon(uuid) to anon, authenticated;
grant execute on function private.is_public_salon(uuid) to anon, authenticated;
grant execute on function private.is_api_request() to anon, authenticated;
