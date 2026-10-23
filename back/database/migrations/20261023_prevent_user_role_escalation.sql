create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios (id, email, nombre, apellido, tipo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    'familia'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.prevent_user_role_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.tipo is distinct from old.tipo
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only trusted server operations may change a user role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_user_role_change on public.usuarios;
create trigger prevent_user_role_change
  before update of tipo on public.usuarios
  for each row execute function public.prevent_user_role_change();
