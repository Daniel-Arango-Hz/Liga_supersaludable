import { supabase } from '../config/supabase.js';

/**
 * Verifica el JWT de Supabase que viene en el header Authorization.
 * Inyecta `req.user` con los datos del usuario autenticado.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Verificar que el usuario exista en public.usuarios (puede haber sido eliminado).
  const { data: perfil, error: perfilError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (perfilError || !perfil) {
    return res.status(401).json({ error: 'Cuenta no encontrada. Vuelve a iniciar sesión.' });
  }

  req.user = data.user;
  next();
}

/**
 * Middleware opcional: carga el usuario si hay token, pero no bloquea si no hay.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) req.user = data.user;
  }
  next();
}

/**
 * Verifica que el usuario tenga rol 'admin'.
 * Debe usarse después de requireAuth.
 */
export async function requireAdmin(req, res, next) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('tipo')
    .eq('id', req.user.id)
    .single();

  if (error || data?.tipo !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}
