revoke all on function public.incrementar_descargas(uuid) from public, anon, authenticated;
grant execute on function public.incrementar_descargas(uuid) to service_role;

create or replace function public.registrar_descarga(libro_id_param uuid, usuario_id_param uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if libro_id_param is null or usuario_id_param is null then
    raise exception 'El libro y el usuario son obligatorios';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(usuario_id_param::text || ':' || libro_id_param::text, 0)
  );

  if exists (
    select 1
    from public.descargas
    where usuario_id = usuario_id_param
      and libro_id = libro_id_param
  ) then
    return false;
  end if;

  insert into public.descargas (usuario_id, libro_id)
  values (usuario_id_param, libro_id_param);

  update public.libros
  set descargas_total = descargas_total + 1
  where id = libro_id_param;

  return true;
end;
$$;

revoke all on function public.registrar_descarga(uuid, uuid) from public, anon, authenticated;
grant execute on function public.registrar_descarga(uuid, uuid) to service_role;

drop policy if exists "descargas_insert" on public.descargas;
create policy "descargas_insert" on public.descargas for insert with check (false);
