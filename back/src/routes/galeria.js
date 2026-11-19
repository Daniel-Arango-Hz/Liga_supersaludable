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
    can_edit: Boolean(req.user && t.usuario_id === req.user.id),
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

// ─── PATCH /galeria/:id (creador edita su publicación) ────────────────────────
router.patch(
  '/:id',
  requireAuth,
  [body('texto').exists().isString().withMessage('El texto debe ser válido')],
  validate,
  async (req, res) => {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('testimonios')
      .select('usuario_id, imagen_url, tipo')
      .eq('id', req.params.id)
      .maybeSingle();

    if (existingError) return res.status(500).json({ error: existingError.message });
    if (!existing) return res.status(404).json({ error: 'Publicación no encontrada.' });
    if (existing.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo quien creó esta publicación puede editarla.' });
    }

    const { texto, fileName, fileBase64, mimeType } = req.body;
    const hasImageUpload = Boolean(fileName || fileBase64 || mimeType);
    if (hasImageUpload && existing.tipo !== 'foto') {
      return res.status(400).json({ error: 'Solo puedes reemplazar imágenes en publicaciones de tipo foto.' });
    }

    let newImagePath = null;
    let imagenUrl = existing.imagen_url;

    if (hasImageUpload) {
      if (!(fileName && fileBase64 && mimeType)) {
        return res.status(400).json({ error: 'Para reemplazar la imagen debes enviar el archivo completo.' });
      }
      if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        return res.status(400).json({ error: 'Tipo de imagen no soportado. Usa JPG, PNG, WEBP o GIF.' });
      }

      const imageBuffer = Buffer.from(extractBase64Payload(fileBase64), 'base64');
      if (!imageBuffer.length) {
        return res.status(400).json({ error: 'Archivo de imagen inválido.' });
      }
      if (imageBuffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'La imagen excede el límite de 8MB.' });
      }

      const extension = getImageExtension(fileName, mimeType);
      newImagePath = `galeria/${req.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(newImagePath, imageBuffer, { contentType: mimeType, upsert: false });

      if (uploadError) {
        return res.status(500).json({ error: 'No se pudo reemplazar la imagen.', details: uploadError.message });
      }

      const { data: urlData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(newImagePath);
      imagenUrl = urlData?.publicUrl || null;
      if (!imagenUrl) {
        const { error: cleanupError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([newImagePath]);
        if (cleanupError) console.error('No se pudo limpiar la imagen después de fallar la generación de URL:', cleanupError);
        return res.status(500).json({ error: 'No se pudo generar la URL pública de la imagen.' });
      }
    }

    const updates = { texto: texto.trim() || null };
    if (hasImageUpload) updates.imagen_url = imagenUrl;

    const { data, error } = await supabaseAdmin
      .from('testimonios')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (newImagePath) {
        const { error: cleanupError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([newImagePath]);
        if (cleanupError) console.error('No se pudo limpiar la imagen después de fallar la edición:', cleanupError);
      }
      return res.status(400).json({ error: error.message });
    }

    if (newImagePath && existing.imagen_url) {
      try {
        const oldUrl = new URL(existing.imagen_url);
        const bucketMarker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
        const bucketIndex = oldUrl.pathname.indexOf(bucketMarker);
        if (bucketIndex >= 0) {
          const oldPath = decodeURIComponent(oldUrl.pathname.slice(bucketIndex + bucketMarker.length));
          if (oldPath.startsWith(`galeria/${req.user.id}/`)) {
            const { error: cleanupError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([oldPath]);
            if (cleanupError) console.error('No se pudo eliminar la imagen reemplazada:', cleanupError);
          }
        }
      } catch (cleanupError) {
        console.error('No se pudo procesar la URL de la imagen reemplazada para limpiar Storage.', cleanupError);
      }
    }

    res.json(data);
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

// ─── DELETE /galeria/:id (creador o admin) ────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('testimonios')
    .select('usuario_id')
    .eq('id', req.params.id)
    .maybeSingle();

  if (existingError) return res.status(500).json({ error: existingError.message });
  if (!existing) return res.status(404).json({ error: 'Publicación no encontrada.' });

  if (existing.usuario_id !== req.user.id) {
    const { data: profile, error: profileError } = await supabase
      .from('usuarios')
      .select('tipo')
      .eq('id', req.user.id)
      .single();

    if (profileError || profile?.tipo !== 'admin') {
      return res.status(403).json({ error: 'Solo quien creó esta publicación puede eliminarla.' });
    }
  }

  const { error } = await supabaseAdmin.from('testimonios').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
