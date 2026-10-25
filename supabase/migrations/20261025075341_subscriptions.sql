-- SalonFlow — Phase 4: subscriptions, trial expiry and account suspension
--
-- Rules
--   * Each salon starts a 30-day trial (phase 1).
--   * A salon is "operational" while: salons.status = 'active' AND its
--     subscription is a running trial, or an active paid period.
--   * A non-operational salon is hidden from the public, cannot take bookings,
--     and its owner cannot change catalogue, hours, settings or customers.
--     The owner can still sign in, read everything and cancel bookings (so
--     customers can be informed). Super admins are never restricted.
--   * Expiry is evaluated live (no waiting for a job); a scheduled job also
--     records it in subscriptions.status for reporting.
--   * Payment-provider columns already exist; a payments table is reserved
--     for a future gateway webhook. No gateway is integrated.

create or replace function private.subscription_valid(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.salon_id = p_salon_id
      and (
        (s.status = 'trialing' and s.trial_ends_at > now())
        or (s.status = 'active' and (s.current_period_end is null or s.current_period_end > now()))
      )
  );
$$;

create or replace function private.salon_is_operational(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.salons where id = p_salon_id and status = 'active')
     and private.subscription_valid(p_salon_id);
$$;

-- Public visibility and bookings now also require a valid subscription.
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
  ) and private.subscription_valid(p_salon_id);
$$;

create or replace function private.salon_is_bookable(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_public_salon(p_salon_id);
$$;

-- Owner may write to a salon's data only while it is operational.
create or replace function private.can_manage_salon(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
      or (private.owns_salon(p_salon_id) and private.salon_is_operational(p_salon_id));
$$;

revoke all on function private.subscription_valid(uuid) from public, anon, authenticated;
revoke all on function private.salon_is_operational(uuid) from public;
revoke all on function private.can_manage_salon(uuid) from public;
grant execute on function private.salon_is_operational(uuid) to anon, authenticated;
grant execute on function private.can_manage_salon(uuid) to anon, authenticated;

-- Salon listing for anon must also hide salons with an expired subscription.
alter policy "salons: public read" on public.salons
  using (is_published and status = 'active' and private.is_public_salon(id));
alter policy "salons: read public, own or admin" on public.salons
  using (
    private.is_public_salon(id)
    or owner_id = (select auth.uid())
    or (select private.is_super_admin())
  );
alter policy "salons: owner or admin updates" on public.salons
  using (private.can_manage_salon(id))
  with check (private.can_manage_salon(id));

-- Catalogue, hours, time off, customers: writes need an operational salon.
alter policy "services: insert" on public.services with check (private.can_manage_salon(salon_id));
alter policy "services: update" on public.services
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
alter policy "services: delete" on public.services using (private.can_manage_salon(salon_id));

alter policy "specialists: insert" on public.specialists with check (private.can_manage_salon(salon_id));
alter policy "specialists: update" on public.specialists
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
alter policy "specialists: delete" on public.specialists using (private.can_manage_salon(salon_id));

alter policy "specialist_services: insert" on public.specialist_services with check (private.can_manage_salon(salon_id));
alter policy "specialist_services: update" on public.specialist_services
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
alter policy "specialist_services: delete" on public.specialist_services using (private.can_manage_salon(salon_id));

alter policy "working_hours: insert" on public.working_hours with check (private.can_manage_salon(salon_id));
alter policy "working_hours: update" on public.working_hours
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
alter policy "working_hours: delete" on public.working_hours using (private.can_manage_salon(salon_id));

alter policy "time_off: insert" on public.time_off with check (private.can_manage_salon(salon_id));
alter policy "time_off: update" on public.time_off
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
alter policy "time_off: delete" on public.time_off using (private.can_manage_salon(salon_id));

alter policy "customers: insert" on public.customers with check (private.can_manage_salon(salon_id));
alter policy "customers: update" on public.customers
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
alter policy "customers: delete" on public.customers using (private.can_manage_salon(salon_id));

-- Bookings: an owner of a suspended salon may still cancel.
alter policy "bookings: insert" on public.bookings with check (private.can_manage_salon(salon_id));
alter policy "bookings: update" on public.bookings
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.can_manage_salon(salon_id) or (private.owns_salon(salon_id) and status = 'cancelled'));

-- ---------------------------------------------------------------------------
-- Status bookkeeping
-- ---------------------------------------------------------------------------
create or replace function private.expire_subscriptions()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.subscriptions
  set status = 'suspended'
  where (status = 'trialing' and trial_ends_at <= now())
     or (status = 'active' and current_period_end is not null and current_period_end <= now());
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.expire_subscriptions() from public, anon, authenticated;

-- Run hourly where pg_cron is available (it is on Supabase).
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('salonflow-expire-subscriptions', '7 * * * *',
                          'select private.expire_subscriptions()');
  end if;
end
$do$;

-- History of subscription changes (who / what), for the admin panel.
create table public.subscription_events (
  id          bigint generated always as identity primary key,
  salon_id    uuid not null references public.salons (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  event       text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index subscription_events_salon_id_idx on public.subscription_events (salon_id, created_at desc);
create index subscription_events_actor_id_idx on public.subscription_events (actor_id);
alter table public.subscription_events enable row level security;
revoke all on public.subscription_events from anon, authenticated;
grant select on public.subscription_events to authenticated;
create policy "subscription_events: read" on public.subscription_events
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

create or replace function private.log_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.plan is distinct from old.plan then
    insert into public.subscription_events (salon_id, actor_id, event, details)
    values (new.salon_id, auth.uid(), 'updated', jsonb_build_object(
      'from', jsonb_build_object('status', old.status, 'plan', old.plan,
                                 'trial_ends_at', old.trial_ends_at, 'current_period_end', old.current_period_end),
      'to', jsonb_build_object('status', new.status, 'plan', new.plan,
                               'trial_ends_at', new.trial_ends_at, 'current_period_end', new.current_period_end)));
  end if;
  return new;
end;
$$;

create trigger log_subscription_change after update on public.subscriptions
  for each row execute function private.log_subscription_change();

-- Reserved for a future payment gateway (webhook events land here).
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  salon_id             uuid not null references public.salons (id) on delete cascade,
  provider             text not null,
  provider_payment_id  text not null,
  amount               numeric(10, 2) not null check (amount >= 0),
  currency             char(3) not null,
  status               text not null,
  period_start         timestamptz,
  period_end           timestamptz,
  raw                  jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_salon_id_idx on public.payments (salon_id);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "payments: read" on public.payments
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));
