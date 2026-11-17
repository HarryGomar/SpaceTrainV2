create table public.art_atlas_account_saves (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('galleries', 'collection', 'study')),
  snapshot jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (owner_id, kind),
  check ((
    jsonb_typeof(snapshot) = 'object'
    and snapshot ->> 'format' = 'art-atlas-account-save-v1'
    and snapshot ->> 'kind' = kind
    and jsonb_typeof(snapshot -> 'value') = 'object'
  ) is true)
);

alter table public.art_atlas_account_saves enable row level security;
revoke all on public.art_atlas_account_saves from public, anon, authenticated;
grant select, delete on public.art_atlas_account_saves to authenticated;
grant insert (owner_id, kind, snapshot) on public.art_atlas_account_saves to authenticated;
grant update (snapshot) on public.art_atlas_account_saves to authenticated;

create policy "Read own Art Atlas saves"
  on public.art_atlas_account_saves for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Create own Art Atlas saves"
  on public.art_atlas_account_saves for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Update own Art Atlas saves"
  on public.art_atlas_account_saves for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Delete own Art Atlas saves"
  on public.art_atlas_account_saves for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create function public.art_atlas_update_save_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke execute on function public.art_atlas_update_save_revision() from public, anon, authenticated;

create trigger art_atlas_update_save_revision
  before update on public.art_atlas_account_saves
  for each row execute function public.art_atlas_update_save_revision();
