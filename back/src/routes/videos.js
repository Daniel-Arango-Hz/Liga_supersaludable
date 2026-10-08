import { Router } from 'express';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'libros';
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-m4v',
]);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function extractBase64Payload(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const commaIdx = raw.indexOf(',');
  return commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
}

function getVideoExtension(fileName, mimeType) {
  const normalizedName = (fileName || '').toLowerCase();
  if (normalizedName.endsWith('.mp4')) return 'mp4';
  if (normalizedName.endsWith('.webm')) return 'webm';
  if (normalizedName.endsWith('.ogg')) return 'ogg';
  if (normalizedName.endsWith('.mov')) return 'mov';
  if (normalizedName.endsWith('.m4v')) return 'm4v';

  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/ogg') return 'ogg';
  if (mimeType === 'video/quicktime') return 'mov';
  if (mimeType === 'video/x-m4v') return 'm4v';
  return 'mp4';
}

function isMissingRelationError(error, relationName) {
  const message = String(error?.message || '');
  return message.includes(`public.${relationName}`) || message.includes(relationName);
}

async function resolveAutorId(usuarioId) {
  if (!usuarioId) return null;

  // Buscar entrada existente en autores.
  const { data: autor } = await supabaseAdmin
    .from('autores')
    .select('id')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (autor?.id) return autor.id;

  // Si no existe, crear una entrada básica para que el usuario pueda ser acreditado.
  const { data: created } = await supabaseAdmin
    .from('autores')
    .insert({ usuario_id: usuarioId, bio: '', bio_corta: '', especialidad: '' })
    .select('id')
    .single();

  return created?.id ?? null;
}

async function ensureUniqueVideoSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data: existing, error } = await supabaseAdmin
      .from('videos')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

// ─── GET /videos ──────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const { categoria, page = 1, limit = 9 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const baseVideoFields = 'id, titulo, slug, duracion, vistas, gradiente, emoji, categoria, url, autor_id, created_at';

  let q = supabase
    .from('videos_con_likes')
    .select(`${baseVideoFields}, total_likes`, { count: 'exact' })
    .eq('publicado', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (categoria && categoria !== 'Todos') q = q.eq('categoria', categoria);

  let { data: videos, error, count } = await q;

  // Fallback: algunos entornos no tienen creada la vista videos_con_likes.
  if (error && /videos_con_likes/i.test(error.message || '')) {
    let qFallback = supabase
      .from('videos')
      .select(baseVideoFields, { count: 'exact' })
      .eq('publicado', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (categoria && categoria !== 'Todos') qFallback = qFallback.eq('categoria', categoria);

    const { data: rawVideos, error: fallbackError, count: fallbackCount } = await qFallback;
    if (fallbackError) return res.status(500).json({ error: fallbackError.message });

    const fallbackVideoIds = [...new Set((rawVideos || []).map((v) => v.id).filter(Boolean))];
    const likesByVideoId = new Map();

    if (fallbackVideoIds.length > 0) {
      const { data: likesRows, error: likesError } = await supabaseAdmin
        .from('likes_videos')
        .select('video_id')
        .in('video_id', fallbackVideoIds);

      if (likesError) {
        if (!isMissingRelationError(likesError, 'likes_videos')) {
          return res.status(500).json({ error: likesError.message });
        }
      }

      for (const row of likesRows || []) {
        likesByVideoId.set(row.video_id, (likesByVideoId.get(row.video_id) || 0) + 1);
      }
    }

    videos = (rawVideos || []).map((video) => ({
      ...video,
      total_likes: likesByVideoId.get(video.id) || 0,
    }));
    count = fallbackCount;
    error = null;
  }

  if (error) return res.status(500).json({ error: error.message });

  const videoIds = [...new Set((videos || []).map((v) => v.id).filter(Boolean))];
  let likedSet = new Set();

  if (req.user && videoIds.length > 0) {
    const { data: userLikes, error: likesError } = await supabaseAdmin
      .from('likes_videos')
      .select('video_id')
      .eq('usuario_id', req.user.id)
      .in('video_id', videoIds);

    if (likesError) {
      if (!isMissingRelationError(likesError, 'likes_videos')) {
        return res.status(500).json({ error: likesError.message });
      }
    }
    likedSet = new Set((userLikes || []).map((l) => l.video_id));
  }

  const autorIds = [...new Set((videos || []).map((v) => v.autor_id).filter(Boolean))];
  const autoresMap = {};

  const urlUserIds = [...new Set(
    (videos || [])
      .filter((v) => !v.autor_id && v.url)
      .map((v) => {
        const match = String(v.url).match(/\/videos\/([0-9a-f-]{36})\//i);
        return match ? match[1] : null;
      })
      .filter(Boolean)
  )];

  const allUserIds = [...autorIds];
  const urlUserMap = {};

  if (autorIds.length > 0) {
    const { data: autores } = await supabase
      .from('autores')
      .select('id, usuario_id')
      .in('id', autorIds);

    const usuarioIdsFromAutores = [...new Set((autores || []).map((a) => a.usuario_id).filter(Boolean))];
    allUserIds.push(...usuarioIdsFromAutores.filter((id) => !allUserIds.includes(id)));

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .in('id', [...new Set([...usuarioIdsFromAutores, ...urlUserIds])]);

    const usuariosMap = Object.fromEntries((usuarios || []).map((u) => [u.id, u]));

    for (const autor of autores || []) {
      const u = usuariosMap[autor.usuario_id];
      autoresMap[autor.id] = u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : 'Anónimo';
    }

    for (const uid of urlUserIds) {
      const u = usuariosMap[uid];
      if (u) urlUserMap[uid] = `${u.nombre || ''} ${u.apellido || ''}`.trim();
    }
  } else if (urlUserIds.length > 0) {
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .in('id', urlUserIds);
    for (const u of usuarios || []) {
      urlUserMap[u.id] = `${u.nombre || ''} ${u.apellido || ''}`.trim();
    }
  }

  const data = (videos || []).map((v) => {
    let autor_nombre = 'Anónimo';
    if (v.autor_id) {
      autor_nombre = autoresMap[v.autor_id] || 'Anónimo';
    } else if (v.url) {
      const match = String(v.url).match(/\/videos\/([0-9a-f-]{36})\//i);
      if (match) autor_nombre = urlUserMap[match[1]] || 'Anónimo';
    }

    return {
      ...v,
      autor_nombre,
      likes: Number(v.total_likes || 0),
      user_liked: likedSet.has(v.id),
    };
  });

  res.json({ data, total: count, page: Number(page), totalPaginas: Math.ceil(count / Number(limit)) });
});

router.post('/:slug/like', requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id')
    .eq('slug', slug)
    .eq('publicado', true)
    .maybeSingle();

  if (videoError || !video) return res.status(404).json({ error: 'Video no encontrado' });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('likes_videos')
    .select('video_id')
    .eq('usuario_id', req.user.id)
    .eq('video_id', video.id)
    .maybeSingle();

  if (existingError) return res.status(500).json({ error: existingError.message });

  let liked = false;
  if (existing) {
    const { error: deleteError } = await supabaseAdmin
      .from('likes_videos')
      .delete()
      .eq('usuario_id', req.user.id)
      .eq('video_id', video.id);

    if (deleteError) return res.status(500).json({ error: deleteError.message });
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('likes_videos')
      .insert({ usuario_id: req.user.id, video_id: video.id });

    if (insertError) return res.status(500).json({ error: insertError.message });
    liked = true;
  }

  const { count } = await supabaseAdmin
    .from('likes_videos')
    .select('*', { count: 'exact', head: true })
    .eq('video_id', video.id);

  res.json({ liked, total_likes: count ?? 0 });
});

// ─── GET /videos/:slug ────────────────────────────────────────────────────────
router.get('/:slug', async (req, res) => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('slug', req.params.slug)
    .eq('publicado', true)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Video no encontrado' });

  // Registrar vista
  await supabaseAdmin.rpc('incrementar_vistas_video', { video_id_param: data.id });

  res.json(data);
});

// ─── POST /videos/propuesta (usuario autenticado) ────────────────────────────
router.post(
  '/propuesta',
  requireAuth,
  [
    body('titulo').trim().notEmpty().withMessage('Título requerido'),
    body('duracion').optional().trim(),
    body('categoria').optional().trim(),
    body('fileName').trim().notEmpty().withMessage('Nombre de archivo requerido'),
    body('fileBase64').trim().notEmpty().withMessage('Archivo requerido'),
    body('mimeType').trim().notEmpty().withMessage('Tipo MIME requerido'),
  ],
  validate,
  async (req, res) => {
    try {
      const { titulo, duracion, categoria, fileName, fileBase64, mimeType } = req.body;

      if (!ALLOWED_VIDEO_MIME_TYPES.has(mimeType)) {
        return res.status(400).json({
          error: 'Tipo de video no soportado. Usa MP4, WEBM, OGG, MOV o M4V.',
        });
      }

      const base64Payload = extractBase64Payload(fileBase64);
      const fileBuffer = Buffer.from(base64Payload, 'base64');
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'Archivo de video inválido.' });
      }

      if (fileBuffer.length > 80 * 1024 * 1024) {
        return res.status(400).json({ error: 'El video excede el límite de 80MB.' });
      }

      const baseSlug = slugify(titulo) || `video-${Date.now()}`;
      const slug = await ensureUniqueVideoSlug(baseSlug);
      const extension = getVideoExtension(fileName, mimeType);
      const storagePath = `videos/${req.user.id}/${Date.now()}-${slug}.${extension}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        return res.status(500).json({ error: 'No se pudo subir el video.', details: uploadError.message });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const videoUrl = urlData?.publicUrl;
      if (!videoUrl) {
        return res.status(500).json({ error: 'No se pudo generar la URL pública del video.' });
      }

      const autorId = await resolveAutorId(req.user.id);

      const { data, error } = await supabaseAdmin
        .from('videos')
        .insert({
          titulo,
          slug,
          autor_id: autorId,
          duracion: duracion || null,
          url: videoUrl,
          gradiente: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
          emoji: '🎬',
          categoria: categoria || 'Comunidad',
          publicado: true,
        })
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.status(201).json({
        ...data,
        mensaje: 'Tu video ya está visible en la galería.',
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al crear la propuesta de video.' });
    }
  }
);

// ─── POST /videos (admin) ─────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('videos').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// ─── PATCH /videos/:id (admin) ────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('videos').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── DELETE /videos/:id (admin) ───────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('videos').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
