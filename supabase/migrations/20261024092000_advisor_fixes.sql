-- SalonFlow — Phase 1: fixes from Supabase advisors

-- Security: pin search_path on the constructors Postgres generated for timerange.
alter function public.timerange(time, time) set search_path = '';
alter function public.timerange(time, time, text) set search_path = '';
alter function public.timemultirange() set search_path = '';
alter function public.timemultirange(public.timerange) set search_path = '';
alter function public.timemultirange(variadic public.timerange[]) set search_path = '';

-- Performance: cover the composite (x_id, salon_id) foreign keys.
drop index public.bookings_customer_id_idx;
drop index public.bookings_service_id_idx;
create index bookings_customer_id_salon_id_idx on public.bookings (customer_id, salon_id);
create index bookings_service_id_salon_id_idx on public.bookings (service_id, salon_id);
create index bookings_specialist_id_salon_id_idx on public.bookings (specialist_id, salon_id);

drop index public.specialist_services_service_id_idx;
create index specialist_services_service_id_salon_id_idx on public.specialist_services (service_id, salon_id);
create index specialist_services_specialist_id_salon_id_idx on public.specialist_services (specialist_id, salon_id);

drop index public.time_off_specialist_id_idx;
create index time_off_specialist_id_salon_id_idx on public.time_off (specialist_id, salon_id);

drop index public.working_hours_specialist_id_idx;
create index working_hours_specialist_id_salon_id_idx on public.working_hours (specialist_id, salon_id);
