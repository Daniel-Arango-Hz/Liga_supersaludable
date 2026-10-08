import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';
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

// ─── GET /libros ──────────────────────────────────────────────────────────────
// Parámetros: ?orden=destacado|nuevo|descargas|rating&categoria=&edad=&q=&page=1&limit=12
router.get('/', optionalAuth, async (req, res) => {
  const {
    orden,
    categoria,
    edad,
    q,
    page = 1,
    limit = 12,
  } = req.query;

  const offset = (Number(page) - 1) * Number(limit);

  let query_builder = supabase
    .from('libros_completos') // Vista que une libros + autor + categorías
    .select('*', { count: 'exact' })
    .eq('publicado', true)
    .range(offset, offset + Number(limit) - 1);

  if (q) {
    query_builder = query_builder.or(
      `titulo.ilike.%${q}%,autor_nombre.ilike.%${q}%,descripcion.ilike.%${q}%`
    );
  }
  if (orden === 'destacado') {
    // En biblioteca, "destacado" se usa como orden (destacados primero), no como filtro excluyente.
    query_builder = query_builder
      .order('destacado', { ascending: false })
      .order('created_at', { ascending: false });
  } else if (orden === 'nuevo') {
    query_builder = query_builder.eq('nuevo', true);
  } else if (orden === 'fecha_publicacion' || orden === 'ultimo') {
    // No existe la columna fecha_publicacion en la tabla, así que usamos created_at para el libro más reciente.
    query_builder = query_builder.order('created_at', { ascending: false });
  } else if (orden === 'descargas') {
    query_builder = query_builder.order('descargas_total', { ascending: false });
  } else if (orden === 'rating') {
    query_builder = query_builder.order('rating_promedio', { ascending: false });
  } else {
    query_builder = query_builder.order('created_at', { ascending: false });
  }
  if (categoria) query_builder = query_builder.contains('categorias', [categoria]);
  if (edad) query_builder = query_builder.eq('edad_rango', edad);

  const { data, error, count } = await query_builder;

  if (error) return res.status(500).json({ error: error.message });

  const normalizedData = (data || []).map((libro) => ({
    ...libro,
    portada_icono: normalizeCoverIcon(libro.portada_icono),
  }));

  res.json({
    data: normalizedData,
    total: count,
    page: Number(page),
    totalPaginas: Math.ceil(count / Number(limit)),
  });
});

// ─── GET /libros/:slug/pdf (endpoint para descargar PDF) ─────────────────────────────────────────────
// DEBE ESTAR ANTES que GET /:slug para que Express lo evalúe primero
router.get('/:slug/pdf', async (req, res) => {
  const { data: libro } = await supabase
    .from('libros')
    .select('titulo, contenido_url')
    .eq('slug', req.params.slug)
    .single();

  if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });
  if (!libro.contenido_url) {
    return res.status(404).json({ error: 'El libro no tiene archivo asociado' });
  }

  res.redirect(libro.contenido_url);
});

// ─── GET /libros/:slug ────────────────────────────────────────────────────────
router.get('/:slug', optionalAuth, async (req, res) => {
  const { data: libro, error } = await supabase
    .from('libros_completos')
    .select('*')
    .eq('slug', req.params.slug)
    .eq('publicado', true)
    .single();

  if (error || !libro) return res.status(404).json({ error: 'Libro no encontrado' });

  // La vista libros_completos puede no incluir columnas agregadas después de su creación.
  // Por eso completamos contenido_url/paginas desde la tabla base libros.
  const { data: libroBase } = await supabase
    .from('libros')
    .select('contenido_url, paginas, portada_icono')
    .eq('id', libro.id)
    .maybeSingle();

  const contenidoUrl  = libroBase?.contenido_url ?? libro.contenido_url ?? null;
  const paginasTotal  = libroBase?.paginas       ?? libro.paginas       ?? null;
  const portadaIcono  = normalizeCoverIcon(libroBase?.portada_icono ?? libro.portada_icono ?? '📖');

  // Normalizar slug del autor.
  const autorSlugClean = libro.autor_slug
    ? libro.autor_slug.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : null;

  // Páginas del libro
  const { data: paginas } = await supabase
    .from('paginas_libro')
    .select('numero, titulo, contenido')
    .eq('libro_id', libro.id)
    .order('numero');

  // Si el usuario está autenticado, verificar si lo guardó
  let guardado = false;
  if (req.user) {
    const { data: g } = await supabaseAdmin
      .from('guardados')
      .select('libro_id')
      .eq('usuario_id', req.user.id)
      .eq('libro_id', libro.id)
      .maybeSingle();
    guardado = !!g;
  }

  res.json({
    ...libro,
    contenido_url: contenidoUrl,
    portada_icono: portadaIcono,
    paginas_total: paginasTotal,
    autor_slug: autorSlugClean,
    paginas: paginas ?? [],
    guardado,
  });
});

// ─── GET /libros/:slug/paginas ─────────────────────────────────────────────────
router.get('/:slug/paginas', async (req, res) => {
  const { data: libro } = await supabase
    .from('libros')
    .select('id')
    .eq('slug', req.params.slug)
    .single();

  if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });

  const { data, error } = await supabase
    .from('paginas_libro')
    .select('numero, titulo, contenido')
    .eq('libro_id', libro.id)
    .order('numero');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── POST /libros/:slug/descargar ─────────────────────────────────────────────
router.post('/:slug/descargar', optionalAuth, async (req, res) => {
  const { data: libro } = await supabase
    .from('libros')
    .select('id, titulo, contenido_url')
    .eq('slug', req.params.slug)
    .single();

  if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });

  // Registrar descarga
  await supabaseAdmin.from('descargas').insert({
    libro_id: libro.id,
    usuario_id: req.user?.id ?? null,
  });

  // Incrementar contador
  await supabaseAdmin.rpc('incrementar_descargas', { libro_id_param: libro.id });

  // Obtener datos actualizados
  const { data: libroActualizado } = await supabase
    .from('libros')
    .select('descargas_total')
    .eq('id', libro.id)
    .single();

  res.json({ 
    mensaje: 'Descarga registrada',
    descargas_total: libroActualizado?.descargas_total || 0,
    pdfUrl: libro.contenido_url || `/api/libros/${req.params.slug}/pdf`
  });
});

// ─── POST /libros/:slug/valorar [UPDATED] ───────────────────────────────────────────────
router.post(
  '/:slug/valorar',
  requireAuth,
  async (req, res) => {
    try {
      // Aceptar tanto 'puntuacion' como 'calificacion'
      const puntuacion = Number(req.body.puntuacion ?? req.body.calificacion);
      
      if (!Number.isFinite(puntuacion) || puntuacion < 1 || puntuacion > 5) {
        return res.status(400).json({ error: 'Puntuación inválida (1-5)' });
      }

      const { data: libro } = await supabase
        .from('libros')
        .select('id')
        .eq('slug', req.params.slug)
        .single();

      if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });

      // Verificar si ya existe una valoración del usuario para este libro
      const { data: existente, error: existenteError } = await supabaseAdmin
        .from('valoraciones')
        .select('id')
        .eq('usuario_id', req.user.id)
        .eq('libro_id', libro.id)
        .maybeSingle();

      if (existenteError) return res.status(500).json({ error: existenteError.message });

      if (existente) {
        // Actualizar la valoración existente
        const { error } = await supabaseAdmin
          .from('valoraciones')
          .update({ puntuacion })
          .eq('usuario_id', req.user.id)
          .eq('libro_id', libro.id);
        
        if (error) return res.status(500).json({ error: error.message });
      } else {
        // Crear una nueva valoración
        const { error } = await supabaseAdmin
          .from('valoraciones')
          .insert({ usuario_id: req.user.id, libro_id: libro.id, puntuacion });
        
        if (error) return res.status(500).json({ error: error.message });
      }
      
      // Obtener datos actualizados del libro - calcular promedio
      const { data: valoraciones, error: valError } = await supabaseAdmin
        .from('valoraciones')
        .select('puntuacion')
        .eq('libro_id', libro.id);

      if (valError) return res.status(500).json({ error: valError.message });

      let rating_promedio = 0;
      let total_valoraciones = 0;
      let suma = 0;

      if (valoraciones && valoraciones.length > 0) {
        suma = valoraciones.reduce((acc, v) => acc + v.puntuacion, 0);
        total_valoraciones = valoraciones.length;
        rating_promedio = suma / total_valoraciones;
      }

      const responseBody = {
        mensaje: 'Valoración guardada',
        rating_promedio,
        total_valoraciones
      };

      res.json(responseBody);
    } catch (error) {
      console.error('Error in valorar:', error);
      res.status(500).json({ error: 'Error al valorar el libro' });
    }
  }
);

// ─── POST /libros/:slug/guardar ───────────────────────────────────────────────
router.post('/:slug/guardar', requireAuth, async (req, res) => {
  try {
    const { data: libro, error: libroError } = await supabaseAdmin
      .from('libros')
      .select('id')
      .eq('slug', req.params.slug)
      .single();

    if (libroError || !libro) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    const { data: existe, error: existeError } = await supabaseAdmin
      .from('guardados')
      .select('libro_id')
      .eq('usuario_id', req.user.id)
      .eq('libro_id', libro.id)
      .maybeSingle();

    if (existeError) {
      return res.status(500).json({ error: existeError.message });
    }

    if (existe) {
      const { error: deleteError } = await supabaseAdmin
        .from('guardados')
        .delete()
        .eq('usuario_id', req.user.id)
        .eq('libro_id', libro.id);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.json({ guardado: false });
    }

    const { error: insertError } = await supabaseAdmin
      .from('guardados')
      .insert({ usuario_id: req.user.id, libro_id: libro.id });

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ guardado: true });
  } catch (error) {
    console.error('Error al guardar/desguardar libro:', error);
    res.status(500).json({ error: 'Error interno al guardar libro' });
  }
});

// ─── DELETE /libros/:slug/publicacion (autor propietario) ───────────────────
router.delete('/:slug/publicacion', requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: autor, error: autorError } = await supabaseAdmin
      .from('autores')
      .select('id')
      .eq('usuario_id', req.user.id)
      .maybeSingle();

    if (autorError) {
      return res.status(500).json({ error: autorError.message });
    }

    if (!autor?.id) {
      return res.status(403).json({ error: 'Solo un autor puede eliminar sus publicaciones.' });
    }

    const { data: libro, error: libroError } = await supabaseAdmin
      .from('libros')
      .select('id, autor_id, titulo')
      .eq('slug', slug)
      .maybeSingle();

    if (libroError) {
      return res.status(500).json({ error: libroError.message });
    }

    if (!libro?.id) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    if (libro.autor_id !== autor.id) {
      return res.status(403).json({ error: 'No puedes eliminar libros de otro autor.' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('libros')
      .delete()
      .eq('id', libro.id);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    // En schema.sql, las tablas relacionadas (guardados, descargas, valoraciones,
    // paginas_libro, libros_categorias) se eliminan automáticamente por ON DELETE CASCADE.
    return res.json({ eliminado: true, libro_id: libro.id, titulo: libro.titulo });
  } catch (error) {
    console.error('Error eliminando publicación:', error);
    return res.status(500).json({ error: 'Error interno al eliminar la publicación.' });
  }
});

// ─── POST /libros (admin) ─────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requireAdmin,
  [
    body('titulo').trim().notEmpty(),
    body('slug').trim().notEmpty(),
    body('autor_id').isUUID(),
    body('descripcion').optional().trim(),
    body('edad_rango').optional().trim(),
    body('paginas').optional().isInt({ min: 1 }),
    body('anio').optional().isInt({ min: 1900, max: 2100 }),
  ],
  validate,
  async (req, res) => {
    const { categorias, paginas_contenido, ...libroData } = req.body;

    const { data: libro, error } = await supabaseAdmin
      .from('libros')
      .insert(libroData)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Asociar categorías
    if (categorias?.length) {
      await supabaseAdmin.from('libros_categorias').insert(
        categorias.map((id) => ({ libro_id: libro.id, categoria_id: id }))
      );
    }

    // Insertar páginas si vienen
    if (paginas_contenido?.length) {
      await supabaseAdmin.from('paginas_libro').insert(
        paginas_contenido.map((p) => ({ libro_id: libro.id, ...p }))
      );
    }

    res.status(201).json(libro);
  }
);

// ─── PATCH /libros/:id (admin) ────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { categorias, ...rest } = req.body;

  const { data, error } = await supabaseAdmin
    .from('libros')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ─── DELETE /libros/:id (admin) ───────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('libros').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
