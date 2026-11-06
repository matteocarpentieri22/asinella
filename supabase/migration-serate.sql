-- Una sola serata con ORDINI APERTI alla volta: quando gli ordini sono chiusi
-- (scadenza passata o chiusi a mano) si può già creare la serata successiva.
-- Eseguire una volta nel SQL Editor di Supabase (si può rieseguire).

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

grant execute on function public.admin_create_event(text, date, timestamptz, uuid[]) to anon, authenticated;
