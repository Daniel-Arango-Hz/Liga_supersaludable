import { Router } from 'express';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'libros';
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function extractBase64Payload(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const commaIdx = raw.indexOf(',');
  return commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
}

function getImageExtension(fileName, mimeType) {
  const normalizedName = (fileName || '').toLowerCase();
  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) return 'jpg';
  if (normalizedName.endsWith('.png')) return 'png';
  if (normalizedName.endsWith('.webp')) return 'webp';
  if (normalizedName.endsWith('.gif')) return 'gif';

  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'img';
}

// ─── GET /galeria ─────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const { tipo, page = 1, limit = 9 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let q = supabase
    .from('testimonios_con_likes')
    .select('*', { count: 'exact' })
    .eq('publicado', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (tipo) q = q.eq('tipo', tipo);

  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // Si hay usuario autenticado, añadir qué testimonios ya tiene likeados.
  let likedSet = new Set();
  if (req.user && data?.length) {
    const ids = data.map((t) => t.id);
    const { data: userLikes } = await supabaseAdmin
      .from('likes_testimonios')
      .select('testimonio_id')
      .eq('usuario_id', req.user.id)
      .in('testimonio_id', ids);

    likedSet = new Set((userLikes || []).map((l) => l.testimonio_id));
  }

  const enriched = (data || []).map((t) => ({
    ...t,
    user_liked: likedSet.has(t.id),
  }));

  res.json({ data: enriched, total: count, page: Number(page), totalPaginas: Math.ceil(count / Number(limit)) });
});

// ─── POST /galeria (usuario autenticado crea testimonio) ─────────────────────
router.post(
  '/',
  requireAuth,
  [
    body('nombre_familia').trim().notEmpty().withMessage('Nombre de familia requerido'),
    body('texto').optional().trim(),
    body('tipo').isIn(['testimonio', 'foto']).withMessage('Tipo inválido'),
    body('imagen_url').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    const { nombre_familia, texto, tipo, imagen_url, fileName, fileBase64, mimeType } = req.body;

    let finalImageUrl = imagen_url || null;

    if (tipo === 'foto') {
      if (!finalImageUrl && !(fileName && fileBase64 && mimeType)) {
        return res.status(400).json({ error: 'Para subir una foto debes enviar imagen_url o un archivo de imagen.' });
      }

      if (!finalImageUrl && fileName && fileBase64 && mimeType) {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
          return res.status(400).json({ error: 'Tipo de imagen no soportado. Usa JPG, PNG, WEBP o GIF.' });
        }

        const imagePayload = extractBase64Payload(fileBase64);
        const imageBuffer = Buffer.from(imagePayload, 'base64');
        if (!imageBuffer || imageBuffer.length === 0) {
          return res.status(400).json({ error: 'Archivo de imagen inválido.' });
        }

        if (imageBuffer.length > 8 * 1024 * 1024) {
          return res.status(400).json({ error: 'La imagen excede el límite de 8MB.' });
        }

        const extension = getImageExtension(fileName, mimeType);
        const storagePath = `galeria/${req.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, imageBuffer, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          return res.status(500).json({ error: 'No se pudo subir la imagen.', details: uploadError.message });
        }

        const { data: urlData } = supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath);

        finalImageUrl = urlData?.publicUrl || null;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('testimonios')
      .insert({
        usuario_id: req.user.id,
        nombre_familia,
        texto: texto || null,
        tipo,
        imagen_url: finalImageUrl,
        publicado: true,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ ...data, mensaje: 'Tu publicación ya está visible en la comunidad.' });
  }
);

// ─── POST /galeria/:id/like ───────────────────────────────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data: existe, error: existeError } = await supabaseAdmin
    .from('likes_testimonios')
    .select('testimonio_id')
    .eq('usuario_id', req.user.id)
    .eq('testimonio_id', id)
    .maybeSingle();

  if (existeError) return res.status(500).json({ error: existeError.message });

  let liked = false;
  if (existe) {
    const { error: deleteError } = await supabaseAdmin
      .from('likes_testimonios')
      .delete()
      .eq('usuario_id', req.user.id)
      .eq('testimonio_id', id);

    if (deleteError) return res.status(500).json({ error: deleteError.message });
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('likes_testimonios')
      .insert({ usuario_id: req.user.id, testimonio_id: id });

    if (insertError) return res.status(500).json({ error: insertError.message });
    liked = true;
  }

  const { count, error: countError } = await supabaseAdmin
    .from('likes_testimonios')
    .select('*', { count: 'exact', head: true })
    .eq('testimonio_id', id);

  if (countError) return res.status(500).json({ error: countError.message });
  res.json({ liked, total_likes: count ?? 0 });
});

// ─── PATCH /galeria/:id/publicar (admin aprueba/rechaza) ─────────────────────
router.patch('/:id/publicar', requireAuth, requireAdmin, async (req, res) => {
  const { publicado } = req.body;
  const { data, error } = await supabaseAdmin
    .from('testimonios')
    .update({ publicado })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── DELETE /galeria/:id (admin) ──────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('testimonios').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
