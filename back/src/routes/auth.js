import { Router } from 'express';
import { body } from 'express-validator';
import { createClient } from '@supabase/supabase-js';
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

  const allowedOrigins = (process.env.CORS_ORIGINS || 'https://liga-supersaludable.vercel.app,http://localhost:4321')
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

  const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(origin);
  const productionDeployment = process.env.VERCEL === '1';
  const allowedRequestOrigin =
    allowedOrigins.includes(requestOrigin) && !(productionDeployment && isLocalOrigin(requestOrigin))
      ? requestOrigin
      : undefined;
  let frontendUrl;
  let redirectTo;

  try {
    const configuredFrontendOrigin = process.env.FRONTEND_URL
      ? new URL(process.env.FRONTEND_URL.trim()).origin
      : undefined;
    frontendUrl =
      allowedRequestOrigin ||
      (configuredFrontendOrigin && !(productionDeployment && isLocalOrigin(configuredFrontendOrigin))
        ? configuredFrontendOrigin
        : undefined) ||
      (productionDeployment
        ? allowedOrigins.find((origin) => !isLocalOrigin(origin))
        : allowedOrigins[0]) ||
      'https://liga-supersaludable.vercel.app';
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
    body('refresh_token').isString().notEmpty().withMessage('Token de renovación requerido'),
    body('page').isIn(['login', 'registro']).withMessage('Flujo de autenticación inválido'),
    body('tipo').isIn(['familia', 'autor']).withMessage('Tipo de cuenta inválido'),
  ],
  validate,
  async (req, res) => {
    try {
      const { access_token: accessToken, refresh_token: refreshToken, page, tipo } = req.body;
      const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

      if (authError || !authData.user?.email) {
        return res.status(401).json({ error: 'La sesión de Google no es válida. Intenta de nuevo.' });
      }

      const authUser = authData.user;
      const { data: refreshedAuth, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (refreshError || refreshedAuth.session?.user.id !== authUser.id) {
        return res.status(401).json({ error: 'La sesión de Google no es válida. Inicia sesión nuevamente.' });
      }

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
        token: refreshedAuth.session.access_token,
        refresh_token: refreshedAuth.session.refresh_token,
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
    const genericMessage = 'Si el correo existe, recibirás un enlace de recuperación.';

    if (
      !process.env.TWILIO_ACCOUNT_SID
      || !process.env.TWILIO_API_KEY_SID
      || !process.env.TWILIO_API_KEY_SECRET
    ) {
      console.error('Falta configurar TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID o TWILIO_API_KEY_SECRET.');
      return res.status(503).json({ error: 'El servicio de recuperación no está disponible.' });
    }

    let recoveryStage = 'supabase';
    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: req.body.email,
      });

      if (error) {
        const errorMessage = error.message.toLowerCase();
        const safeMessage = error.message.replace(
          /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
          '[email redacted]'
        );
        if (
          error.status === 404
          || error.code === 'user_not_found'
          || errorMessage.includes('user not found')
        ) {
          console.warn('Supabase devolvió 404 al generar el enlace de recuperación:', {
            status: error.status || null,
            code: error.code || null,
            message: safeMessage,
          });
          return res.json({ mensaje: genericMessage });
        }
        console.error('Supabase no pudo generar el enlace de recuperación:', {
          status: error.status || null,
          code: error.code || null,
          message: safeMessage,
        });
        return res.status(502).json({ error: 'No se pudo procesar la solicitud. Intenta de nuevo más tarde.' });
      }

      const tokenHash = data?.properties?.hashed_token;
      if (!tokenHash) {
        console.error('Supabase no devolvió el token del enlace de recuperación.');
        return res.status(502).json({ error: 'No se pudo procesar la solicitud. Intenta de nuevo más tarde.' });
      }

      const configuredFrontend = process.env.FRONTEND_URL?.trim()
        || process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).find(Boolean);
      if (!configuredFrontend) {
        console.error('Falta configurar FRONTEND_URL para generar enlaces de recuperación.');
        return res.status(503).json({ error: 'El servicio de recuperación no está disponible.' });
      }

      const resetUrl = new URL('/auth/nueva-contrasena', configuredFrontend);
      resetUrl.hash = new URLSearchParams({ token_hash: tokenHash }).toString();
      const resetLink = resetUrl.toString();
      const htmlResetLink = resetLink.replace(/&/g, '&amp;');

      recoveryStage = 'twilio';
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioResponse = await fetch('https://comms.twilio.com/v1/Emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY_SID}:${process.env.TWILIO_API_KEY_SECRET}`).toString('base64')}`,
        },
        body: JSON.stringify({
          from: {
            address: process.env.TWILIO_FROM_EMAIL || `${accountSid}@twilio.email`,
            name: process.env.TWILIO_FROM_NAME || 'Liga Supersaludable',
          },
          to: [{ address: req.body.email }],
          content: {
            subject: 'Recupera tu contraseña de Liga Supersaludable',
            html: `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de Liga Supersaludable.</p><p><a href="${htmlResetLink}">Crear una nueva contraseña</a></p><p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>`,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!twilioResponse.ok) {
        const responseText = await twilioResponse.text();
        let providerError;
        try {
          providerError = responseText ? JSON.parse(responseText) : {};
        } catch {
          providerError = {};
        }

        const error = new Error('Twilio rejected the recovery email.');
        error.status = twilioResponse.status;
        error.code = providerError.code || null;
        error.providerMessage = typeof providerError.message === 'string'
          ? providerError.message
          : null;
        throw error;
      }

      return res.json({ mensaje: genericMessage });
    } catch (error) {
      const providerMessage = error?.providerMessage?.replace(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        '[email redacted]'
      );
      console.error(`Falló la recuperación de contraseña en ${recoveryStage}:`, {
        statusCode: error?.status || null,
        code: error?.code || null,
        providerMessage: providerMessage || undefined,
      });
      return res.status(502).json({ error: 'No se pudo procesar la solicitud. Intenta de nuevo más tarde.' });
    }
  }
);

// ─── POST /auth/nueva-contrasena ──────────────────────────────────────────────
router.post(
  '/nueva-contrasena',
  [
    body('token_hash').isString().isLength({ min: 10, max: 512 }).withMessage('Enlace de recuperación inválido'),
    body('password').isString().isLength({ min: 8, max: 128 }).withMessage('La contraseña debe tener entre 8 y 128 caracteres'),
  ],
  validate,
  async (req, res) => {
    try {
      const recoveryClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
      );
      const { data, error } = await recoveryClient.auth.verifyOtp({
        token_hash: req.body.token_hash,
        type: 'recovery',
      });

      if (error || !data.user) {
        return res.status(400).json({ error: 'El enlace es inválido o venció. Solicita uno nuevo.' });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        password: req.body.password,
      });

      if (updateError) {
        console.error('No se pudo actualizar la contraseña del usuario:', updateError.status || updateError.code || 'unknown');
        return res.status(500).json({ error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' });
      }

      return res.json({ mensaje: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' });
    } catch (error) {
      console.error('Error al procesar el cambio de contraseña:', error?.status || error?.code || 'unknown');
      return res.status(500).json({ error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' });
    }
  }
);

export default router;
