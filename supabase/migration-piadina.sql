-- Da eseguire una volta nel SQL Editor di Supabase (aggiunge la categoria "piadina")
alter table public.ingredient_images drop constraint if exists ingredient_images_category_check;
alter table public.ingredient_images add constraint ingredient_images_category_check
  check (category in ('salumi','formaggi','verdure','salse','piadina'));
