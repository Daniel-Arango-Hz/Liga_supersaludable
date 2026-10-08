import { Router } from 'express';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── GET /auth/google ────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const page = req.query.page;
  const tipo = req.query.tipo;

  if (!['login', 'registro'].includes(page) || !['familia', 'autor'].includes(tipo)) {
    return res.status(400).json({ error: 'Solicitud de autenticación con Google inválida' });
  }

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:4321')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
  let requestOrigin;

  try {
    requestOrigin = req.get('referer') ? new URL(req.get('referer')).origin : undefined;
  } catch {
    requestOrigin = undefined;
  }

  const frontendUrl =
    process.env.FRONTEND_URL ||
    (allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || 'http://localhost:4321');
  let redirectTo;

  try {
    const frontend = new URL(frontendUrl.trim());
    if (!['http:', 'https:'].includes(frontend.protocol)) {
      throw new Error('Protocolo de frontend inválido');
    }

    redirectTo = new URL(`/auth/${page}`, frontend.origin);
  } catch (error) {
    console.error('URL de frontend inválida para OAuth:', error);
    return res.status(500).json({ error: 'No se pudo configurar el inicio con Google' });
  }

  redirectTo.searchParams.set('google', page);
  if (page === 'registro') redirectTo.searchParams.set('tipo', tipo);

  const authorizationUrl = new URL('/auth/v1/authorize', process.env.SUPABASE_URL);
  authorizationUrl.searchParams.set('provider', 'google');
  authorizationUrl.searchParams.set('redirect_to', redirectTo.toString());

  return res.redirect(authorizationUrl.toString());
});

// ─── POST /auth/google/session ───────────────────────────────────────────────
router.post(
  '/google/session',
  [
    body('access_token').isString().notEmpty().withMessage('Token de Google requerido'),
    body('page').isIn(['login', 'registro']).withMessage('Flujo de autenticación inválido'),
    body('tipo').isIn(['familia', 'autor']).withMessage('Tipo de cuenta inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const { access_token: accessToken, page, tipo } = req.body;
      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

      if (authError || !authData.user?.email) {
        return res.status(401).json({ error: 'La sesión de Google no es válida. Intenta de nuevo.' });
      }

      const authUser = authData.user;
      const metadata = authUser.user_metadata || {};
      const fullName = metadata.full_name || metadata.name || '';
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
      const inferredNombre = nameParts.shift() || '';
      const nombre = metadata.given_name || metadata.nombre || inferredNombre;
      const apellido = metadata.family_name || metadata.apellido || nameParts.join(' ');
      const avatarUrl = metadata.avatar_url || metadata.picture || null;
      const isNewRegistration =
        page === 'registro' &&
        Date.now() - new Date(authUser.created_at).getTime() < 5 * 60 * 1000;

      let { data: perfil, error: perfilError } = await supabaseAdmin
        .from('usuarios')
        .select('id, email, nombre, apellido, tipo, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

      if (perfilError) {
        console.error('Error al consultar perfil de Google:', perfilError);
        return res.status(500).json({ error: 'No se pudo cargar el perfil de usuario' });
      }

      if (!perfil) {
        const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
          id: authUser.id,
          email: authUser.email,
          nombre,
          apellido,
          tipo: isNewRegistration ? tipo : 'familia',
          avatar_url: avatarUrl,
        });

        if (insertError) {
          console.error('Error al crear perfil de Google:', insertError);
          return res.status(500).json({ error: 'No se pudo crear el perfil de usuario' });
        }
      } else {
        const updates = {};
        if (!perfil.nombre && nombre) updates.nombre = nombre;
        if (!perfil.apellido && apellido) updates.apellido = apellido;
        if (!perfil.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
        if (isNewRegistration) updates.tipo = tipo;

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('usuarios')
            .update(updates)
            .eq('id', authUser.id);

          if (updateError) {
            console.error('Error al actualizar perfil de Google:', updateError);
            return res.status(500).json({ error: 'No se pudo actualizar el perfil de usuario' });
          }
        }
      }

      const { data: finalProfile, error: finalProfileError } = await supabaseAdmin
        .from('usuarios')
        .select('id, email, nombre, apellido, tipo, avatar_url')
        .eq('id', authUser.id)
        .single();

      if (finalProfileError || !finalProfile) {
        console.error('Error al recuperar perfil de Google:', finalProfileError);
        return res.status(500).json({ error: 'No se pudo cargar el perfil de usuario' });
      }

      if (finalProfile.tipo === 'autor') {
        const { error: autorError } = await supabaseAdmin
          .from('autores')
          .upsert(
            { usuario_id: authUser.id, bio: '', bio_corta: '', especialidad: '' },
            { onConflict: 'usuario_id', ignoreDuplicates: true }
          );

        if (autorError) {
          console.error('Error al crear perfil de autor de Google:', autorError);
          return res.status(500).json({ error: 'No se pudo completar el perfil de autor' });
        }
      }

      return res.json({
        token: accessToken,
        usuario: finalProfile,
      });
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      return res.status(500).json({ error: 'Error interno al iniciar sesión con Google' });
    }
  }
);

// ─── DEBUG: POST /auth/debug (revisar qué datos se reciben) ──────────────────
router.post('/debug', (req, res) => {
  console.log('Body recibido:', req.body);
  console.log('Headers:', req.headers);
  res.json({ recibido: req.body });
});

// ─── POST /auth/registro ─────────────────────────────────────────────────────
router.post(
  '/registro',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres'),
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('apellido').trim().notEmpty().withMessage('Apellido requerido'),
    body('tipo').isIn(['familia', 'autor']).withMessage('Tipo inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, nombre, apellido, tipo } = req.body;

      console.log('Intentando crear usuario:', { email, nombre, apellido, tipo });

      // 1. Crear usuario usando Admin API (evita email rate limit)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirma el email
        user_metadata: {
          nombre,
          apellido,
          tipo,
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        const msg = authError.message.includes('already')
          ? 'El correo ya está registrado'
          : authError.message;
        return res.status(400).json({ error: msg });
      }

      const userId = authData.user?.id;
      console.log('Usuario creado en auth:', userId);
      
      if (!userId) {
        return res.status(500).json({ error: 'Error al crear usuario' });
      }

      // 2. Esperar a que el trigger procese
      await new Promise(r => setTimeout(r, 1000));

      // 3. Actualizar el perfil del usuario
      const { error: updateError } = await supabaseAdmin
        .from('usuarios')
        .update({ nombre, apellido, tipo })
        .eq('id', userId);

      if (updateError) {
        console.error('Error al actualizar usuario:', updateError);
      } else {
        console.log('Usuario actualizado en tabla usuarios');
      }

      // 4. Si es autor, crear entrada en autores
      if (tipo === 'autor') {
        const { error: autorError } = await supabaseAdmin
          .from('autores')
          .insert({ usuario_id: userId, bio: '', bio_corta: '', especialidad: '' });
        
        if (autorError) {
          console.error('Error al crear autor:', autorError);
        } else {
          console.log('Autor creado');
        }
      }

      // 5. Hacer login automático para obtener token JWT
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.error('Error al hacer login automático:', loginError);
        // Aún así devolvemos éxito, el usuario puede intentar login después
        return res.status(201).json({
          token: null,
          refresh_token: null,
          usuario: { id: userId, email, nombre, apellido, tipo },
        });
      }

      res.status(201).json({
        token: loginData.session?.access_token || null,
        refresh_token: loginData.session?.refresh_token || null,
        usuario: { id: userId, email, nombre, apellido, tipo },
      });
    } catch (err) {
      console.error('Error en registro:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Cargar perfil de usuario
    const { data: perfil, error: perfilError } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido, tipo, avatar_url')
      .eq('id', data.user.id)
      .single();

    if (perfilError || !perfil) {
      return res.status(401).json({ error: 'Usuario no encontrado. Regístrate nuevamente.' });
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      usuario: perfil,
    });
  }
);

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ mensaje: 'Sesión cerrada correctamente' });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token requerido' });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error) return res.status(401).json({ error: 'Token inválido o expirado' });

  res.json({ token: data.session.access_token, refresh_token: data.session.refresh_token });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, apellido, tipo, avatar_url, created_at')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(data);
});

// ─── POST /auth/recuperar ─────────────────────────────────────────────────────
router.post(
  '/recuperar',
  [body('email').isEmail().normalizeEmail()],
  validate,
  async (req, res) => {
    await supabase.auth.resetPasswordForEmail(req.body.email, {
      redirectTo: `${process.env.CORS_ORIGINS?.split(',')[0]}/auth/nueva-contrasena`,
    });
    // Siempre responder igual para no revelar si el email existe
    res.json({ mensaje: 'Si el correo existe, recibirás un enlace de recuperación.' });
  }
);

export default router;
