-- Include the salon's contact email in booking details so notifications for
-- bookings created through the API can reach the salon. (Public on the salon
-- page already.)
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
    'can_cancel', b.status = 'pending' and b.starts_at > now()
  )
  from public.bookings b
  join public.salons sa on sa.id = b.salon_id
  join public.services sv on sv.id = b.service_id
  join public.specialists sp on sp.id = b.specialist_id
  join public.customers c on c.id = b.customer_id
  where b.id = p_booking_id;
$$;
