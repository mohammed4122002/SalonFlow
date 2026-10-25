-- SalonFlow — Phases 3–5 automated checks: booking, subscriptions, integration API.
-- Runs in one transaction and ROLLS BACK: no data is kept.
--   psql "$DATABASE_URL" -f supabase/tests/phase3to5_test.sql

begin;

create schema tests;
create table tests.results (id serial primary key, name text not null, passed boolean not null, detail text);
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
create function tests.ok(p_name text, p_cond boolean, p_detail text default null) returns void language sql as $$
  insert into tests.results (name, passed, detail) values (p_name, coalesce(p_cond, false), p_detail);
$$;
-- Passes when p_sql fails and its message (or SQLSTATE) contains p_expect.
create function tests.throws(p_name text, p_sql text, p_expect text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform tests.ok(p_name, sqlstate = p_expect or position(p_expect in sqlerrm) > 0, sqlstate || ': ' || sqlerrm);
    return;
  end;
  perform tests.ok(p_name, false, 'statement succeeded but should have failed');
end $$;
create function tests.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_salon uuid; v_salon_b uuid;
  v_cut uuid; v_color uuid; v_svc_b uuid;
  v_sara uuid; v_huda uuid; v_sp_b uuid;
  v_day date := current_date + 7;
  v_t timestamptz;
  v_res jsonb; v_res2 jsonb;
  v_token uuid;
  v_key text; v_key_b text;
  v_n int;
  v_booking uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_admin, 'admin@t.local', '{}'), (v_a, 'a@t.local', '{}'), (v_b, 'b@t.local', '{}');
  update public.profiles set role = 'super_admin' where id = v_admin;

  -- Salon A (UTC, open every day 09:00–17:00), Sara personal hours 12:00–14:00.
  insert into public.salons (owner_id, slug, name, timezone, currency, is_published)
    values (v_a, 'test-salon-a', 'Salon A', 'UTC', 'EUR', true) returning id into v_salon;
  insert into public.services (salon_id, name, duration_minutes, price) values (v_salon, 'Cut', 60, 20) returning id into v_cut;
  insert into public.services (salon_id, name, duration_minutes, price) values (v_salon, 'Color', 120, 50) returning id into v_color;
  insert into public.specialists (salon_id, full_name) values (v_salon, 'Sara') returning id into v_sara;
  insert into public.specialists (salon_id, full_name) values (v_salon, 'Huda') returning id into v_huda;
  insert into public.specialist_services values (v_salon, v_sara, v_cut), (v_salon, v_huda, v_cut), (v_salon, v_huda, v_color);
  insert into public.working_hours (salon_id, day_of_week, start_time, end_time)
    select v_salon, d, '09:00', '17:00' from generate_series(0, 6) d;
  insert into public.working_hours (salon_id, specialist_id, day_of_week, start_time, end_time)
    select v_salon, v_sara, d, '12:00', '14:00' from generate_series(0, 6) d;

  insert into public.salons (owner_id, slug, name, timezone, currency, is_published)
    values (v_b, 'test-salon-b', 'Salon B', 'UTC', 'EUR', true) returning id into v_salon_b;
  insert into public.services (salon_id, name, duration_minutes, price) values (v_salon_b, 'Nails', 30, 10) returning id into v_svc_b;
  insert into public.specialists (salon_id, full_name) values (v_salon_b, 'Mona') returning id into v_sp_b;
  insert into public.specialist_services values (v_salon_b, v_sp_b, v_svc_b);
  insert into public.working_hours (salon_id, day_of_week, start_time, end_time)
    select v_salon_b, d, '09:00', '17:00' from generate_series(0, 6) d;

  -- ===================== Phase 3: availability & booking (as anon) =========
  perform tests.login_anon();
  select count(*) into v_n from public.get_available_slots(v_salon, v_cut, v_huda, v_day);
  perform tests.ok('slots: Huda (salon hours 09-17, 60 min, 15 min step) = 29', v_n = 29, v_n::text);
  select count(*) into v_n from public.get_available_slots(v_salon, v_cut, v_sara, v_day);
  perform tests.ok('slots: Sara uses her own hours 12-14 = 5', v_n = 5, v_n::text);
  select count(*) into v_n from public.get_available_slots(v_salon, v_color, v_sara, v_day);
  perform tests.ok('slots: specialist without the service has none', v_n = 0);
  select count(*) into v_n from public.get_available_slots(v_salon, v_cut, null, v_day);
  perform tests.ok('slots: any specialist = union (34)', v_n = 34, v_n::text);
  select count(*) into v_n from public.get_available_slots(v_salon, v_cut, v_huda, current_date - 3);
  perform tests.ok('slots: none in the past', v_n = 0);

  v_t := (v_day + time '10:00') at time zone 'UTC';
  v_res := public.create_booking(v_salon, v_cut, v_huda, v_t, 'Customer One', '+970 59 000 0001', 'one@t.local', 'note');
  v_token := (v_res ->> 'token')::uuid;
  perform tests.ok('booking: created as pending with token', v_res ->> 'status' = 'pending' and v_token is not null, v_res::text);
  perform tests.ok('booking: price & end time from service',
    (v_res ->> 'price')::numeric = 20 and (v_res ->> 'ends_at')::timestamptz = v_t + interval '60 minutes');
  perform tests.ok('booking: phone normalized', v_res -> 'customer' ->> 'phone' = '+970590000001');

  perform tests.throws('booking: same slot again rejected',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Other', '+970590000002', 'o@t.local')$q$, v_salon, v_cut, v_huda, v_t),
    'SLOT_UNAVAILABLE');
  perform tests.throws('booking: overlapping slot rejected',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Other', '+970590000002', 'o@t.local')$q$,
           v_salon, v_cut, v_huda, v_t + interval '30 minutes'), 'SLOT_UNAVAILABLE');
  perform tests.throws('booking: outside working hours rejected',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Other', '+970590000002', 'o@t.local')$q$,
           v_salon, v_cut, v_huda, (v_day + time '18:00') at time zone 'UTC'), 'SLOT_UNAVAILABLE');
  perform tests.throws('booking: off-grid time rejected',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Other', '+970590000002', 'o@t.local')$q$,
           v_salon, v_cut, v_huda, (v_day + time '11:07') at time zone 'UTC'), 'SLOT_UNAVAILABLE');
  perform tests.throws('booking: email required',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Other', '+970590000002', '')$q$,
           v_salon, v_cut, v_huda, (v_day + time '15:00') at time zone 'UTC'), 'INVALID_CUSTOMER');
  perform tests.throws('booking: phone required',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Other', 'abc', 'o@t.local')$q$,
           v_salon, v_cut, v_huda, (v_day + time '15:00') at time zone 'UTC'), 'INVALID_CUSTOMER');

  select count(*) into v_n from public.get_available_slots(v_salon, v_cut, v_huda, v_day);
  perform tests.ok('slots: booked hour removed (29 - 7 overlapping starts = 22)', v_n = 22, v_n::text);

  -- "any specialist" picks a free one
  perform tests.throws('booking: any-specialist with nobody free rejected',
    format($q$select public.create_booking(%L, %L, null, %L, 'Customer Two', '+970590000002', 'two@t.local')$q$, v_salon, v_cut, v_t),
    'SLOT_UNAVAILABLE');
  v_res2 := public.create_booking(v_salon, v_cut, null, (v_day + time '12:00') at time zone 'UTC',
                                  'Customer Two', '+970590000002', 'two@t.local');
  perform tests.ok('booking: any-specialist assigns a free specialist', v_res2 -> 'specialist' ->> 'full_name' = 'Huda',
    v_res2 -> 'specialist' ->> 'full_name');

  -- pending limit (3 per phone)
  perform public.create_booking(v_salon, v_cut, v_huda, (v_day + time '13:00') at time zone 'UTC', 'Customer One', '+970590000001', 'one@t.local');
  perform public.create_booking(v_salon, v_cut, v_huda, (v_day + time '15:00') at time zone 'UTC', 'Customer One', '+970590000001', 'one@t.local');
  perform tests.throws('booking: max 3 pending per phone',
    format($q$select public.create_booking(%L, %L, %L, %L, 'Customer One', '+970590000001', 'one@t.local')$q$,
           v_salon, v_cut, v_huda, (v_day + time '16:00') at time zone 'UTC'), 'TOO_MANY_PENDING');

  perform tests.throws('security: anon still cannot read bookings', 'select * from public.bookings', '42501');
  perform tests.ok('token: details readable with token', (public.get_booking_by_token(v_token)) ->> 'status' = 'pending');
  perform tests.ok('token: unknown token returns nothing', public.get_booking_by_token(gen_random_uuid()) is null);

  v_res := public.cancel_booking_by_token(v_token);
  perform tests.ok('cancel: customer cancels pending booking', v_res ->> 'status' = 'cancelled');
  select count(*) into v_n from public.get_available_slots(v_salon, v_cut, v_huda, v_day);
  perform tests.ok('cancel: slot freed immediately', exists (
    select 1 from public.get_available_slots(v_salon, v_cut, v_huda, v_day) where starts_at = v_t));
  perform tests.ok('cancel: re-cancel is a no-op', (public.cancel_booking_by_token(v_token)) ->> 'status' = 'cancelled');
  perform tests.logout();

  -- time off blocks slots
  insert into public.time_off (salon_id, specialist_id, starts_at, ends_at)
    values (v_salon, v_huda, (v_day + time '09:00') at time zone 'UTC', (v_day + time '12:00') at time zone 'UTC');
  perform tests.login_anon();
  perform tests.ok('time off: blocked slots removed', not exists (
    select 1 from public.get_available_slots(v_salon, v_cut, v_huda, v_day)
    where starts_at < (v_day + time '12:00') at time zone 'UTC'));
  perform tests.logout();

  -- owner confirms; confirmed booking cannot be cancelled by customer token
  perform tests.login(v_a);
  select id into v_booking from public.bookings where salon_id = v_salon and status = 'pending' order by starts_at limit 1;
  update public.bookings set status = 'confirmed' where id = v_booking;
  perform tests.ok('owner: confirms booking', (select status from public.bookings where id = v_booking) = 'confirmed');
  perform tests.logout();
  select public_token into v_token from public.bookings where id = v_booking;
  perform tests.login_anon();
  perform tests.ok('cancel: confirmed booking not cancellable by customer',
    (public.cancel_booking_by_token(v_token)) ->> 'status' = 'confirmed');
  perform tests.logout();

  -- unpublished salon: no slots, no bookings
  update public.salons set is_published = false where id = v_salon_b;
  perform tests.login_anon();
  select count(*) into v_n from public.get_available_slots(v_salon_b, v_svc_b, null, v_day);
  perform tests.ok('unpublished: no slots', v_n = 0);
  perform tests.throws('unpublished: booking rejected',
    format($q$select public.create_booking(%L, %L, null, %L, 'X Y', '+970590000009', 'x@t.local')$q$,
           v_salon_b, v_svc_b, (v_day + time '10:00') at time zone 'UTC'), 'SALON_UNAVAILABLE');
  perform tests.logout();
  update public.salons set is_published = true where id = v_salon_b;

  -- ===================== Phase 4: subscriptions =============================
  update public.subscriptions set trial_ends_at = now() - interval '1 minute', trial_starts_at = now() - interval '31 days'
    where salon_id = v_salon_b;
  perform tests.login_anon();
  perform tests.ok('expired trial: salon hidden from public', not exists (select 1 from public.salons where id = v_salon_b));
  perform tests.ok('expired trial: services hidden from public', not exists (select 1 from public.services where salon_id = v_salon_b));
  perform tests.throws('expired trial: booking rejected',
    format($q$select public.create_booking(%L, %L, null, %L, 'X Y', '+970590000009', 'x@t.local')$q$,
           v_salon_b, v_svc_b, (v_day + time '10:00') at time zone 'UTC'), 'SALON_UNAVAILABLE');
  perform tests.logout();

  perform tests.login(v_b);
  perform tests.ok('expired trial: owner still reads own salon', exists (select 1 from public.salons where id = v_salon_b));
  perform tests.throws('expired trial: owner cannot add services',
    format($q$insert into public.services (salon_id, name, duration_minutes, price) values (%L, 'New', 30, 5)$q$, v_salon_b), '42501');
  perform tests.ok('expired trial: owner cannot edit salon',
    tests.affected(format($q$update public.salons set name = 'Changed' where id = %L$q$, v_salon_b)) = 0);
  perform tests.ok('expired trial: owner cannot extend own trial',
    tests.affected(format($q$update public.subscriptions set trial_ends_at = now() + interval '1 year' where salon_id = %L$q$, v_salon_b)) = 0);
  perform tests.logout();

  perform private.expire_subscriptions();
  perform tests.ok('expiry job: status recorded as suspended',
    (select status from public.subscriptions where salon_id = v_salon_b) = 'suspended');
  perform tests.ok('expiry job: valid trial untouched',
    (select status from public.subscriptions where salon_id = v_salon) = 'trialing');

  perform tests.login(v_admin);
  perform tests.ok('admin: activates paid period',
    tests.affected(format($q$update public.subscriptions set status = 'active', plan = 'standard',
      current_period_start = now(), current_period_end = now() + interval '30 days' where salon_id = %L$q$, v_salon_b)) = 1);
  perform tests.logout();
  perform tests.ok('subscription change logged',
    exists (select 1 from public.subscription_events where salon_id = v_salon_b and details -> 'to' ->> 'status' = 'active'));
  perform tests.login_anon();
  perform tests.ok('active subscription: salon public again', exists (select 1 from public.salons where id = v_salon_b));
  perform tests.logout();

  -- owner of a suspended salon may still cancel bookings
  perform tests.login_anon();
  v_res := public.create_booking(v_salon_b, v_svc_b, null, (v_day + time '10:00') at time zone 'UTC', 'X Y', '+970590000009', 'x@t.local');
  perform tests.logout();
  update public.subscriptions set status = 'suspended' where salon_id = v_salon_b;
  perform tests.login(v_b);
  perform tests.throws('suspended: owner cannot confirm',
    format($q$update public.bookings set status = 'confirmed' where id = %L$q$, v_res ->> 'id'), '42501');
  perform tests.ok('suspended: owner can cancel',
    tests.affected(format($q$update public.bookings set status = 'cancelled' where id = %L$q$, v_res ->> 'id')) = 1);
  perform tests.logout();
  update public.subscriptions set status = 'active', current_period_end = now() + interval '30 days' where salon_id = v_salon_b;

  -- ===================== Phase 5: integration API ===========================
  perform tests.login(v_a);
  v_key := public.rotate_integration_key(v_salon);
  perform tests.ok('api key: generated with prefix', v_key ~ '^sf_live_[0-9a-f]{48}$');
  perform tests.ok('api key: only prefix visible to owner',
    (select api_key_prefix from public.salon_integrations where salon_id = v_salon) = left(v_key, 14));
  perform tests.throws('api key: hash not readable', 'select api_key_hash from public.salon_integrations', '42501');
  perform tests.throws('api key: owner B cannot rotate A''s key',
    format('select public.rotate_integration_key(%L)', v_salon_b), '42501');
  perform tests.logout();
  perform tests.login(v_b);
  perform tests.throws('api key: owner B cannot rotate A''s key (as B)',
    format('select public.rotate_integration_key(%L)', v_salon), '42501');
  v_key_b := public.rotate_integration_key(v_salon_b);
  perform tests.ok('integration: B cannot read A''s settings',
    not exists (select 1 from public.salon_integrations where salon_id = v_salon));
  perform tests.logout();

  perform tests.login_anon();
  perform tests.throws('api: bad key rejected', $q$select public.api_services('sf_live_' || repeat('0', 48))$q$, 'UNAUTHORIZED');
  perform tests.throws('api: malformed key rejected', $q$select public.api_services('nope')$q$, 'UNAUTHORIZED');
  perform tests.ok('api: services of own salon only',
    jsonb_array_length(public.api_services(v_key)) = 2 and public.api_services(v_key)::text not like '%Nails%');
  perform tests.ok('api: salon info', (public.api_salon_info(v_key)) ->> 'name' = 'Salon A');
  perform tests.ok('api: specialists filtered by service',
    jsonb_array_length(public.api_specialists(v_key, v_color)) = 1);
  perform tests.ok('api: availability',
    jsonb_array_length(public.api_availability(v_key, v_cut, v_day, v_sara)) > 0);
  perform tests.throws('api: availability date range enforced',
    format('select public.api_availability(%L, %L, %L)', v_key, v_cut, current_date + 400), 'INVALID_DATE');

  v_t := (v_day + time '12:00') at time zone 'UTC';
  v_res := public.api_create_booking(v_key, v_cut, v_sara, v_t, 'Bot User', '+970591111111', 'bot@t.local',
                                     null, 'tg:12345', 'idem-key-0001');
  perform tests.ok('api: booking created (source api, channel ref kept)',
    v_res ->> 'status' = 'pending' and v_res ->> 'source' = 'api' and v_res ->> 'channel_ref' = 'tg:12345');
  v_res2 := public.api_create_booking(v_key, v_cut, v_sara, v_t, 'Bot User', '+970591111111', 'bot@t.local',
                                      null, 'tg:12345', 'idem-key-0001');
  perform tests.ok('api: same idempotency key returns the same booking',
    v_res2 ->> 'id' = v_res ->> 'id' and (v_res2 ->> 'idempotent_replay')::boolean);
  perform tests.throws('api: different key for same slot rejected',
    format($q$select public.api_create_booking(%L, %L, %L, %L, 'Bot2', '+970591111112', 'b2@t.local', null, null, 'idem-key-0002')$q$,
           v_key, v_cut, v_sara, v_t), 'SLOT_UNAVAILABLE');
  perform tests.throws('api: cannot book another salon''s service',
    format($q$select public.api_create_booking(%L, %L, null, %L, 'Bot3', '+970591111113', 'b3@t.local')$q$,
           v_key, v_svc_b, (v_day + time '10:00') at time zone 'UTC'), 'SERVICE_UNAVAILABLE');
  perform tests.ok('api: get own booking', (public.api_get_booking(v_key, (v_res ->> 'id')::uuid)) ->> 'id' = v_res ->> 'id');
  perform tests.throws('api: salon B key cannot read A''s booking',
    format('select public.api_get_booking(%L, %L)', v_key_b, v_res ->> 'id'), 'NOT_FOUND');
  perform tests.throws('api: salon B key cannot cancel A''s booking',
    format('select public.api_cancel_booking(%L, %L)', v_key_b, v_res ->> 'id'), 'NOT_FOUND');
  perform tests.ok('api: cancel pending booking', (public.api_cancel_booking(v_key, (v_res ->> 'id')::uuid)) ->> 'status' = 'cancelled');
  perform tests.throws('api: cancelled booking not cancellable again',
    format('select public.api_cancel_booking(%L, %L)', v_key, v_res ->> 'id'), 'NOT_CANCELLABLE');
  perform tests.throws('security: anon cannot read integrations', 'select * from public.salon_integrations', '42501');
  perform tests.throws('security: anon cannot read idempotency table', 'select * from public.booking_requests', '42501');
  perform tests.logout();

  perform tests.ok('api: last_used_at recorded',
    (select last_used_at from public.salon_integrations where salon_id = v_salon) is not null);

  -- disabling the integration or suspending the salon blocks the key
  perform tests.login(v_a);
  update public.salon_integrations set enabled = false where salon_id = v_salon;
  perform tests.logout();
  perform tests.login_anon();
  perform tests.throws('api: disabled integration rejects key', format('select public.api_services(%L)', v_key), 'UNAUTHORIZED');
  perform tests.logout();
  update public.salon_integrations set enabled = true where salon_id = v_salon;
  update public.subscriptions set trial_ends_at = now() - interval '1 minute', trial_starts_at = now() - interval '31 days'
    where salon_id = v_salon;
  perform tests.login_anon();
  perform tests.throws('api: expired subscription blocks API', format('select public.api_services(%L)', v_key), 'SALON_UNAVAILABLE');
  perform tests.logout();

  -- key rotation invalidates the old key
  update public.subscriptions set trial_ends_at = now() + interval '10 days' where salon_id = v_salon;
  perform tests.login(v_a);
  perform public.rotate_integration_key(v_salon);
  perform tests.logout();
  perform tests.login_anon();
  perform tests.throws('api: rotated key no longer works', format('select public.api_services(%L)', v_key), 'UNAUTHORIZED');
  perform tests.logout();
end $$;

select id, passed, name, detail from tests.results order by id;

rollback;
