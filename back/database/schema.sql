-- ============================================================
--  FamiliaLee – Schema completo para Supabase (PostgreSQL)
--  Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================================

-- ─── Extensiones ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";   -- búsqueda sin acentos


-- ════════════════════════════════════════════════════════════
--  TABLAS PRINCIPALES
-- ════════════════════════════════════════════════════════════

-- ─── usuarios ────────────────────────────────────────────────────────────────
-- Se sincroniza con auth.users de Supabase mediante trigger
create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  nombre      text not null,
  apellido    text not null,
  tipo        text not null default 'familia'
                check (tipo in ('familia', 'autor', 'admin')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── donaciones PSE (Wompi) ──────────────────────────────────────────────────
create table if not exists public.donaciones (
  id                uuid primary key default gen_random_uuid(),
  reference         text unique not null,
  transaction_id    text unique,
  amount_in_cents   bigint not null check (amount_in_cents between 100000 and 5000000000),
  currency          text not null default 'COP' check (currency = 'COP'),
  status            text not null default 'PENDING'
                      check (status in ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'PROCESSING')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── autores ─────────────────────────────────────────────────────────────────
create table if not exists public.autores (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid unique not null references public.usuarios(id) on delete cascade,
  bio           text,
  bio_corta     text,
  especialidad  text,
  created_at    timestamptz not null default now()
);

-- ─── categorias ──────────────────────────────────────────────────────────────
create table if not exists public.categorias (
  id      serial primary key,
  nombre  text unique not null,
  slug    text unique not null
);

-- ─── libros ──────────────────────────────────────────────────────────────────
create table if not exists public.libros (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  slug               text unique not null,
  descripcion        text,
  contenido_url      text,
  autor_id           uuid references public.autores(id) on delete set null,
  edad_rango         text,
  paginas            integer check (paginas > 0),
  anio               integer check (anio between 1900 and 2100),
  portada_gradiente  text,
  portada_icono      text,
  destacado          boolean not null default false,
  nuevo              boolean not null default false,
  publicado          boolean not null default true,
  descargas_total    integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ─── libros_categorias ───────────────────────────────────────────────────────
create table if not exists public.libros_categorias (
  libro_id     uuid references public.libros(id) on delete cascade,
  categoria_id integer references public.categorias(id) on delete cascade,
  primary key (libro_id, categoria_id)
);

-- ─── paginas_libro ────────────────────────────────────────────────────────────
create table if not exists public.paginas_libro (
  id        serial primary key,
  libro_id  uuid not null references public.libros(id) on delete cascade,
  numero    integer not null check (numero > 0),
  titulo    text,
  contenido text not null,
  unique (libro_id, numero)
);

-- ─── valoraciones ────────────────────────────────────────────────────────────
create table if not exists public.valoraciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  libro_id    uuid not null references public.libros(id) on delete cascade,
  puntuacion  smallint not null check (puntuacion between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (usuario_id, libro_id)
);

-- ─── descargas ────────────────────────────────────────────────────────────────
create table if not exists public.descargas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references public.usuarios(id) on delete set null,
  libro_id    uuid not null references public.libros(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── guardados ────────────────────────────────────────────────────────────────
create table if not exists public.guardados (
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  libro_id    uuid not null references public.libros(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (usuario_id, libro_id)
);

-- ─── videos ───────────────────────────────────────────────────────────────────
create table if not exists public.videos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  slug       text unique not null,
  autor_id   uuid references public.autores(id) on delete set null,
  duracion   text,
  url        text,
  gradiente  text,
  emoji      text,
  categoria  text,
  vistas     integer not null default 0,
  publicado  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── testimonios (galería familiar) ──────────────────────────────────────────
create table if not exists public.testimonios (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  nombre_familia text not null,
  texto          text,
  imagen_url     text,
  tipo           text not null default 'testimonio'
                   check (tipo in ('testimonio', 'foto')),
  publicado      boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ─── likes_testimonios ────────────────────────────────────────────────────────
create table if not exists public.likes_testimonios (
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  testimonio_id uuid not null references public.testimonios(id) on delete cascade,
  primary key (usuario_id, testimonio_id)
);

-- ─── seguidores_autor ─────────────────────────────────────────────────────────
create table if not exists public.seguidores_autor (
  seguidor_id uuid not null references public.usuarios(id) on delete cascade,
  autor_id    uuid not null references public.autores(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (seguidor_id, autor_id)
);


-- ════════════════════════════════════════════════════════════
--  ÍNDICES
-- ════════════════════════════════════════════════════════════
create index if not exists idx_libros_slug       on public.libros(slug);
create index if not exists idx_libros_autor      on public.libros(autor_id);
create index if not exists idx_libros_destacado  on public.libros(destacado) where destacado = true;
create index if not exists idx_libros_nuevo      on public.libros(nuevo) where nuevo = true;
create index if not exists idx_paginas_libro_id  on public.paginas_libro(libro_id);
create index if not exists idx_descargas_libro   on public.descargas(libro_id);
create index if not exists idx_descargas_usuario on public.descargas(usuario_id);
create index if not exists idx_videos_slug       on public.videos(slug);
create index if not exists idx_testimonios_pub   on public.testimonios(publicado) where publicado = true;


-- ════════════════════════════════════════════════════════════
--  VISTAS
-- ════════════════════════════════════════════════════════════

-- Vista: libros con autor, categorías y rating calculado
create or replace view public.libros_completos as
select
  l.*,
  u.nombre || ' ' || u.apellido as autor_nombre,
  a.especialidad              as autor_especialidad,
  at2.slug                    as autor_slug,
  coalesce(
    round(avg(v.puntuacion)::numeric, 1), 0
  )                           as rating_promedio,
  count(distinct v.id)        as total_valoraciones,
  array_remove(array_agg(distinct c.nombre), null) as categorias
from public.libros l
left join public.autores a on a.id = l.autor_id
left join public.usuarios u on u.id = a.usuario_id
left join (
  select a2.id, u2.nombre || '-' || u2.apellido as slug
  from public.autores a2 join public.usuarios u2 on u2.id = a2.usuario_id
) at2 on at2.id = l.autor_id
left join public.valoraciones v on v.libro_id = l.id
left join public.libros_categorias lc on lc.libro_id = l.id
left join public.categorias c on c.id = lc.categoria_id
group by l.id, a.id, u.nombre, u.apellido, a.especialidad, at2.slug;

-- Vista: autores con stats calculados
create or replace view public.autores_completos as
select
  a.*,
  u.nombre,
  u.apellido,
  u.nombre || ' ' || u.apellido as nombre_completo,
  lower(unaccent(u.nombre || '-' || u.apellido)) as slug,
  u.avatar_url,
  count(distinct l.id)          as total_libros,
  coalesce(sum(l.descargas_total), 0) as total_descargas,
  count(distinct sa.seguidor_id) as total_seguidores
from public.autores a
join public.usuarios u on u.id = a.usuario_id
left join public.libros l on l.autor_id = a.id and l.publicado = true
left join public.seguidores_autor sa on sa.autor_id = a.id
group by a.id, a.usuario_id, u.nombre, u.apellido, u.avatar_url;

-- Vista: testimonios con conteo de likes
create or replace view public.testimonios_con_likes as
select
  t.*,
  u.nombre || ' ' || u.apellido as usuario_nombre,
  count(lt.usuario_id)          as total_likes
from public.testimonios t
join public.usuarios u on u.id = t.usuario_id
left join public.likes_testimonios lt on lt.testimonio_id = t.id
group by t.id, u.nombre, u.apellido;

-- Vista: videos con conteo de likes
create or replace view public.videos_con_likes as
select
  v.*,
  count(lv.usuario_id) as total_likes
from public.videos v
left join public.likes_videos lv on lv.video_id = v.id
group by v.id;


-- ════════════════════════════════════════════════════════════
--  FUNCIONES / RPC
-- ════════════════════════════════════════════════════════════

-- Incrementa el contador de descargas de un libro
create or replace function public.incrementar_descargas(libro_id_param uuid)
returns void language sql security definer as $$
  update public.libros
  set descargas_total = descargas_total + 1
  where id = libro_id_param;
$$;

-- Incrementa el contador de vistas de un video
create or replace function public.incrementar_vistas_video(video_id_param uuid)
returns void language sql security definer as $$
  update public.videos
  set vistas = vistas + 1
  where id = video_id_param;
$$;

-- Búsqueda full-text en libros
create or replace function public.buscar_libros(termino text)
returns setof public.libros_completos language sql stable as $$
  select * from public.libros_completos
  where
    publicado = true and (
      titulo ilike '%' || termino || '%' or
      autor_nombre ilike '%' || termino || '%' or
      descripcion ilike '%' || termino || '%'
    );
$$;


-- ════════════════════════════════════════════════════════════
--  TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Crear perfil automáticamente al registrar usuario en auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios (id, email, nombre, apellido, tipo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'tipo', 'familia')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Actualizar updated_at automáticamente en usuarios y libros
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_usuarios_updated_at on public.usuarios;
create trigger set_usuarios_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

drop trigger if exists set_libros_updated_at on public.libros;
create trigger set_libros_updated_at
  before update on public.libros
  for each row execute function public.set_updated_at();


-- ════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════

alter table public.usuarios      enable row level security;
alter table public.autores       enable row level security;
alter table public.libros        enable row level security;
alter table public.paginas_libro enable row level security;
alter table public.valoraciones  enable row level security;
alter table public.descargas     enable row level security;
alter table public.guardados     enable row level security;
alter table public.videos        enable row level security;
alter table public.testimonios   enable row level security;
alter table public.likes_testimonios enable row level security;
alter table public.seguidores_autor  enable row level security;

-- usuarios: cualquiera puede leer, solo el propio usuario puede editar
create policy "usuarios_select" on public.usuarios for select using (true);
create policy "usuarios_update" on public.usuarios for update using (auth.uid() = id);

-- autores: lectura pública, modificación solo propia
create policy "autores_select" on public.autores for select using (true);
create policy "autores_update" on public.autores for update using (auth.uid() = usuario_id);

-- libros: lectura pública, escritura solo admin/autor propietario
create policy "libros_select" on public.libros for select using (publicado = true);
create policy "libros_insert" on public.libros for insert
  with check (
    exists (select 1 from public.autores where usuario_id = auth.uid() and id = autor_id)
    or exists (select 1 from public.usuarios where id = auth.uid() and tipo = 'admin')
  );
create policy "libros_update" on public.libros for update
  using (
    exists (select 1 from public.autores where usuario_id = auth.uid() and id = autor_id)
    or exists (select 1 from public.usuarios where id = auth.uid() and tipo = 'admin')
  );
create policy "libros_delete" on public.libros for delete
  using (exists (select 1 from public.usuarios where id = auth.uid() and tipo = 'admin'));

-- paginas_libro: lectura pública
create policy "paginas_select" on public.paginas_libro for select using (true);

-- valoraciones: cada usuario gestiona las suyas
create policy "valoraciones_select" on public.valoraciones for select using (true);
create policy "valoraciones_insert" on public.valoraciones for insert with check (auth.uid() = usuario_id);
create policy "valoraciones_update" on public.valoraciones for update using (auth.uid() = usuario_id);
create policy "valoraciones_delete" on public.valoraciones for delete using (auth.uid() = usuario_id);

-- descargas: inserción libre, lectura propia
create policy "descargas_insert" on public.descargas for insert with check (true);
create policy "descargas_select" on public.descargas for select using (auth.uid() = usuario_id);

-- guardados: gestión propia
create policy "guardados_select" on public.guardados for select using (auth.uid() = usuario_id);
create policy "guardados_insert" on public.guardados for insert with check (auth.uid() = usuario_id);
create policy "guardados_delete" on public.guardados for delete using (auth.uid() = usuario_id);

-- videos: lectura pública
create policy "videos_select" on public.videos for select using (publicado = true);

-- testimonios: lectura de publicados, inserción con auth
create policy "testimonios_select" on public.testimonios for select using (publicado = true);
create policy "testimonios_insert" on public.testimonios for insert with check (auth.uid() = usuario_id);

-- likes_testimonios: gestión propia
create policy "likes_select" on public.likes_testimonios for select using (true);
create policy "likes_insert" on public.likes_testimonios for insert with check (auth.uid() = usuario_id);
create policy "likes_delete" on public.likes_testimonios for delete using (auth.uid() = usuario_id);

-- seguidores_autor: gestión propia
create policy "seguidores_select" on public.seguidores_autor for select using (true);
create policy "seguidores_insert" on public.seguidores_autor for insert with check (auth.uid() = seguidor_id);
create policy "seguidores_delete" on public.seguidores_autor for delete using (auth.uid() = seguidor_id);


-- ════════════════════════════════════════════════════════════
--  DATOS INICIALES
-- ════════════════════════════════════════════════════════════

insert into public.categorias (nombre, slug) values
  ('Cuentos Infantiles', 'cuentos-infantiles'),
  ('Fe y Valores',       'fe-y-valores'),
  ('Devoción',           'devocion'),
  ('Familia',            'familia'),
  ('Biblia',             'biblia'),
  ('Jóvenes',            'jovenes'),
  ('Matrimonio',         'matrimonio'),
  ('Oración',            'oracion'),
  ('Estudio Bíblico',    'estudio-biblico'),
  ('Apologética',        'apologetica')
on conflict (slug) do nothing;
