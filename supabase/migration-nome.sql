-- Accesso con il solo nome (il cognome diventa facoltativo).
-- Eseguire una volta nel SQL Editor di Supabase (si può rieseguire).

create or replace function public.login_player(p_first text, p_last text default '')
returns public.players language plpgsql security definer set search_path = public as $$
declare
  v_first text := btrim(regexp_replace(coalesce(p_first, ''), '\s+', ' ', 'g'));
  v_last  text := btrim(regexp_replace(coalesce(p_last,  ''), '\s+', ' ', 'g'));
  v_key   text;
  v_row   players;
begin
  if length(v_first) < 2 then
    raise exception 'Inserisci il nome';
  end if;
  v_first := upper(left(v_first, 1)) || substr(v_first, 2);
  v_key := lower(btrim(v_first || ' ' || v_last));
  insert into players (first_name, last_name, name_key)
  values (v_first, v_last, v_key)
  on conflict (name_key) do update set first_name = excluded.first_name
  returning * into v_row;
  return v_row;
end $$;

grant execute on function public.login_player(text, text) to anon, authenticated;
