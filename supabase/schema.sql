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

