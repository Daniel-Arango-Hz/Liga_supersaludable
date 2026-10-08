import { Router } from 'express';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Normaliza slug de autor reemplazando espacios y caracteres peligrosos.
function sanitizeSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── GET /autores ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('autores_completos') // Vista con stats calculados
    .select('*')
    .order('total_descargas', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map((a) => ({ ...a, slug: sanitizeSlug(a.slug) })));
});

// ─── GET /autores/:slug ───────────────────────────────────────────────────────
router.get('/:slug', optionalAuth, async (req, res) => {
  const urlSlug = req.params.slug;

  // 1. Intento exacto (por si ya tiene el slug limpio en DB).
  let { data: autor } = await supabase
    .from('autores_completos')
    .select('*')
    .eq('slug', urlSlug)
    .maybeSingle();

  // 2. Si no encontró, buscamos entre todos los autores normalizando el slug al vuelo.
  //    Esto soluciona que la vista SQL genera slugs con espacios (ej. "user prueba 2-qa2")
  //    pero la URL usa hífenes ("user-prueba-2-qa2").
  if (!autor) {
    const { data: todos } = await supabase
      .from('autores_completos')
      .select('*');

    autor = (todos || []).find((a) => sanitizeSlug(a.slug) === urlSlug) || null;
  }

  if (!autor) return res.status(404).json({ error: 'Autor no encontrado' });

  // Si la vista no incluye email, lo agregamos aquí consultando el usuario
  if (!autor.email && autor.usuario_id) {
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('email')
      .eq('id', autor.usuario_id)
      .single();

    if (!usuarioError && usuario?.email) {
      autor.email = usuario.email;
    }

    if (!autor.usuario) {
      autor.usuario = usuario || null;
    }
  }

  // Libros del autor
  const { data: libros } = await supabase
    .from('libros_completos')
    .select('*')
    .eq('autor_id', autor.id)
    .eq('publicado', true)
    .order('created_at', { ascending: false });

  // Si el usuario está autenticado, verificar si lo sigue
  let siguiendo = false;
  if (req.user) {
    const { data: s } = await supabase
      .from('seguidores_autor')
      .select('autor_id')
      .eq('seguidor_id', req.user.id)
      .eq('autor_id', autor.id)
      .maybeSingle();
    siguiendo = !!s;
  }

  res.json({ ...autor, slug: sanitizeSlug(autor.slug), libros: libros ?? [], siguiendo });
});

// ─── POST /autores/:id/seguir ─────────────────────────────────────────────────
router.post('/:id/seguir', requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data: existe, error: existeError } = await supabaseAdmin
    .from('seguidores_autor')
    .select('autor_id')
    .eq('seguidor_id', req.user.id)
    .eq('autor_id', id)
    .maybeSingle();

  if (existeError) {
    console.error('[seguir] Error comprobando existencia:', existeError);
    return res.status(500).json({ error: 'Error al comprobar seguimiento' });
  }

  let siguiendo = false;
  if (existe) {
    const { error: deleteError } = await supabaseAdmin
      .from('seguidores_autor')
      .delete()
      .eq('seguidor_id', req.user.id)
      .eq('autor_id', id);

    if (deleteError) {
      console.error('[seguir] Error al eliminar seguimiento:', deleteError);
      return res.status(500).json({ error: 'Error al dejar de seguir autor' });
    }
    siguiendo = false;
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('seguidores_autor')
      .insert({ seguidor_id: req.user.id, autor_id: id });

    if (insertError) {
      console.error('[seguir] Error al insertar seguimiento:', insertError);
      return res.status(500).json({ error: 'Error al seguir autor' });
    }
    siguiendo = true;
  }

  // Obtener datos actualizados del autor desde la vista con stats calculados
  const { data: autorActualizado, error: autorError } = await supabaseAdmin
    .from('autores_completos')
    .select('total_seguidores')
    .eq('id', id)
    .single();

  if (autorError) {
    console.error('[seguir] Error al obtener seguidores actualizados:', autorError);
    return res.status(500).json({ error: 'Error al obtener seguimiento actualizado' });
  }

  res.json({
    siguiendo,
    total_seguidores: autorActualizado?.total_seguidores || 0,
  });
});

// ─── PATCH /autores/perfil (el propio autor actualiza su bio) ─────────────────
router.patch(
  '/perfil',
  requireAuth,
  [
    body('bio').optional().trim(),
    body('especialidad').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { bio, especialidad, nombre, apellido, avatar_url } = req.body;

    // Actualizar tabla usuarios
    if (nombre || apellido || avatar_url) {
      await supabase
        .from('usuarios')
        .update({ nombre, apellido, avatar_url, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
    }

    // Actualizar tabla autores
    const { data, error } = await supabase
      .from('autores')
      .update({ bio, especialidad })
      .eq('usuario_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  }
);

export default router;
