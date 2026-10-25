-- SalonFlow — Phase 3: booking system
--
-- Public booking goes through SECURITY DEFINER functions only: visitors never
-- get direct table access. Availability and booking share one slot generator,
-- and the bookings exclusion constraints remain the final guard against
-- double booking under concurrency.

create extension if not exists pgcrypto with schema extensions;

-- Who created the booking, and an opaque per-channel reference (e.g. a
-- Telegram chat id) so integrations can route notifications back.
alter table public.bookings
  add column source text not null default 'web' check (source in ('web', 'dashboard', 'api')),
  add column channel_ref text check (char_length(channel_ref) <= 200),
  add column public_token uuid not null default gen_random_uuid() unique;

-- ---------------------------------------------------------------------------
-- Operational = the salon may be shown publicly and accept bookings.
-- (Phase 4 extends this with subscription checks.)
-- ---------------------------------------------------------------------------
create or replace function private.salon_is_bookable(p_salon_id uuid)
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

-- ---------------------------------------------------------------------------
-- Slot generator. Times are computed in the salon's timezone.
--   * A specialist with any personal working hours uses only those; otherwise
--     the salon-wide hours apply.
--   * Slots start every 15 minutes inside a shift and must end within it.
--   * Active bookings (pending/confirmed) and time off block slots.
-- ---------------------------------------------------------------------------
create or replace function private.available_slots(
  p_salon_id uuid,
  p_service_id uuid,
  p_specialist_id uuid,
  p_date date
)
returns table (specialist_id uuid, specialist_name text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with sal as (
    select id, timezone from public.salons where id = p_salon_id
  ),
  svc as (
    select id, duration_minutes from public.services
    where id = p_service_id and salon_id = p_salon_id and is_active
  ),
  sp as (
    select s.id, s.full_name
    from public.specialists s
    join public.specialist_services ss on ss.specialist_id = s.id and ss.service_id = p_service_id
    where s.salon_id = p_salon_id and s.is_active
      and (p_specialist_id is null or s.id = p_specialist_id)
  ),
  shifts as (
    select sp.id as specialist_id, wh.start_time, wh.end_time
    from sp
    join public.working_hours wh
      on wh.salon_id = p_salon_id
     and wh.day_of_week = extract(dow from p_date)::int
     and (
       wh.specialist_id = sp.id
       or (wh.specialist_id is null
           and not exists (select 1 from public.working_hours own where own.specialist_id = sp.id))
     )
  ),
  candidates as (
    select sh.specialist_id,
           g as starts_at,
           g + make_interval(mins => svc.duration_minutes) as ends_at
    from shifts sh
    cross join svc
    cross join sal
    cross join lateral generate_series(
      (p_date + sh.start_time) at time zone sal.timezone,
      ((p_date + sh.end_time) at time zone sal.timezone) - make_interval(mins => svc.duration_minutes),
      interval '15 minutes'
    ) as g
  )
  select c.specialist_id, sp.full_name, c.starts_at, c.ends_at
  from candidates c
  join sp on sp.id = c.specialist_id
  where c.starts_at > now()
    and not exists (
      select 1 from public.bookings b
      where b.specialist_id = c.specialist_id
        and b.status <> 'cancelled'
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(c.starts_at, c.ends_at, '[)')
    )
    and not exists (
      select 1 from public.time_off t
      where t.salon_id = p_salon_id
        and (t.specialist_id is null or t.specialist_id = c.specialist_id)
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.starts_at, c.ends_at, '[)')
    )
  order by c.starts_at, sp.full_name;
$$;

-- ---------------------------------------------------------------------------
-- Core booking routine shared by the website and the integration API.
-- Errors use stable message keys the app translates:
--   SALON_UNAVAILABLE, SERVICE_UNAVAILABLE, SLOT_UNAVAILABLE, TOO_MANY_PENDING,
--   INVALID_CUSTOMER
-- ---------------------------------------------------------------------------
create or replace function private.create_booking(
  p_salon_id uuid,
  p_service_id uuid,
  p_specialist_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_source text,
  p_channel_ref text
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_service public.services;
  v_specialist uuid;
  v_customer uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s\-()]', '', 'g');
  v_booking public.bookings;
begin
  if not private.salon_is_bookable(p_salon_id) then
    raise exception 'SALON_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select timezone into v_tz from public.salons where id = p_salon_id;

  select * into v_service from public.services
  where id = p_service_id and salon_id = p_salon_id and is_active;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if char_length(trim(coalesce(p_full_name, ''))) < 2
     or v_phone !~ '^\+?[0-9]{7,20}$'
     or coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_CUSTOMER' using errcode = 'P0001';
  end if;

  -- The requested start must be one of the generated slots (this also checks
  -- working hours, time off, existing bookings and that it is in the future).
  select s.specialist_id into v_specialist
  from private.available_slots(p_salon_id, p_service_id, p_specialist_id,
                               (p_starts_at at time zone v_tz)::date) s
  where s.starts_at = p_starts_at
  order by s.specialist_name
  limit 1;
  if v_specialist is null then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if (select count(*) from public.bookings b
      join public.customers c on c.id = b.customer_id
      where b.salon_id = p_salon_id and c.phone = v_phone
        and b.status = 'pending' and b.starts_at > now()) >= 3 then
    raise exception 'TOO_MANY_PENDING' using errcode = 'P0001';
  end if;

  insert into public.customers (salon_id, full_name, phone, email)
  values (p_salon_id, trim(p_full_name), v_phone, lower(trim(p_email)))
  on conflict (salon_id, phone)
  do update set full_name = excluded.full_name, email = excluded.email
  returning id into v_customer;

  begin
    insert into public.bookings (
      salon_id, customer_id, service_id, specialist_id, starts_at, ends_at,
      price, notes, source, channel_ref
    ) values (
      p_salon_id, v_customer, v_service.id, v_specialist, p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      v_service.price, nullif(trim(coalesce(p_notes, '')), ''), p_source, p_channel_ref
    )
    returning * into v_booking;
  exception when exclusion_violation then
    -- Lost a race with a concurrent booking for the same slot.
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

-- Booking details as JSON (shared by the token page and the API).
create or replace function private.booking_json(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'price', b.price,
    'currency', sa.currency,
    'timezone', sa.timezone,
    'notes', b.notes,
    'source', b.source,
    'channel_ref', b.channel_ref,
    'cancelled_at', b.cancelled_at,
    'created_at', b.created_at,
    'salon', jsonb_build_object('id', sa.id, 'name', sa.name, 'slug', sa.slug, 'phone', sa.phone, 'address', sa.address),
    'service', jsonb_build_object('id', sv.id, 'name', sv.name, 'duration_minutes', sv.duration_minutes),
    'specialist', jsonb_build_object('id', sp.id, 'full_name', sp.full_name),
    'customer', jsonb_build_object('full_name', c.full_name, 'phone', c.phone, 'email', c.email),
    'can_cancel', b.status = 'pending' and b.starts_at > now()
  )
  from public.bookings b
  join public.salons sa on sa.id = b.salon_id
  join public.services sv on sv.id = b.service_id
  join public.specialists sp on sp.id = b.specialist_id
  join public.customers c on c.id = b.customer_id
  where b.id = p_booking_id;
$$;

-- Cancels a pending, future booking; frees the slot immediately.
create or replace function private.cancel_pending_booking(p_booking_id uuid, p_reason text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set status = 'cancelled', cancellation_reason = left(p_reason, 300)
  where id = p_booking_id and status = 'pending' and starts_at > now();
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs (website). Callable by anyone; they only expose public salons.
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_salon_id uuid,
  p_service_id uuid,
  p_specialist_id uuid,
  p_date date
)
returns table (specialist_id uuid, specialist_name text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.salon_is_bookable(p_salon_id)
     or p_date < (now() at time zone 'UTC')::date - 1
     or p_date > (now() at time zone 'UTC')::date + 90 then
    return;
  end if;
  return query select * from private.available_slots(p_salon_id, p_service_id, p_specialist_id, p_date);
end;
$$;

create or replace function public.create_booking(
  p_salon_id uuid,
  p_service_id uuid,
  p_specialist_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  v_booking := private.create_booking(p_salon_id, p_service_id, p_specialist_id, p_starts_at,
                                      p_full_name, p_phone, p_email, p_notes, 'web', null);
  return private.booking_json(v_booking.id) || jsonb_build_object('token', v_booking.public_token);
end;
$$;

-- The token is the customer's secret link to their booking.
create or replace function public.get_booking_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.booking_json(id) from public.bookings where public_token = p_token;
$$;

create or replace function public.cancel_booking_by_token(p_token uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.bookings where public_token = p_token;
  if v_id is null then
    return null;
  end if;
  perform private.cancel_pending_booking(v_id, 'ألغاه العميل');
  return private.booking_json(v_id);
end;
$$;

revoke all on function private.salon_is_bookable(uuid) from public, anon, authenticated;
revoke all on function private.available_slots(uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function private.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.booking_json(uuid) from public, anon, authenticated;
revoke all on function private.cancel_pending_booking(uuid, text) from public, anon, authenticated;

revoke all on function public.get_available_slots(uuid, uuid, uuid, date) from public;
revoke all on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, text) from public;
revoke all on function public.get_booking_by_token(uuid) from public;
revoke all on function public.cancel_booking_by_token(uuid) from public;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date) to anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(uuid) to anon, authenticated;
