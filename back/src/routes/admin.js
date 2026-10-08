import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Recursos permitidos y la tabla/vista a la que mapean
const RESOURCE_MAP = {
  libros: {
    listTable: 'libros_completos',
    writeTable: 'libros',
    searchFields: ['titulo', 'slug', 'descripcion', 'autor_nombre'],
  },
  usuarios: {
    listTable: 'usuarios',
    writeTable: 'usuarios',
    searchFields: ['email', 'nombre', 'apellido'],
  },
  testimonios: {
    listTable: 'testimonios',
    writeTable: 'testimonios',
    searchFields: ['nombre_familia', 'texto'],
  },
  videos: {
    listTable: 'videos',
    writeTable: 'videos',
    searchFields: ['titulo', 'slug', 'categoria'],
  },
  autores: {
    listTable: 'autores_completos',
    writeTable: 'autores',
    searchFields: ['nombre_completo', 'bio', 'bio_corta', 'especialidad'],
  },
};

function ensureResource(name) {
  return RESOURCE_MAP[name] || null;
}

function buildSearchQuery(builder, resource, q) {
  const config = ensureResource(resource);
  if (!config?.searchFields?.length) return builder;
  const searchExpression = config.searchFields.map((field) => `${field}.ilike.%${q}%`).join(',');
  return builder.or(searchExpression);
}

// ─── GET /admin/:resource ───────────────────────────────────────────────────
// Listar entidades (paginado). Query: ?page=1&limit=50&q=
router.get('/:resource', requireAuth, requireAdmin, async (req, res) => {
  const { resource } = req.params;
  const map = ensureResource(resource);
  if (!map) return res.status(400).json({ error: 'Recurso no permitido' });

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(200, Number(req.query.limit || 50));
  const offset = (page - 1) * limit;
  const q = String(req.query.q || '').trim();

  try {
    let builder = supabaseAdmin.from(map.listTable).select('*', { count: 'exact' }).range(offset, offset + limit - 1);

    if (q) {
      builder = buildSearchQuery(builder, resource, q);
    }

    const { data, error, count } = await builder.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [], total: count || 0, page, limit });
  } catch (err) {
    console.error('admin list error', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── PATCH /admin/:resource/:id ─────────────────────────────────────────────
// Actualizar un registro por id (body con campos a actualizar)
router.patch('/:resource/:id', requireAuth, requireAdmin, async (req, res) => {
  const { resource, id } = req.params;
  const map = ensureResource(resource);
  if (!map) return res.status(400).json({ error: 'Recurso no permitido' });

  try {
    const writeTable = map.writeTable || map.listTable;
    const { data, error } = await supabaseAdmin
      .from(writeTable)
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('admin patch error', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── DELETE /admin/:resource/:id ────────────────────────────────────────────
router.delete('/:resource/:id', requireAuth, requireAdmin, async (req, res) => {
  const { resource, id } = req.params;
  const map = ensureResource(resource);
  if (!map) return res.status(400).json({ error: 'Recurso no permitido' });

  try {
    const writeTable = map.writeTable || map.listTable;
    const { error } = await supabaseAdmin.from(writeTable).delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).send();
  } catch (err) {
    console.error('admin delete error', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
