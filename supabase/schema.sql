-- =====================================================================
--  Asinella · Piadine del giovedì — schema Supabase
--  Eseguire tutto in: Supabase > SQL Editor > New query > Run
--  PIN admin iniziale: "asinella"  (cambialo dal pannello admin!)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabelle ---------------------------------------------------

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  name_key    text not null unique,          -- "mario rossi" normalizzato
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  event_date  date not null,
  deadline    timestamptz not null,
  closed      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.ingredients (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  category    text not null check (category in ('salumi','formaggi','verdure','salse')),
  name        text not null,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ingredients_event_idx on public.ingredients(event_id);

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,   -- [{id,name,category}] snapshot
  extra       text,                                 -- voce "altro" libera
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_id, player_id)
);
create index if not exists orders_event_idx on public.orders(event_id);

create table if not exists public.admin_config (
  id        int primary key default 1 check (id = 1),
  pin_hash  text not null
);
insert into public.admin_config (id, pin_hash)
values (1, extensions.crypt('asinella', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- ---------- RLS: lettura pubblica, scrittura solo via funzioni --------

alter table public.players      enable row level security;
alter table public.events       enable row level security;
alter table public.ingredients  enable row level security;
alter table public.orders       enable row level security;
alter table public.admin_config enable row level security;   -- nessuna policy = invisibile

drop policy if exists "read players" on public.players;
create policy "read players" on public.players for select using (true);
drop policy if exists "read events" on public.events;
create policy "read events" on public.events for select using (true);
drop policy if exists "read ingredients" on public.ingredients;
create policy "read ingredients" on public.ingredients for select using (true);
drop policy if exists "read orders" on public.orders;
create policy "read orders" on public.orders for select using (true);

-- ---------- Helper -----------------------------------------------------

create or replace function public._assert_admin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from admin_config where id = 1 and pin_hash = crypt(p_pin, pin_hash)) then
    raise exception 'PIN admin errato' using errcode = '28000';
  end if;
end $$;
revoke all on function public._assert_admin(text) from public, anon, authenticated;

-- ---------- Funzioni giocatori ----------------------------------------

create or replace function public.login_player(p_first text, p_last text)
returns public.players language plpgsql security definer set search_path = public as $$
declare
  v_first text := initcap(btrim(regexp_replace(p_first, '\s+', ' ', 'g')));
  v_last  text := initcap(btrim(regexp_replace(p_last,  '\s+', ' ', 'g')));
  v_key   text := lower(v_first || ' ' || v_last);
  v_row   players;
begin
  if length(v_first) < 2 or length(v_last) < 2 then
    raise exception 'Inserisci nome e cognome';
  end if;
  insert into players (first_name, last_name, name_key)
  values (v_first, v_last, v_key)
  on conflict (name_key) do update set first_name = excluded.first_name
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.submit_order(
  p_player uuid, p_event uuid, p_ingredient_ids uuid[], p_extra text, p_notes text
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_items jsonb;
  v_row   orders;
begin
  select * into v_event from events where id = p_event;
  if not found then raise exception 'Serata non trovata'; end if;
  if v_event.closed or now() > v_event.deadline then
    raise exception 'Ordini chiusi per questa serata';
  end if;
  if not exists (select 1 from players where id = p_player) then
    raise exception 'Giocatore non trovato';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'category', i.category)
                            order by array_position(p_ingredient_ids, i.id)), '[]'::jsonb)
    into v_items
    from ingredients i
   where i.event_id = p_event and i.id = any(coalesce(p_ingredient_ids, '{}'));

  if jsonb_array_length(v_items) = 0 and coalesce(btrim(p_extra), '') = '' then
    raise exception 'La piadina è vuota!';
  end if;

  insert into orders (event_id, player_id, items, extra, notes)
  values (p_event, p_player, v_items, nullif(btrim(p_extra), ''), nullif(btrim(p_notes), ''))
  on conflict (event_id, player_id) do update
    set items = excluded.items, extra = excluded.extra, notes = excluded.notes, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.cancel_order(p_player uuid, p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_event events;
begin
  select * into v_event from events where id = p_event;
  if v_event.closed or now() > v_event.deadline then
    raise exception 'Ordini chiusi per questa serata';
  end if;
  delete from orders where event_id = p_event and player_id = p_player;
end $$;

-- ---------- Funzioni admin --------------------------------------------

create or replace function public.admin_check(p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  return exists (select 1 from admin_config where id = 1 and pin_hash = crypt(p_pin, pin_hash));
end $$;

create or replace function public.admin_change_pin(p_pin text, p_new_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  if length(coalesce(p_new_pin, '')) < 4 then raise exception 'PIN troppo corto (min 4)'; end if;
  update admin_config set pin_hash = crypt(p_new_pin, gen_salt('bf')) where id = 1;
end $$;

create or replace function public.admin_save_event(
  p_pin text, p_id uuid, p_event_date date, p_deadline timestamptz, p_closed boolean, p_copy_from uuid default null
) returns public.events language plpgsql security definer set search_path = public, extensions as $$
declare v_row events;
begin
  perform _assert_admin(p_pin);
  if p_id is null then
    insert into events (event_date, deadline, closed) values (p_event_date, p_deadline, coalesce(p_closed, false))
    returning * into v_row;
    if p_copy_from is not null then
      insert into ingredients (event_id, category, name, sort)
      select v_row.id, category, name, sort from ingredients where event_id = p_copy_from;
    end if;
  else
    update events set event_date = p_event_date, deadline = p_deadline, closed = coalesce(p_closed, false)
     where id = p_id returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.admin_delete_event(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  delete from events where id = p_id;
end $$;

create or replace function public.admin_add_ingredient(p_pin text, p_event uuid, p_category text, p_name text)
returns public.ingredients language plpgsql security definer set search_path = public, extensions as $$
declare v_row ingredients;
begin
  perform _assert_admin(p_pin);
  insert into ingredients (event_id, category, name, sort)
  values (p_event, p_category, btrim(p_name),
          coalesce((select max(sort) + 1 from ingredients where event_id = p_event and category = p_category), 0))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.admin_delete_ingredient(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  delete from ingredients where id = p_id;
end $$;

create or replace function public.admin_delete_order(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  delete from orders where id = p_id;
end $$;

-- ---------- Permessi --------------------------------------------------

grant execute on function
  public.login_player(text, text),
  public.submit_order(uuid, uuid, uuid[], text, text),
  public.cancel_order(uuid, uuid),
  public.admin_check(text),
  public.admin_change_pin(text, text),
  public.admin_save_event(text, uuid, date, timestamptz, boolean, uuid),
  public.admin_delete_event(text, uuid),
  public.admin_add_ingredient(text, uuid, text, text),
  public.admin_delete_ingredient(text, uuid),
  public.admin_delete_order(text, uuid)
to anon, authenticated;

-- ---------- Realtime (lista ordini live) ------------------------------

do $$
begin
  begin alter publication supabase_realtime add table public.orders;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ingredients; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.events;      exception when duplicate_object then null; end;
end $$;

-- =====================================================================
--  Immagini degli ingredienti generate con Gemini
--  (una per nome di ingrediente, riusata in tutte le settimane)
-- =====================================================================

create table if not exists public.ingredient_images (
  name_key      text primary key,                -- nome normalizzato: "prosciutto cotto"
  display_name  text not null,
  category      text not null check (category in ('salumi','formaggi','verdure','salse')),
  image_url     text,                             -- PNG trasparente su Storage (null per le salse)
  color         text,                             -- per le salse: "#rrggbb,#rrggbb" (colore, bordo)
  status        text not null default 'pending' check (status in ('pending','ok','error')),
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.ingredient_images enable row level security;
drop policy if exists "read ingredient images" on public.ingredient_images;
create policy "read ingredient images" on public.ingredient_images for select using (true);
-- scritture solo dalla Edge Function (service role)

create or replace function public.admin_delete_ingredient_image(p_pin text, p_name_key text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  delete from ingredient_images where name_key = p_name_key;
end $$;
grant execute on function public.admin_delete_ingredient_image(text, text) to anon, authenticated;

-- bucket pubblico per le immagini
insert into storage.buckets (id, name, public)
values ('ingredient-images', 'ingredient-images', true)
on conflict (id) do nothing;

do $$
begin
  begin alter publication supabase_realtime add table public.ingredient_images; exception when duplicate_object then null; end;
end $$;


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
  if exists (select 1 from events where not closed and deadline > now()) then
    raise exception 'C''è già una serata con gli ordini aperti: chiudi gli ordini prima di crearne una nuova';
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

-- =====================================================================
--  Impostazioni admin (numero WhatsApp di Asinella) + eliminazione
--  ingredienti dalla dispensa. Eseguire nel SQL Editor (si può rieseguire).
-- =====================================================================

create table if not exists public.app_settings (
  key    text primary key,
  value  text
);
alter table public.app_settings enable row level security;   -- nessuna policy: si legge solo con il PIN

create or replace function public.admin_get_settings(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  return coalesce((select jsonb_object_agg(key, value) from app_settings), '{}'::jsonb);
end $$;

create or replace function public.admin_set_setting(p_pin text, p_key text, p_value text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_pin);
  if p_key not in ('asinella_phone') then raise exception 'Impostazione sconosciuta'; end if;
  insert into app_settings (key, value) values (p_key, nullif(btrim(p_value), ''))
  on conflict (key) do update set value = excluded.value;
end $$;

-- elimina un ingrediente dalla dispensa (e dalle serate non ancora concluse);
-- gli ordini già fatti restano corretti perché hanno i nomi salvati
create or replace function public.admin_catalog_delete(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_key text;
begin
  perform _assert_admin(p_pin);
  select name_key into v_key from catalog where id = p_id;
  delete from ingredients
   where catalog_id = p_id and event_id in (select id from events where event_date >= _today());
  delete from catalog where id = p_id;
  if v_key is not null then delete from ingredient_images where name_key = v_key; end if;
end $$;

grant execute on function
  public.admin_get_settings(text),
  public.admin_set_setting(text, text, text),
  public.admin_catalog_delete(text, uuid)
to anon, authenticated;
