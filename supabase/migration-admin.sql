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
