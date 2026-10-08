import { Router } from 'express';
import { body } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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
