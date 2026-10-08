import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { count: librosCount, error: librosError } = await supabaseAdmin
      .from('libros')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', true);

    if (librosError) {
      return res.status(500).json({ error: librosError.message });
    }

    const { count: videosCount, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', true);

    if (videosError) {
      return res.status(500).json({ error: videosError.message });
    }

    const { count: fotosCount, error: fotosError } = await supabaseAdmin
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', true)
      .eq('tipo', 'foto');

    if (fotosError) {
      return res.status(500).json({ error: fotosError.message });
    }

    const { count: testimoniosCount, error: testimoniosError } = await supabaseAdmin
      .from('testimonios')
      .select('id', { count: 'exact', head: true })
      .eq('publicado', true)
      .eq('tipo', 'testimonio');

    if (testimoniosError) {
      return res.status(500).json({ error: testimoniosError.message });
    }

    const { count: usuariosCount, error: usuariosError } = await supabaseAdmin
      .from('usuarios')
      .select('id', { count: 'exact', head: true });

    if (usuariosError) {
      return res.status(500).json({ error: usuariosError.message });
    }

    return res.json({
      libros_subidos: Number(librosCount ?? 0),
      fotos: Number(fotosCount ?? 0),
      videos: Number(videosCount ?? 0),
      testimonios: Number(testimoniosCount ?? 0),
      usuarios: Number(usuariosCount ?? 0),
    });
  } catch (err) {
    console.error('Error en /estadisticas:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
