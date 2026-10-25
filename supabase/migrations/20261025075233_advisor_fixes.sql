-- SalonFlow — Phase 1: fixes from Supabase advisors (non-destructive)
--
-- Note: the advisor also flags a mutable search_path on public.timerange /
-- public.timemultirange. Those are the constructors Postgres auto-generates
-- for the range type; they are owned by a system role (ALTER is refused) and
-- read no tables, so the warning is accepted.

-- Performance: cover the composite (x_id, salon_id) foreign keys.
create index if not exists bookings_customer_id_salon_id_idx on public.bookings (customer_id, salon_id);
create index if not exists bookings_service_id_salon_id_idx on public.bookings (service_id, salon_id);
create index if not exists bookings_specialist_id_salon_id_idx on public.bookings (specialist_id, salon_id);
create index if not exists specialist_services_service_id_salon_id_idx on public.specialist_services (service_id, salon_id);
create index if not exists specialist_services_specialist_id_salon_id_idx on public.specialist_services (specialist_id, salon_id);
create index if not exists time_off_specialist_id_salon_id_idx on public.time_off (specialist_id, salon_id);
create index if not exists working_hours_specialist_id_salon_id_idx on public.working_hours (specialist_id, salon_id);
