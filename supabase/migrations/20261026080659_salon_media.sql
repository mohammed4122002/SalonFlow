-- Salon media: logo, cover image and a photo gallery per salon.
-- Files live in the public Storage bucket "salon-media" under "<salon_id>/...".
-- Only the salon's managers (owner while operational, or admin) may write;
-- anyone may view (public bucket, like the salon page itself).

alter table public.salons
  add column logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,200}$'),
  add column cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,200}$');

create table public.salon_photos (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons (id) on delete cascade,
  path        text not null check (path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,200}$'),
  caption     text check (char_length(caption) <= 120),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (salon_id, path)
);
create index salon_photos_salon_idx on public.salon_photos (salon_id, sort_order, created_at);

-- Files must sit in the salon's own folder.
create or replace function private.validate_salon_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if split_part(new.path, '/', 1) <> new.salon_id::text then
    raise exception 'photo must be stored in the salon folder' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.salon_photos where salon_id = new.salon_id) >= 12 then
    raise exception 'PHOTO_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger validate_salon_photo before insert or update on public.salon_photos
  for each row execute function private.validate_salon_photo();

create or replace function private.validate_salon_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.id::text)
     or (new.cover_path is not null and split_part(new.cover_path, '/', 1) <> new.id::text) then
    raise exception 'media must be stored in the salon folder' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger validate_salon_media before insert or update of logo_path, cover_path on public.salons
  for each row execute function private.validate_salon_media();

alter table public.salon_photos enable row level security;
revoke all on public.salon_photos from anon, authenticated;
grant select on public.salon_photos to anon;
grant select, insert, update, delete on public.salon_photos to authenticated;

create policy "salon_photos: read" on public.salon_photos for select
  using (private.is_public_salon(salon_id) or private.owns_salon(salon_id) or (select private.is_super_admin()));
create policy "salon_photos: insert" on public.salon_photos for insert to authenticated
  with check (private.can_manage_salon(salon_id));
create policy "salon_photos: update" on public.salon_photos for update to authenticated
  using (private.can_manage_salon(salon_id)) with check (private.can_manage_salon(salon_id));
create policy "salon_photos: delete" on public.salon_photos for delete to authenticated
  using (private.can_manage_salon(salon_id));

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-media', 'salon-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Salon id from an object path "<salon_id>/...", or null when malformed.
create or replace function private.salon_from_media_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;
grant execute on function private.salon_from_media_path(text) to authenticated;
grant execute on function private.can_manage_salon(uuid) to authenticated;

create policy "salon-media: managers read" on storage.objects for select to authenticated
  using (bucket_id = 'salon-media' and private.can_manage_salon(private.salon_from_media_path(name)));
create policy "salon-media: managers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'salon-media' and private.can_manage_salon(private.salon_from_media_path(name)));
create policy "salon-media: managers update" on storage.objects for update to authenticated
  using (bucket_id = 'salon-media' and private.can_manage_salon(private.salon_from_media_path(name)));
create policy "salon-media: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'salon-media' and private.can_manage_salon(private.salon_from_media_path(name)));
