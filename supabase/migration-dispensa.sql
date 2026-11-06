-- =====================================================================
--  Dispensa: catalogo fisso degli ingredienti + una serata alla volta
--  Eseguire una volta nel SQL Editor di Supabase (si può rieseguire).
--  Gli ingredienti già inseriti vengono spostati nella dispensa in automatico.
-- =====================================================================

create or replace function public._name_key(p text) returns text
language sql immutable as $$ select lower(regexp_replace(btrim(p), '\s+', ' ', 'g')) $$;

-- "oggi" in Italia (le serate sono per data locale)
create or replace function public._today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;

create table if not exists public.catalog (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_key    text not null unique,
  category    text not null check (category in ('salumi','formaggi','verdure','salse')),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.catalog enable row level security;
drop policy if exists "read catalog" on public.catalog;
create policy "read catalog" on public.catalog for select using (true);

-- la tabella ingredients diventa "ingredienti scelti per la serata", collegati alla dispensa
alter table public.ingredients add column if not exists catalog_id uuid references public.catalog(id) on delete set null;

-- sposta in dispensa gli ingredienti già inseriti (e quelli che hanno già un'immagine)
insert into public.catalog (name, name_key, category)
select distinct on (public._name_key(name)) btrim(name), public._name_key(name), category
from public.ingredients
order by public._name_key(name), created_at
on conflict (name_key) do nothing;

insert into public.catalog (name, name_key, category)
select display_name, name_key, category
from public.ingredient_images
where category in ('salumi','formaggi','verdure','salse')
on conflict (name_key) do nothing;

update public.ingredients i set catalog_id = c.id
from public.catalog c
where i.catalog_id is null and c.name_key = public._name_key(i.name);

-- ---------- funzioni dispensa ------------------------------------------

create or replace function public.admin_catalog_add(p_pin text, p_name text, p_category text)
returns public.catalog language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  v_row  catalog;
begin
  perform _assert_admin(p_pin);
  if length(v_name) < 2 then raise exception 'Nome troppo corto'; end if;
  insert into catalog (name, name_key, category)
  values (v_name, _name_key(v_name), p_category)
  on conflict (name_key) do update set archived = false
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.admin_catalog_update(
  p_pin text, p_id uuid, p_name text, p_category text, p_archived boolean
) returns public.catalog language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old  catalog;
  v_name text := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  v_key  text := _name_key(p_name);
  v_row  catalog;
begin
  perform _assert_admin(p_pin);
  select * into v_old from catalog where id = p_id;
  if not found then raise exception 'Ingrediente non trovato'; end if;
  if length(v_name) < 2 then raise exception 'Nome troppo corto'; end if;
  if v_key <> v_old.name_key and exists (select 1 from catalog where name_key = v_key) then
    raise exception 'Esiste già un ingrediente con questo nome';
  end if;

  update catalog set name = v_name, name_key = v_key, category = p_category, archived = coalesce(p_archived, false)
   where id = p_id returning * into v_row;

  -- l'immagine segue il nome
  if v_key <> v_old.name_key and not exists (select 1 from ingredient_images where name_key = v_key) then
    update ingredient_images set name_key = v_key, display_name = v_name, category = p_category where name_key = v_old.name_key;
  end if;

  -- aggiorna le serate non ancora concluse (gli ordini hanno già i nomi salvati)
  update ingredients set name = v_name, category = p_category
   where catalog_id = p_id and event_id in (select id from events where event_date >= _today());
  return v_row;
end $$;

-- ---------- funzioni serata --------------------------------------------

create or replace function public._set_event_ingredients(p_event uuid, p_catalog_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from ingredients
   where event_id = p_event and (catalog_id is null or not (catalog_id = any(coalesce(p_catalog_ids, '{}'))));

  insert into ingredients (event_id, catalog_id, name, category, sort)
  select p_event, c.id, c.name, c.category, array_position(p_catalog_ids, c.id)
    from catalog c
   where c.id = any(coalesce(p_catalog_ids, '{}'))
     and not exists (select 1 from ingredients i where i.event_id = p_event and i.catalog_id = c.id);

  update ingredients i set sort = array_position(p_catalog_ids, i.catalog_id)
   where i.event_id = p_event and i.catalog_id = any(coalesce(p_catalog_ids, '{}'));
end $$;
revoke all on function public._set_event_ingredients(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.admin_create_event(
  p_pin text, p_event_date date, p_deadline timestamptz, p_catalog_ids uuid[]
) returns public.events language plpgsql security definer set search_path = public, extensions as $$
declare v_row events;
begin
  perform _assert_admin(p_pin);
  if exists (select 1 from events where event_date >= _today()) then
    raise exception 'C''è già una serata in corso: potrai crearne una nuova quando sarà conclusa';
  end if;
  if p_deadline is null then raise exception 'Imposta la scadenza degli ordini'; end if;
  insert into events (event_date, deadline, closed) values (p_event_date, p_deadline, false) returning * into v_row;
  perform _set_event_ingredients(v_row.id, p_catalog_ids);
  return v_row;
end $$;

create or replace function public.admin_set_event_ingredients(p_pin text, p_event uuid, p_catalog_ids uuid[])
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  perform _set_event_ingredients(p_event, p_catalog_ids);
end $$;

grant execute on function
  public.admin_catalog_add(text, text, text),
  public.admin_catalog_update(text, uuid, text, text, boolean),
  public.admin_create_event(text, date, timestamptz, uuid[]),
  public.admin_set_event_ingredients(text, uuid, uuid[])
to anon, authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.catalog; exception when duplicate_object then null; end;
end $$;
