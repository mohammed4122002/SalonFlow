-- SalonFlow — Phase 1: core schema (tables, types, constraints)

create extension if not exists btree_gist with schema extensions;

-- Internal helpers live here; this schema is not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'salon_owner');
create type public.salon_status as enum ('active', 'suspended');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

-- Time-of-day range, used to prevent overlapping working-hour slots.
create type public.timerange as range (subtype = time);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  role        public.app_role not null default 'salon_owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Salons (tenants)
-- ---------------------------------------------------------------------------
create table public.salons (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id),
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name          text not null check (char_length(name) between 2 and 120),
  description   text check (char_length(description) <= 2000),
  phone         text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  email         text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address       text check (char_length(address) <= 300),
  city          text check (char_length(city) <= 80),
  logo_url      text,
  timezone      text not null,            -- IANA name, validated by trigger
  currency      char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status        public.salon_status not null default 'active',
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index salons_owner_id_idx on public.salons (owner_id);

-- ---------------------------------------------------------------------------
-- Catalogue: services & specialists
-- (id, salon_id) unique keys let child tables enforce same-salon references.
-- ---------------------------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references public.salons (id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 120),
  description       text check (char_length(description) <= 1000),
  duration_minutes  integer not null check (duration_minutes between 5 and 600),
  price             numeric(10, 2) not null check (price >= 0),
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, salon_id)
);
create index services_salon_id_idx on public.services (salon_id);

create table public.specialists (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  bio         text check (char_length(bio) <= 1000),
  avatar_url  text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, salon_id)
);
create index specialists_salon_id_idx on public.specialists (salon_id);

-- Which specialist performs which service.
create table public.specialist_services (
  salon_id       uuid not null references public.salons (id) on delete cascade,
  specialist_id  uuid not null,
  service_id     uuid not null,
  primary key (specialist_id, service_id),
  foreign key (specialist_id, salon_id) references public.specialists (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);
create index specialist_services_salon_id_idx on public.specialist_services (salon_id);
create index specialist_services_service_id_idx on public.specialist_services (service_id);

-- ---------------------------------------------------------------------------
-- Availability: weekly working hours & time off
-- specialist_id NULL = applies to the whole salon.
-- day_of_week: 0 = Sunday … 6 = Saturday. Times are in the salon's timezone.
-- ---------------------------------------------------------------------------
create table public.working_hours (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references public.salons (id) on delete cascade,
  specialist_id  uuid,
  day_of_week    smallint not null check (day_of_week between 0 and 6),
  start_time     time not null,
  end_time       time not null,
  created_at     timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (specialist_id, salon_id) references public.specialists (id, salon_id) on delete cascade,
  constraint working_hours_no_overlap exclude using gist (
    salon_id with =,
    (coalesce(specialist_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    day_of_week with =,
    (public.timerange(start_time, end_time)) with &&
  )
);
create index working_hours_specialist_id_idx on public.working_hours (specialist_id);

create table public.time_off (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references public.salons (id) on delete cascade,
  specialist_id  uuid,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  reason         text check (char_length(reason) <= 300),
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (specialist_id, salon_id) references public.specialists (id, salon_id) on delete cascade
);
create index time_off_salon_id_starts_at_idx on public.time_off (salon_id, starts_at);
create index time_off_specialist_id_idx on public.time_off (specialist_id);

-- ---------------------------------------------------------------------------
-- Customers (per salon; customers do not need an account)
-- ---------------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons (id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  phone       text not null check (phone ~ '^\+?[0-9 ]{7,20}$'),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (salon_id, phone),
  unique (id, salon_id)
);

-- ---------------------------------------------------------------------------
-- Bookings
-- The exclusion constraints are the source of truth against double booking:
-- they are enforced atomically by Postgres, including for concurrent inserts.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  salon_id             uuid not null references public.salons (id) on delete cascade,
  customer_id          uuid not null,
  service_id           uuid not null,
  specialist_id        uuid not null,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  status               public.booking_status not null default 'pending',
  price                numeric(10, 2) not null check (price >= 0),
  notes                text check (char_length(notes) <= 1000),
  status_changed_at    timestamptz not null default now(),
  cancelled_at         timestamptz,
  cancellation_reason  text check (char_length(cancellation_reason) <= 300),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  foreign key (customer_id, salon_id) references public.customers (id, salon_id),
  foreign key (service_id, salon_id) references public.services (id, salon_id),
  foreign key (specialist_id, salon_id) references public.specialists (id, salon_id),
  constraint bookings_no_specialist_overlap exclude using gist (
    specialist_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled'),
  constraint bookings_no_customer_overlap exclude using gist (
    customer_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index bookings_salon_id_starts_at_idx on public.bookings (salon_id, starts_at);
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_service_id_idx on public.bookings (service_id);

-- ---------------------------------------------------------------------------
-- Subscriptions (one per salon). Payment-provider columns are placeholders
-- for a future integration; nothing writes to them yet.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  salon_id                  uuid not null unique references public.salons (id) on delete cascade,
  plan                      text not null default 'trial',
  status                    public.subscription_status not null default 'trialing',
  trial_starts_at           timestamptz not null default now(),
  trial_ends_at             timestamptz not null default now() + interval '30 days',
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  payment_provider          text,
  provider_customer_id      text,
  provider_subscription_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (trial_ends_at > trial_starts_at)
);
