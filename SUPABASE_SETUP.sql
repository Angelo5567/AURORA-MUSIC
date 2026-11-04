-- AURORA MUSIC: CONFIGURAZIONE DATABASE
-- Eseguire tutto nel Supabase SQL Editor del NUOVO progetto.

create extension if not exists pgcrypto;

create table if not exists public.tracks (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 artist text default 'Artista sconosciuto',
 file_name text not null,
 file_size bigint not null default 0,
 storage_path text not null unique,
 favorite boolean not null default false,
 added_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

drop policy if exists "Aurora owner select" on public.tracks;
drop policy if exists "Aurora owner insert" on public.tracks;
drop policy if exists "Aurora owner update" on public.tracks;
drop policy if exists "Aurora owner delete" on public.tracks;

create policy "Aurora owner select" on public.tracks
for select to authenticated
using (user_id = auth.uid() and lower(auth.jwt()->>'email') = lower('ects'));

create policy "Aurora owner insert" on public.tracks
for insert to authenticated
with check (user_id = auth.uid() and lower(auth.jwt()->>'email') = lower('ects'));

create policy "Aurora owner update" on public.tracks
for update to authenticated
using (user_id = auth.uid() and lower(auth.jwt()->>'email') = lower('ects'))
with check (user_id = auth.uid() and lower(auth.jwt()->>'email') = lower('ects'));

create policy "Aurora owner delete" on public.tracks
for delete to authenticated
using (user_id = auth.uid() and lower(auth.jwt()->>'email') = lower('ects'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aurora-private', 'aurora-private', false, 52428800, array['audio/mpeg'])
on conflict (id) do update set
 public = false,
 file_size_limit = 52428800,
 allowed_mime_types = array['audio/mpeg'];

drop policy if exists "Aurora private read" on storage.objects;
drop policy if exists "Aurora private upload" on storage.objects;
drop policy if exists "Aurora private delete" on storage.objects;

create policy "Aurora private read" on storage.objects
for select to authenticated
using (
 bucket_id = 'aurora-private'
 and (storage.foldername(name))[1] = auth.uid()::text
 and lower(auth.jwt()->>'email') = lower('ects')
);

create policy "Aurora private upload" on storage.objfor insert to authenticated
with check (
 bucket_id = 'aurora-private'
 and (storage.foldername(name))[1] = auth.uid()::text
 and lower(auth.jwt()->>'email') = lower('ects')
);

create policy "Aurora private delete" on storage.objects
for delete to authenticated
using (
 bucket_id = 'aurora-private'
 and (storage.foldername(name))[1] = auth.uid()::text
 and lower(auth.jwt()->>'email') = lower('ects')
);
