import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const AVATAR_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'libros';
const AVATAR_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['image/webp', { extension: 'webp', signature: (buffer) => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' }],
]);

function extractBase64Payload(raw) {
  if (typeof raw !== 'string') return '';
  const commaIndex = raw.indexOf(',');
  return commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
}

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
  res.json({
    ...data,
    avatar_url: data.avatar_url || req.user.user_metadata?.avatar_url || req.user.user_metadata?.picture || null,
  });
});

// ─── GET /usuarios/perfil ─────────────────────────────────────────────────────
router.get('/perfil', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellido, tipo, avatar_url, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({
    ...data,
    avatar_url: data.avatar_url || req.user.user_metadata?.avatar_url || req.user.user_metadata?.picture || null,
  });
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
    const updates = { updated_at: new Date().toISOString() };
    if (nombre !== undefined) updates.nombre = nombre;
    if (apellido !== undefined) updates.apellido = apellido;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, email, nombre, apellido, tipo, avatar_url, created_at')
      .maybeSingle();

    if (error) {
      console.error('Error al actualizar el perfil del usuario:', error);
      return res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
    }
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(data);
  }
);

// ─── POST /usuarios/perfil/avatar ────────────────────────────────────────────
router.post('/perfil/avatar', requireAuth, async (req, res) => {
  const { fileName, mimeType, fileBase64 } = req.body || {};
  const imageType = AVATAR_TYPES.get(mimeType);
  if (!imageType || typeof fileName !== 'string' || !fileName.trim() || typeof fileBase64 !== 'string') {
    return res.status(400).json({ error: 'Selecciona una imagen JPG, PNG o WEBP válida.' });
  }

  const base64Payload = extractBase64Payload(fileBase64);
  if (!base64Payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Payload)) {
    return res.status(400).json({ error: 'El archivo de imagen no tiene un formato válido.' });
  }

  const imageBuffer = Buffer.from(base64Payload, 'base64');
  if (!imageBuffer.length || imageBuffer.length > 2 * 1024 * 1024 || !imageType.signature(imageBuffer)) {
    return res.status(400).json({ error: 'La imagen debe ser JPG, PNG o WEBP y pesar menos de 2 MB.' });
  }

  const storagePath = `avatares/${req.user.id}/${randomUUID()}.${imageType.extension}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Error al subir el avatar a Supabase Storage:', uploadError);
    return res.status(500).json({ error: 'No se pudo subir la imagen. Intenta de nuevo.' });
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(storagePath);
  const avatarUrl = publicUrlData?.publicUrl;
  if (!avatarUrl) {
    return res.status(500).json({ error: 'No se pudo obtener la URL de la imagen.' });
  }

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select('id, email, nombre, apellido, tipo, avatar_url, created_at')
    .single();

  if (error) {
    console.error('Error al guardar el avatar del usuario:', error);
    return res.status(500).json({ error: 'La imagen se subió, pero no se pudo guardar en el perfil.' });
  }

  res.json(data);
});

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
