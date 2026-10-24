-- SalonFlow — Phase 1 automated checks (schema, RLS, constraints).
--
-- Runs inside one transaction and ROLLS BACK at the end: no data is kept.
-- Run it in the Supabase SQL Editor (paste & run) or with psql:
--   psql "$DATABASE_URL" -f supabase/tests/phase1_test.sql
-- The output is one row per check with passed = true/false.

begin;

-- ---------------------------------------------------------------------------
-- Test harness (temporary, rolled back with the transaction)
-- ---------------------------------------------------------------------------
create schema tests;
create table tests.results (
  id      serial primary key,
  name    text not null,
  passed  boolean not null,
  detail  text
);
grant usage on schema tests to anon, authenticated;
grant insert, select on tests.results to anon, authenticated;
grant usage on sequence tests.results_id_seq to anon, authenticated;

create function tests.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create function tests.ok(p_name text, p_cond boolean, p_detail text default null) returns void
language sql as $$
  insert into tests.results (name, passed, detail) values (p_name, coalesce(p_cond, false), p_detail);
$$;

-- Passes when p_sql fails with the expected SQLSTATE (or any error if null).
create function tests.throws(p_name text, p_sql text, p_state text default null) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform tests.ok(p_name, p_state is null or sqlstate = p_state, sqlstate || ': ' || sqlerrm);
    return;
  end;
  perform tests.ok(p_name, false, 'statement succeeded but should have failed');
end $$;

-- Number of rows touched by p_sql.
create function tests.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Checks
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin   uuid := gen_random_uuid();
  v_a       uuid := gen_random_uuid();   -- owner of salon A
  v_b       uuid := gen_random_uuid();   -- owner of salon B
  v_salon_a uuid;  v_salon_b uuid;
  v_svc_a   uuid;  v_svc_a2 uuid;  v_svc_b uuid;
  v_sp_a    uuid;  v_sp_a2  uuid;  v_sp_b  uuid;
  v_cust_a  uuid;  v_cust_a2 uuid; v_cust_b uuid;
  v_bk1     uuid;  v_bk2    uuid;
  v_t0      timestamptz := date_trunc('hour', now()) + interval '2 days';
  v_n       integer;
  v_txt     text;
begin
  -- Sign-ups (as the auth service would do). Metadata tries to claim admin.
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin, 'admin@test.local', '{"full_name":"Admin"}'),
    (v_a, 'owner.a@test.local', '{"full_name":"Owner A","role":"super_admin"}'),
    (v_b, 'owner.b@test.local', '{"full_name":"Owner B"}');
  update public.profiles set role = 'super_admin' where id = v_admin;  -- manual promotion

  -- === Accounts ===========================================================
  perform tests.ok('auth: profile auto-created on sign-up',
    (select count(*) from public.profiles where id in (v_admin, v_a, v_b)) = 3);
  perform tests.ok('auth: sign-up metadata cannot grant super_admin',
    (select role from public.profiles where id = v_a) = 'salon_owner');
  perform tests.ok('auth: profile email copied from auth.users',
    (select email from public.profiles where id = v_a) = 'owner.a@test.local');

  perform tests.login(v_a);
  perform tests.throws('auth: owner cannot promote self to super_admin',
    format('update public.profiles set role = %L where id = %L', 'super_admin', v_a), '42501');
  perform tests.ok('auth: owner can update own name',
    tests.affected(format('update public.profiles set full_name = %L where id = %L', 'Owner A2', v_a)) = 1);
  perform tests.ok('auth: owner cannot read another profile',
    (select count(*) from public.profiles where id = v_b) = 0);
  perform tests.ok('auth: owner cannot update another profile',
    tests.affected(format('update public.profiles set full_name = %L where id = %L', 'x', v_b)) = 0);
  perform tests.logout();

  perform tests.login(v_admin);
  perform tests.ok('auth: super_admin reads all profiles',
    (select count(*) from public.profiles where id in (v_admin, v_a, v_b)) = 3);
  perform tests.logout();

  -- === Salons =============================================================
  perform tests.login(v_a);
  insert into public.salons (owner_id, slug, name, timezone, currency, is_published, status)
    values (v_a, 'salon-a', 'Salon A', 'Asia/Riyadh', 'SAR', true, 'suspended')
    returning id into v_salon_a;
  perform tests.ok('salons: owner creates own salon', v_salon_a is not null);
  perform tests.ok('salons: owner cannot create salon as suspended/other status',
    (select status from public.salons where id = v_salon_a) = 'active');
  perform tests.throws('salons: owner cannot create a salon for another user',
    format($q$insert into public.salons (owner_id, slug, name, timezone, currency)
              values (%L, 'salon-x', 'X', 'Asia/Riyadh', 'SAR')$q$, v_b), '42501');
  perform tests.throws('salons: invalid timezone rejected',
    format($q$insert into public.salons (owner_id, slug, name, timezone, currency)
              values (%L, 'salon-tz', 'TZ', 'Mars/Base', 'SAR')$q$, v_a), '22023');
  perform tests.throws('salons: invalid slug rejected',
    format($q$insert into public.salons (owner_id, slug, name, timezone, currency)
              values (%L, 'Bad Slug', 'Bad', 'Asia/Riyadh', 'SAR')$q$, v_a), '23514');
  perform tests.throws('salons: owner cannot change own salon status',
    format('update public.salons set status = %L where id = %L', 'suspended', v_salon_a), '42501');
  perform tests.throws('salons: owner cannot transfer ownership',
    format('update public.salons set owner_id = %L where id = %L', v_b, v_salon_a), '42501');
  perform tests.ok('salons: owner cannot delete salon',
    tests.affected(format('delete from public.salons where id = %L', v_salon_a)) = 0);

  -- Catalogue for salon A
  insert into public.services (salon_id, name, duration_minutes, price)
    values (v_salon_a, 'Haircut', 60, 100) returning id into v_svc_a;
  insert into public.services (salon_id, name, duration_minutes, price, is_active)
    values (v_salon_a, 'Old service', 30, 50, false) returning id into v_svc_a2;
  insert into public.specialists (salon_id, full_name) values (v_salon_a, 'Sara') returning id into v_sp_a;
  insert into public.specialists (salon_id, full_name) values (v_salon_a, 'Huda') returning id into v_sp_a2;
  insert into public.specialist_services (salon_id, specialist_id, service_id)
    values (v_salon_a, v_sp_a, v_svc_a), (v_salon_a, v_sp_a2, v_svc_a);
  insert into public.customers (salon_id, full_name, phone, email)
    values (v_salon_a, 'Customer One', '+966500000001', 'c1@test.local') returning id into v_cust_a;
  insert into public.customers (salon_id, full_name, phone, email)
    values (v_salon_a, 'Customer Two', '+966500000002', 'c2@test.local') returning id into v_cust_a2;
  perform tests.ok('catalogue: owner manages services/specialists/customers', v_cust_a2 is not null);
  perform tests.logout();

  -- Subscription trial
  perform tests.ok('subscriptions: 30-day trial created automatically',
    exists (select 1 from public.subscriptions
            where salon_id = v_salon_a and status = 'trialing'
              and trial_ends_at - trial_starts_at = interval '30 days'));

  perform tests.login(v_a);
  perform tests.ok('subscriptions: owner reads own subscription',
    (select count(*) from public.subscriptions where salon_id = v_salon_a) = 1);
  perform tests.ok('subscriptions: owner cannot extend trial',
    tests.affected(format($q$update public.subscriptions set trial_ends_at = now() + interval '1 year'
                             where salon_id = %L$q$, v_salon_a)) = 0);
  perform tests.throws('subscriptions: owner cannot insert subscription',
    format('insert into public.subscriptions (salon_id) values (%L)', v_salon_a), '42501');
  perform tests.logout();

  -- Salon B (owner B)
  perform tests.login(v_b);
  insert into public.salons (owner_id, slug, name, timezone, currency, is_published)
    values (v_b, 'salon-b', 'Salon B', 'Asia/Dubai', 'AED', true) returning id into v_salon_b;
  insert into public.services (salon_id, name, duration_minutes, price)
    values (v_salon_b, 'Nails', 45, 80) returning id into v_svc_b;
  insert into public.specialists (salon_id, full_name) values (v_salon_b, 'Mona') returning id into v_sp_b;
  insert into public.specialist_services (salon_id, specialist_id, service_id) values (v_salon_b, v_sp_b, v_svc_b);
  insert into public.customers (salon_id, full_name, phone, email)
    values (v_salon_b, 'Customer B', '+971500000001', 'cb@test.local') returning id into v_cust_b;
  insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
    values (v_salon_b, v_cust_b, v_svc_b, v_sp_b, v_t0, v_t0 + interval '45 minutes', 80);
  perform tests.logout();

  -- === Tenant isolation (owner A vs salon B) ==============================
  perform tests.login(v_a);
  perform tests.ok('isolation: A cannot read B customers',
    (select count(*) from public.customers where salon_id = v_salon_b) = 0);
  perform tests.ok('isolation: A cannot read B bookings',
    (select count(*) from public.bookings where salon_id = v_salon_b) = 0);
  perform tests.ok('isolation: A cannot read B subscription',
    (select count(*) from public.subscriptions where salon_id = v_salon_b) = 0);
  perform tests.ok('isolation: A cannot update B salon',
    tests.affected(format('update public.salons set name = %L where id = %L', 'hacked', v_salon_b)) = 0);
  perform tests.ok('isolation: A cannot update B services',
    tests.affected(format('update public.services set price = 0 where salon_id = %L', v_salon_b)) = 0);
  perform tests.ok('isolation: A cannot delete B specialists',
    tests.affected(format('delete from public.specialists where salon_id = %L', v_salon_b)) = 0);
  perform tests.throws('isolation: A cannot insert a service into B',
    format($q$insert into public.services (salon_id, name, duration_minutes, price) values (%L, 'x', 30, 1)$q$, v_salon_b), '42501');
  perform tests.throws('isolation: A cannot insert a customer into B',
    format($q$insert into public.customers (salon_id, full_name, phone, email) values (%L, 'xx', '+966511111111', 'x@x.io')$q$, v_salon_b), '42501');
  perform tests.throws('isolation: A cannot move own service into B',
    format('update public.services set salon_id = %L where id = %L', v_salon_b, v_svc_a), '42501');
  perform tests.throws('isolation: cross-salon specialist/service link rejected',
    format('insert into public.specialist_services (salon_id, specialist_id, service_id) values (%L, %L, %L)',
           v_salon_a, v_sp_a, v_svc_b), '23503');
  perform tests.throws('isolation: booking with another salon''s customer rejected',
    format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
              values (%L, %L, %L, %L, %L, %L, 1)$q$,
           v_salon_a, v_cust_b, v_svc_a, v_sp_a, v_t0 + interval '10 hours', v_t0 + interval '11 hours'), '23503');
  perform tests.throws('security: TRUNCATE denied to API roles', 'truncate public.bookings', '42501');
  perform tests.logout();

  perform tests.login(v_admin);
  perform tests.ok('admin: reads bookings of every salon',
    (select count(*) from public.bookings where salon_id in (v_salon_a, v_salon_b)) >= 1);
  perform tests.ok('admin: can suspend a salon',
    tests.affected(format('update public.salons set status = %L where id = %L', 'suspended', v_salon_b)) = 1);
  perform tests.ok('admin: can extend a trial',
    tests.affected(format($q$update public.subscriptions set trial_ends_at = trial_ends_at + interval '7 days'
                             where salon_id = %L$q$, v_salon_b)) = 1);
  perform tests.logout();

  -- === Public (anon) visitors =============================================
  perform tests.login_anon();
  perform tests.ok('public: sees published active salon',
    (select count(*) from public.salons where id = v_salon_a) = 1);
  perform tests.ok('public: suspended salon hidden',
    (select count(*) from public.salons where id = v_salon_b) = 0);
  perform tests.ok('public: services of suspended salon hidden',
    (select count(*) from public.services where salon_id = v_salon_b) = 0);
  perform tests.ok('public: only active services listed',
    (select count(*) from public.services where salon_id = v_salon_a) = 1);
  perform tests.ok('public: specialists listed',
    (select count(*) from public.specialists where salon_id = v_salon_a) = 2);
  perform tests.throws('public: customers not readable', 'select * from public.customers', '42501');
  perform tests.throws('public: bookings not readable', 'select * from public.bookings', '42501');
  perform tests.throws('public: subscriptions not readable', 'select * from public.subscriptions', '42501');
  perform tests.throws('public: profiles not readable', 'select * from public.profiles', '42501');
  perform tests.throws('public: cannot insert salons',
    $q$insert into public.salons (owner_id, slug, name, timezone, currency)
       values (gen_random_uuid(), 'anon-salon', 'Anon', 'Asia/Riyadh', 'SAR')$q$, '42501');
  perform tests.throws('public: cannot modify services', 'update public.services set price = 0', '42501');
  perform tests.logout();

  perform tests.login(v_a);
  update public.salons set is_published = false where id = v_salon_a;
  perform tests.logout();
  perform tests.login_anon();
  perform tests.ok('public: unpublished salon hidden',
    (select count(*) from public.salons where id = v_salon_a) = 0);
  perform tests.logout();

  -- === Working hours ======================================================
  perform tests.login(v_a);
  insert into public.working_hours (salon_id, day_of_week, start_time, end_time)
    values (v_salon_a, 0, '09:00', '13:00'), (v_salon_a, 0, '16:00', '22:00');
  insert into public.working_hours (salon_id, specialist_id, day_of_week, start_time, end_time)
    values (v_salon_a, v_sp_a, 0, '10:00', '14:00');
  perform tests.ok('hours: split shifts and per-specialist hours allowed', true);
  perform tests.throws('hours: overlapping shifts rejected',
    format($q$insert into public.working_hours (salon_id, day_of_week, start_time, end_time)
              values (%L, 0, '12:00', '17:00')$q$, v_salon_a), '23P01');
  perform tests.throws('hours: end before start rejected',
    format($q$insert into public.working_hours (salon_id, day_of_week, start_time, end_time)
              values (%L, 1, '18:00', '09:00')$q$, v_salon_a), '23514');
  perform tests.throws('time off: end before start rejected',
    format($q$insert into public.time_off (salon_id, starts_at, ends_at) values (%L, now(), now() - interval '1 hour')$q$, v_salon_a), '23514');

  -- === Bookings ===========================================================
  insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
    values (v_salon_a, v_cust_a, v_svc_a, v_sp_a, v_t0, v_t0 + interval '60 minutes', 100)
    returning id into v_bk1;
  perform tests.ok('bookings: new booking defaults to pending',
    (select status from public.bookings where id = v_bk1) = 'pending');

  perform tests.throws('bookings: overlapping booking for same specialist rejected',
    format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
              values (%L, %L, %L, %L, %L, %L, 100)$q$,
           v_salon_a, v_cust_a2, v_svc_a, v_sp_a, v_t0 + interval '30 minutes', v_t0 + interval '90 minutes'), '23P01');
  perform tests.throws('bookings: same customer double-booked with another specialist rejected',
    format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
              values (%L, %L, %L, %L, %L, %L, 100)$q$,
           v_salon_a, v_cust_a, v_svc_a, v_sp_a2, v_t0 + interval '15 minutes', v_t0 + interval '75 minutes'), '23P01');
  perform tests.ok('bookings: back-to-back booking allowed',
    tests.affected(format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
                             values (%L, %L, %L, %L, %L, %L, 100)$q$,
           v_salon_a, v_cust_a2, v_svc_a, v_sp_a, v_t0 + interval '60 minutes', v_t0 + interval '120 minutes')) = 1);
  perform tests.throws('bookings: specialist not offering the service rejected',
    format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
              values (%L, %L, %L, %L, %L, %L, 50)$q$,
           v_salon_a, v_cust_a2, v_svc_a2, v_sp_a2, v_t0 + interval '3 hours', v_t0 + interval '4 hours'), '23514');
  perform tests.throws('bookings: cannot be created as cancelled',
    format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price, status)
              values (%L, %L, %L, %L, %L, %L, 100, 'cancelled')$q$,
           v_salon_a, v_cust_a2, v_svc_a, v_sp_a2, v_t0 + interval '5 hours', v_t0 + interval '6 hours'), '23514');
  perform tests.throws('customers: email is required',
    format($q$insert into public.customers (salon_id, full_name, phone, email) values (%L, 'No Mail', '+966522222222', null)$q$, v_salon_a), '23502');

  -- Cancel frees the slot immediately
  update public.bookings set status = 'cancelled', cancellation_reason = 'test' where id = v_bk1;
  perform tests.ok('bookings: cancelled_at set automatically',
    (select cancelled_at is not null from public.bookings where id = v_bk1));
  perform tests.ok('bookings: cancelled slot can be re-booked',
    tests.affected(format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
                             values (%L, %L, %L, %L, %L, %L, 100)$q$,
           v_salon_a, v_cust_a2, v_svc_a, v_sp_a2, v_t0, v_t0 + interval '60 minutes')) = 1
    and tests.affected(format($q$insert into public.bookings (salon_id, customer_id, service_id, specialist_id, starts_at, ends_at, price)
                             values (%L, %L, %L, %L, %L, %L, 100)$q$,
           v_salon_a, v_cust_a, v_svc_a, v_sp_a, v_t0, v_t0 + interval '60 minutes')) = 1);
  perform tests.throws('bookings: cancelled booking cannot be reopened',
    format('update public.bookings set status = %L where id = %L', 'confirmed', v_bk1), '23514');

  select id into v_bk2 from public.bookings
    where specialist_id = v_sp_a and status = 'pending' and starts_at = v_t0;
  update public.bookings set status = 'confirmed' where id = v_bk2;
  perform tests.ok('bookings: pending -> confirmed allowed',
    (select status from public.bookings where id = v_bk2) = 'confirmed');
  perform tests.throws('bookings: confirmed cannot return to pending',
    format('update public.bookings set status = %L where id = %L', 'pending', v_bk2), '23514');
  perform tests.ok('bookings: owner cannot hard-delete',
    tests.affected(format('delete from public.bookings where id = %L', v_bk2)) = 0);
  perform tests.logout();
end $$;

select id, passed, name, detail from tests.results order by id;

rollback;
