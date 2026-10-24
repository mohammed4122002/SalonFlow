-- SalonFlow — Phase 1: Row Level Security and table privileges
--
-- Model:
--   * super_admin  : full access to every salon.
--   * salon_owner  : full access to rows of the salons they own, nothing else.
--   * anon/public  : read-only access to published, active salons and their
--                    active services/specialists/hours. Never customers,
--                    bookings, time off or subscriptions.
-- Public booking creation will go through a dedicated function in phase 3.

alter table public.profiles            enable row level security;
alter table public.salons              enable row level security;
alter table public.services            enable row level security;
alter table public.specialists         enable row level security;
alter table public.specialist_services enable row level security;
alter table public.working_hours       enable row level security;
alter table public.time_off            enable row level security;
alter table public.customers           enable row level security;
alter table public.bookings            enable row level security;
alter table public.subscriptions       enable row level security;

-- ---------------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS).
-- TRUNCATE bypasses RLS, so it is revoked from API roles everywhere.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.salons, public.services, public.specialists,
                public.specialist_services, public.working_hours
  to anon;

grant select, insert, update, delete on
  public.salons, public.services, public.specialists, public.specialist_services,
  public.working_hours, public.time_off, public.customers, public.bookings,
  public.subscriptions
  to authenticated;
grant select, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_super_admin()));

create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_super_admin()))
  with check (id = (select auth.uid()) or (select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- salons
-- ---------------------------------------------------------------------------
create policy "salons: public read" on public.salons
  for select to anon
  using (is_published and status = 'active');

create policy "salons: read public, own or admin" on public.salons
  for select to authenticated
  using (
    (is_published and status = 'active')
    or owner_id = (select auth.uid())
    or (select private.is_super_admin())
  );

create policy "salons: owner creates own" on public.salons
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "salons: owner or admin updates" on public.salons
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_super_admin()))
  with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "salons: admin deletes" on public.salons
  for delete to authenticated
  using ((select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Salon-scoped tables with public catalogue data:
-- services, specialists (only active rows public), specialist_services,
-- working_hours.
-- ---------------------------------------------------------------------------
create policy "services: public read" on public.services
  for select to anon
  using (is_active and private.is_public_salon(salon_id));
create policy "services: read" on public.services
  for select to authenticated
  using ((is_active and private.is_public_salon(salon_id))
         or private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "services: insert" on public.services
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "services: update" on public.services
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "services: delete" on public.services
  for delete to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

create policy "specialists: public read" on public.specialists
  for select to anon
  using (is_active and private.is_public_salon(salon_id));
create policy "specialists: read" on public.specialists
  for select to authenticated
  using ((is_active and private.is_public_salon(salon_id))
         or private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "specialists: insert" on public.specialists
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "specialists: update" on public.specialists
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "specialists: delete" on public.specialists
  for delete to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

create policy "specialist_services: public read" on public.specialist_services
  for select to anon
  using (private.is_public_salon(salon_id));
create policy "specialist_services: read" on public.specialist_services
  for select to authenticated
  using (private.is_public_salon(salon_id)
         or private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "specialist_services: insert" on public.specialist_services
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "specialist_services: update" on public.specialist_services
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "specialist_services: delete" on public.specialist_services
  for delete to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

create policy "working_hours: public read" on public.working_hours
  for select to anon
  using (private.is_public_salon(salon_id));
create policy "working_hours: read" on public.working_hours
  for select to authenticated
  using (private.is_public_salon(salon_id)
         or private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "working_hours: insert" on public.working_hours
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "working_hours: update" on public.working_hours
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "working_hours: delete" on public.working_hours
  for delete to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Private salon data: time_off, customers, bookings (owner/admin only).
-- ---------------------------------------------------------------------------
create policy "time_off: read" on public.time_off
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "time_off: insert" on public.time_off
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "time_off: update" on public.time_off
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "time_off: delete" on public.time_off
  for delete to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

create policy "customers: read" on public.customers
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "customers: insert" on public.customers
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "customers: update" on public.customers
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "customers: delete" on public.customers
  for delete to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));

create policy "bookings: read" on public.bookings
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "bookings: insert" on public.bookings
  for insert to authenticated
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "bookings: update" on public.bookings
  for update to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()))
  with check (private.owns_salon(salon_id) or (select private.is_super_admin()));
-- Bookings are cancelled, not deleted; only admins can hard-delete.
create policy "bookings: admin deletes" on public.bookings
  for delete to authenticated
  using ((select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- subscriptions: owners read their own; only admins write.
-- ---------------------------------------------------------------------------
create policy "subscriptions: read" on public.subscriptions
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "subscriptions: admin inserts" on public.subscriptions
  for insert to authenticated
  with check ((select private.is_super_admin()));
create policy "subscriptions: admin updates" on public.subscriptions
  for update to authenticated
  using ((select private.is_super_admin()))
  with check ((select private.is_super_admin()));
create policy "subscriptions: admin deletes" on public.subscriptions
  for delete to authenticated
  using ((select private.is_super_admin()));
