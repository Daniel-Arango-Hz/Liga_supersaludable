import { Router } from 'express';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

function normalizeCoverIcon(icon) {
  if (!icon || typeof icon !== 'string') return icon;
  if (/^(https?:)?\/\//i.test(icon)) return icon;
  if (icon.startsWith('/')) {
    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    if (base) return `${base}${icon}`;
  }
  return icon;
}

// ─── GET /usuarios (alias de /perfil con auth opcional) ──────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellido, tipo, avatar_url, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
});

// ─── GET /usuarios/perfil ─────────────────────────────────────────────────────
router.get('/perfil', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellido, tipo, avatar_url, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
});

// ─── PATCH /usuarios/perfil ───────────────────────────────────────────────────
router.patch(
  '/perfil',
  requireAuth,
  [
    body('nombre').optional().trim().notEmpty(),
    body('apellido').optional().trim().notEmpty(),
    body('avatar_url').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    const { nombre, apellido, avatar_url } = req.body;
    const { data, error } = await supabase
      .from('usuarios')
      .update({ nombre, apellido, avatar_url, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

// ─── GET /usuarios/guardados ──────────────────────────────────────────────────
router.get('/guardados', requireAuth, async (req, res) => {
  const { data: guardados, error: guardadosError } = await supabaseAdmin
    .from('guardados')
    .select('libro_id, created_at')
    .eq('usuario_id', req.user.id)
    .order('created_at', { ascending: false });

  if (guardadosError) return res.status(500).json({ error: guardadosError.message });

  if (!guardados?.length) {
    return res.json([]);
  }

  const libroIds = guardados.map((g) => g.libro_id);

  const { data: libros, error: librosError } = await supabaseAdmin
    .from('libros')
    .select('id, slug, titulo, descripcion, portada_gradiente, portada_icono, descargas_total, autor_id, edad_rango, anio, destacado, nuevo, publicado')
    .in('id', libroIds);

  if (librosError) return res.status(500).json({ error: librosError.message });

  const autorIds = [...new Set((libros || []).map((l) => l.autor_id).filter(Boolean))];

  const { data: autoresBase, error: autoresBaseError } = autorIds.length
    ? await supabaseAdmin
        .from('autores')
        .select('id, usuario_id')
        .in('id', autorIds)
    : { data: [], error: null };

  if (autoresBaseError) return res.status(500).json({ error: autoresBaseError.message });

  const usuarioIds = [...new Set((autoresBase || []).map((a) => a.usuario_id).filter(Boolean))];

  const { data: usuariosBase, error: usuariosBaseError } = usuarioIds.length
    ? await supabaseAdmin
        .from('usuarios')
        .select('id, nombre, apellido')
        .in('id', usuarioIds)
    : { data: [], error: null };

  if (usuariosBaseError) return res.status(500).json({ error: usuariosBaseError.message });

  const { data: valoraciones, error: valoracionesError } = await supabaseAdmin
    .from('valoraciones')
    .select('libro_id, puntuacion')
    .in('libro_id', libroIds);

  if (valoracionesError) return res.status(500).json({ error: valoracionesError.message });

  const usuariosById = new Map((usuariosBase || []).map((u) => [u.id, u]));
  const autoresById = new Map(
    (autoresBase || []).map((a) => {
      const user = usuariosById.get(a.usuario_id);
      const nombre = `${user?.nombre || ''} ${user?.apellido || ''}`.trim() || 'Anónimo';
      return [a.id, nombre];
    })
  );

  const ratingsByLibroId = new Map();
  for (const v of valoraciones || []) {
    const current = ratingsByLibroId.get(v.libro_id) || { total: 0, count: 0 };
    current.total += Number(v.puntuacion || 0);
    current.count += 1;
    ratingsByLibroId.set(v.libro_id, current);
  }

  const librosById = new Map(
    (libros || []).map((libro) => [
      libro.id,
      {
        id: libro.id,
        slug: libro.slug,
        titulo: libro.titulo,
        descripcion: libro.descripcion,
        portada_gradiente: libro.portada_gradiente,
        portada_icono: normalizeCoverIcon(libro.portada_icono),
        descargas_total: libro.descargas_total || 0,
        edad_rango: libro.edad_rango,
        anio: libro.anio,
        destacado: libro.destacado,
        nuevo: libro.nuevo,
        publicado: libro.publicado,
        autor_nombre: autoresById.get(libro.autor_id) || 'Anónimo',
        categorias: [],
        rating_promedio: (() => {
          const r = ratingsByLibroId.get(libro.id);
          if (!r || !r.count) return 0;
          return Number((r.total / r.count).toFixed(1));
        })(),
        total_valoraciones: ratingsByLibroId.get(libro.id)?.count || 0,
      },
    ])
  );

  const orderedLibros = guardados
    .map((g) => librosById.get(g.libro_id))
    .filter(Boolean);

  res.json(orderedLibros);
});

// ─── GET /usuarios/publicaciones ─────────────────────────────────────────────
router.get('/publicaciones', requireAuth, async (req, res) => {
  const { data: autor, error: autorError } = await supabaseAdmin
    .from('autores')
    .select('id')
    .eq('usuario_id', req.user.id)
    .maybeSingle();

  if (autorError) return res.status(500).json({ error: autorError.message });
  if (!autor?.id) return res.json([]);

  const { data, error } = await supabaseAdmin
    .from('libros_completos')
    .select('*')
    .eq('autor_id', autor.id)
    .eq('publicado', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const libroIds = (data || []).map((l) => l.id).filter(Boolean);

  const { data: guardadosRows, error: guardadosRowsError } = libroIds.length
    ? await supabaseAdmin
        .from('guardados')
        .select('libro_id')
        .in('libro_id', libroIds)
    : { data: [], error: null };

  if (guardadosRowsError) return res.status(500).json({ error: guardadosRowsError.message });

  const guardadosCountByLibroId = new Map();
  for (const row of guardadosRows || []) {
    guardadosCountByLibroId.set(row.libro_id, (guardadosCountByLibroId.get(row.libro_id) || 0) + 1);
  }

  const normalized = (data || []).map((libro) => ({
    ...libro,
    portada_icono: normalizeCoverIcon(libro.portada_icono),
    guardados_total: guardadosCountByLibroId.get(libro.id) || 0,
  }));

  res.json(normalized);
});

// ─── GET /usuarios/descargas ──────────────────────────────────────────────────
router.get('/descargas', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('descargas')
    .select('libro:libros_completos(*), created_at')
    .eq('usuario_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((d) => ({ ...d.libro, descargado_en: d.created_at })));
});

// ─── GET /usuarios/estadisticas ───────────────────────────────────────────────
router.get('/estadisticas', requireAuth, async (req, res) => {
  const uid = req.user.id;

  const [{ count: descargados }, { count: guardados }, { data: publicaciones }] =
    await Promise.all([
      supabase.from('descargas').select('*', { count: 'exact', head: true }).eq('usuario_id', uid),
      supabase.from('guardados').select('*', { count: 'exact', head: true }).eq('usuario_id', uid),
      supabase.from('libros').select('id', { count: 'exact' })
        .eq('publicado', true)
        .eq('autor_id', uid),
    ]);

  res.json({ descargados, guardados, publicaciones: publicaciones?.length ?? 0 });
});

export default router;
