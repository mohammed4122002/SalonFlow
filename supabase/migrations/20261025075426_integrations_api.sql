-- SalonFlow — Phase 5: per-salon integration settings and the API used by n8n
--
-- * Each salon has its own API key. Only a SHA-256 hash and a short prefix
--   are stored; the plaintext is shown once to the owner when generated.
-- * The HTTP API (Next.js route handlers) passes the key to the api_*
--   functions below. Every function resolves the salon from the key, so a
--   key can only ever read or book within its own salon.
-- * Outbound notifications (booking confirmed / cancelled) are POSTed to the
--   salon's own n8n webhook URL and signed with its own secret.

create table public.salon_integrations (
  salon_id             uuid primary key references public.salons (id) on delete cascade,
  enabled              boolean not null default true,
  api_key_hash         text unique,
  api_key_prefix       text,
  api_key_created_at   timestamptz,
  last_used_at         timestamptz,
  webhook_url          text check (webhook_url is null or webhook_url ~ '^https://'),
  webhook_secret       text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  last_webhook_at      timestamptz,
  last_webhook_status  text check (char_length(last_webhook_status) <= 200),
  telegram_bot_username text check (telegram_bot_username is null or telegram_bot_username ~ '^[A-Za-z0-9_]{5,64}$'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger set_updated_at before update on public.salon_integrations
  for each row execute function private.set_updated_at();

alter table public.salon_integrations enable row level security;
-- New tables get broad default grants on Supabase; start from nothing.
-- The key hash is never readable, and keys/secrets change only via RPCs.
revoke all on public.salon_integrations from anon, authenticated;
grant select (salon_id, enabled, api_key_prefix, api_key_created_at, last_used_at, webhook_url,
              webhook_secret, last_webhook_at, last_webhook_status, telegram_bot_username,
              created_at, updated_at)
  on public.salon_integrations to authenticated;
grant insert (salon_id, enabled, webhook_url, telegram_bot_username) on public.salon_integrations to authenticated;
grant update (enabled, webhook_url, telegram_bot_username, last_webhook_at, last_webhook_status)
  on public.salon_integrations to authenticated;

create policy "salon_integrations: read" on public.salon_integrations
  for select to authenticated
  using (private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "salon_integrations: insert" on public.salon_integrations
  for insert to authenticated
  with check (private.can_manage_salon(salon_id));
create policy "salon_integrations: update" on public.salon_integrations
  for update to authenticated
  using (private.can_manage_salon(salon_id))
  with check (private.can_manage_salon(salon_id));

-- Idempotency for API booking requests (retries never create duplicates).
create table public.booking_requests (
  salon_id          uuid not null references public.salons (id) on delete cascade,
  idempotency_key   text not null check (char_length(idempotency_key) between 8 and 120),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (salon_id, idempotency_key)
);
create index booking_requests_booking_id_idx on public.booking_requests (booking_id);
alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from anon, authenticated;
-- No policies: only SECURITY DEFINER functions touch this table.

-- ---------------------------------------------------------------------------
-- Key management (owner, via the dashboard)
-- ---------------------------------------------------------------------------
create or replace function public.rotate_integration_key(p_salon_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text := 'sf_live_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.can_manage_salon(p_salon_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.salon_integrations (salon_id, api_key_hash, api_key_prefix, api_key_created_at)
  values (p_salon_id, encode(extensions.digest(v_key, 'sha256'), 'hex'), left(v_key, 14), now())
  on conflict (salon_id) do update
    set api_key_hash = excluded.api_key_hash,
        api_key_prefix = excluded.api_key_prefix,
        api_key_created_at = excluded.api_key_created_at,
        last_used_at = null;
  return v_key;  -- shown once; only the hash is stored
end;
$$;

create or replace function public.rotate_webhook_secret(p_salon_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_salon(p_salon_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.salon_integrations (salon_id) values (p_salon_id) on conflict (salon_id) do nothing;
  update public.salon_integrations
  set webhook_secret = encode(extensions.gen_random_bytes(24), 'hex')
  where salon_id = p_salon_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- API key → salon. Errors: UNAUTHORIZED (bad / disabled key),
-- SALON_UNAVAILABLE (salon suspended, unpublished or subscription expired).
-- ---------------------------------------------------------------------------
create or replace function private.api_salon(p_api_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid;
begin
  if p_api_key is null or p_api_key !~ '^sf_live_[0-9a-f]{48}$' then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  update public.salon_integrations
  set last_used_at = now()
  where api_key_hash = encode(extensions.digest(p_api_key, 'sha256'), 'hex') and enabled
  returning salon_id into v_salon;
  if v_salon is null then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
  if not private.salon_is_bookable(v_salon) then
    raise exception 'SALON_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return v_salon;
end;
$$;

create or replace function public.api_salon_info(p_api_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
begin
  return (
    select jsonb_build_object(
      'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
      'city', s.city, 'address', s.address, 'phone', s.phone, 'email', s.email,
      'timezone', s.timezone, 'currency', s.currency,
      'working_hours', coalesce((
        select jsonb_agg(jsonb_build_object('day_of_week', w.day_of_week,
                         'start_time', to_char(w.start_time, 'HH24:MI'), 'end_time', to_char(w.end_time, 'HH24:MI'))
                         order by w.day_of_week, w.start_time)
        from public.working_hours w where w.salon_id = s.id and w.specialist_id is null), '[]'::jsonb)
    )
    from public.salons s where s.id = v_salon
  );
end;
$$;

create or replace function public.api_services(p_api_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sv.id, 'name', sv.name, 'description', sv.description,
      'duration_minutes', sv.duration_minutes, 'price', sv.price, 'currency', sa.currency)
      order by sv.sort_order, sv.name)
    from public.services sv join public.salons sa on sa.id = sv.salon_id
    where sv.salon_id = v_salon and sv.is_active), '[]'::jsonb);
end;
$$;

create or replace function public.api_specialists(p_api_key text, p_service_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sp.id, 'full_name', sp.full_name, 'bio', sp.bio,
      'service_ids', coalesce((select jsonb_agg(ss.service_id) from public.specialist_services ss
                               where ss.specialist_id = sp.id), '[]'::jsonb))
      order by sp.sort_order, sp.full_name)
    from public.specialists sp
    where sp.salon_id = v_salon and sp.is_active
      and (p_service_id is null or exists (
        select 1 from public.specialist_services ss
        where ss.specialist_id = sp.id and ss.service_id = p_service_id))), '[]'::jsonb);
end;
$$;

create or replace function public.api_availability(
  p_api_key text, p_service_id uuid, p_date date, p_specialist_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
begin
  if p_date is null or p_date < current_date - 1 or p_date > current_date + 90 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'specialist_id', a.specialist_id, 'specialist_name', a.specialist_name,
      'starts_at', a.starts_at, 'ends_at', a.ends_at,
      'local_time', to_char(a.starts_at at time zone s.timezone, 'HH24:MI'))
      order by a.starts_at, a.specialist_name)
    from private.available_slots(v_salon, p_service_id, p_specialist_id, p_date) a
    cross join public.salons s
    where s.id = v_salon), '[]'::jsonb);
end;
$$;

create or replace function public.api_create_booking(
  p_api_key text,
  p_service_id uuid,
  p_specialist_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_notes text default null,
  p_channel_ref text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
  v_existing uuid;
  v_booking public.bookings;
begin
  if p_idempotency_key is not null then
    -- Serialize retries that carry the same key.
    perform pg_advisory_xact_lock(hashtext(v_salon::text || ':' || p_idempotency_key));
    select booking_id into v_existing from public.booking_requests
    where salon_id = v_salon and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return private.booking_json(v_existing) || jsonb_build_object('idempotent_replay', true);
    end if;
  end if;

  v_booking := private.create_booking(v_salon, p_service_id, p_specialist_id, p_starts_at,
                                      p_full_name, p_phone, p_email, p_notes, 'api', p_channel_ref);

  if p_idempotency_key is not null then
    insert into public.booking_requests (salon_id, idempotency_key, booking_id)
    values (v_salon, p_idempotency_key, v_booking.id);
  end if;

  return private.booking_json(v_booking.id) || jsonb_build_object('idempotent_replay', false);
end;
$$;

create or replace function public.api_get_booking(p_api_key text, p_booking_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
begin
  if not exists (select 1 from public.bookings where id = p_booking_id and salon_id = v_salon) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return private.booking_json(p_booking_id);
end;
$$;

create or replace function public.api_cancel_booking(p_api_key text, p_booking_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_salon uuid := private.api_salon(p_api_key);
begin
  if not exists (select 1 from public.bookings where id = p_booking_id and salon_id = v_salon) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.cancel_pending_booking(p_booking_id, 'ألغاه العميل عبر البوت') then
    raise exception 'NOT_CANCELLABLE' using errcode = 'P0001';
  end if;
  return private.booking_json(p_booking_id);
end;
$$;

revoke all on function private.api_salon(text) from public, anon, authenticated;
revoke all on function public.rotate_integration_key(uuid) from public, anon;
revoke all on function public.rotate_webhook_secret(uuid) from public, anon;
grant execute on function public.rotate_integration_key(uuid) to authenticated;
grant execute on function public.rotate_webhook_secret(uuid) to authenticated;

revoke all on function public.api_salon_info(text) from public;
revoke all on function public.api_services(text) from public;
revoke all on function public.api_specialists(text, uuid) from public;
revoke all on function public.api_availability(text, uuid, date, uuid) from public;
revoke all on function public.api_create_booking(text, uuid, uuid, timestamptz, text, text, text, text, text, text) from public;
revoke all on function public.api_get_booking(text, uuid) from public;
revoke all on function public.api_cancel_booking(text, uuid) from public;
grant execute on function public.api_salon_info(text) to anon;
grant execute on function public.api_services(text) to anon;
grant execute on function public.api_specialists(text, uuid) to anon;
grant execute on function public.api_availability(text, uuid, date, uuid) to anon;
grant execute on function public.api_create_booking(text, uuid, uuid, timestamptz, text, text, text, text, text, text) to anon;
grant execute on function public.api_get_booking(text, uuid) to anon;
grant execute on function public.api_cancel_booking(text, uuid) to anon;
