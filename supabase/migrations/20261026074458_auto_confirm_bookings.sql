-- Per-salon automatic confirmation of bookings.
--   auto_confirm_bookings = true  -> new bookings are created as 'confirmed';
--                                    customers may cancel them until they start.
--   auto_confirm_bookings = false -> previous behaviour: 'pending' until the
--                                    owner confirms; customers cancel pending only.
-- The anti-spam limit now counts all upcoming active bookings per phone.

alter table public.salons
  add column auto_confirm_bookings boolean not null default true;

comment on column public.salons.auto_confirm_bookings is
  'When true, bookings are confirmed immediately instead of waiting for the owner.';

-- Whether the customer (token page / bot) may still cancel this booking.
create or replace function private.customer_can_cancel(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select b.starts_at > now()
       and (b.status = 'pending' or (b.status = 'confirmed' and sa.auto_confirm_bookings))
    from public.bookings b
    join public.salons sa on sa.id = b.salon_id
    where b.id = p_booking_id
  ), false);
$$;

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
  v_auto boolean;
  v_service public.services;
  v_specialist uuid;
  v_customer uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[\s\-()]', '', 'g');
  v_booking public.bookings;
begin
  if not private.salon_is_bookable(p_salon_id) then
    raise exception 'SALON_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select timezone, auto_confirm_bookings into v_tz, v_auto from public.salons where id = p_salon_id;

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
        and b.status <> 'cancelled' and b.starts_at > now()) >= 3 then
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
      price, notes, source, channel_ref, status
    ) values (
      p_salon_id, v_customer, v_service.id, v_specialist, p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      v_service.price, nullif(trim(coalesce(p_notes, '')), ''), p_source, p_channel_ref,
      case when v_auto then 'confirmed' else 'pending' end::public.booking_status
    )
    returning * into v_booking;
  exception when exclusion_violation then
    -- Lost a race with a concurrent booking for the same slot.
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

-- Customer cancellation (token page and API). Name kept for existing callers.
create or replace function private.cancel_pending_booking(p_booking_id uuid, p_reason text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.customer_can_cancel(p_booking_id) then
    return false;
  end if;
  update public.bookings
  set status = 'cancelled', cancellation_reason = left(p_reason, 300)
  where id = p_booking_id and status <> 'cancelled' and starts_at > now();
  return found;
end;
$$;

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
    'salon', jsonb_build_object('id', sa.id, 'name', sa.name, 'slug', sa.slug, 'phone', sa.phone,
                                'address', sa.address, 'email', sa.email),
    'service', jsonb_build_object('id', sv.id, 'name', sv.name, 'duration_minutes', sv.duration_minutes),
    'specialist', jsonb_build_object('id', sp.id, 'full_name', sp.full_name),
    'customer', jsonb_build_object('full_name', c.full_name, 'phone', c.phone, 'email', c.email),
    'can_cancel', private.customer_can_cancel(b.id)
  )
  from public.bookings b
  join public.salons sa on sa.id = b.salon_id
  join public.services sv on sv.id = b.service_id
  join public.specialists sp on sp.id = b.specialist_id
  join public.customers c on c.id = b.customer_id
  where b.id = p_booking_id;
$$;

revoke all on function private.customer_can_cancel(uuid) from public, anon, authenticated;
