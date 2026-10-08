const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api';

interface AuthResponse {
  token: string;
  refresh_token: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    tipo: string;
  };
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  tipo: string;
  avatar_url?: string;
  created_at: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function registro(data: {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  tipo: 'familia' | 'autor' | 'admin';
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/registro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error en el registro');
  }

  await res.json(); // Consume la respuesta de registro
  
  // Después de registrar, haz login automático
  return login(data.email, data.password);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error en el login');
  }

  return res.json();
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function getUsuario(): Usuario | null {
  const data = localStorage.getItem('usuario');
  return data ? JSON.parse(data) : null;
}

export function setAuth(token: string, usuario: Usuario): void {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Fetch con autenticación ──────────────────────────────────────────────────
async function fetchAuth(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok && res.status === 401) {
    logout();
    window.location.href = '/auth/login';
  }

  return res;
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────
export async function obtenerPerfil(): Promise<Usuario> {
  const res = await fetchAuth('/usuarios/perfil');
  if (!res.ok) throw new Error('Error al obtener perfil');
  return res.json();
}

export async function actualizarPerfil(data: {
  nombre?: string;
  apellido?: string;
  avatar_url?: string;
}): Promise<Usuario> {
  const res = await fetchAuth('/usuarios/perfil', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar perfil');
  return res.json();
}

export async function obtenerGuardados() {
  const res = await fetchAuth('/usuarios/guardados');
  if (!res.ok) throw new Error('Error al obtener guardados');
  return res.json();
}

export async function obtenerDescargas() {
  const res = await fetchAuth('/usuarios/descargas');
  if (!res.ok) throw new Error('Error al obtener descargas');
  return res.json();
}

// ─── Libros ───────────────────────────────────────────────────────────────────
export async function obtenerLibros(filters?: {
  orden?: 'destacado' | 'nuevo' | 'descargas' | 'rating';
  categoria?: string;
  edad?: string;
  q?: string;
  pagina?: number;
  limite?: number;
}) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (key === 'limite') {
        params.append('limit', String(value));
        return;
      }
      if (key === 'pagina') {
        params.append('page', String(value));
        return;
      }
      params.append(key, String(value));
    });
  }

  const res = await fetch(`${API_URL}/libros?${params}`);
  if (!res.ok) throw new Error('Error al obtener libros');
  return res.json();
}

export async function obtenerLibro(slug: string) {
  const res = await fetch(`${API_URL}/libros/${slug}`);
  if (!res.ok) throw new Error('Libro no encontrado');
  return res.json();
}

export async function registrarDescarga(libroId: string) {
  const res = await fetchAuth(`/libros/${libroId}/descargar`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al registrar descarga');
  return res.json();
}

export async function calificarLibro(libroId: string, puntuacion: number) {
  const res = await fetchAuth(`/libros/${libroId}/valorar`, {
    method: 'POST',
    body: JSON.stringify({ puntuacion }),
  });
  if (!res.ok) throw new Error('Error al calificar');
  return res.json();
}

export async function toggleGuardado(libroId: string) {
  const res = await fetchAuth(`/libros/${libroId}/guardar`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al guardar');
  return res.json();
}

// ─── Autores ──────────────────────────────────────────────────────────────────
export async function obtenerAutores() {
  const res = await fetch(`${API_URL}/autores`);
  if (!res.ok) throw new Error('Error al obtener autores');
  return res.json();
}

export async function obtenerAutor(slug: string) {
  const res = await fetch(`${API_URL}/autores/${slug}`);
  if (!res.ok) throw new Error('Autor no encontrado');
  return res.json();
}

export async function toggleSeguirAutor(autorId: string) {
  const res = await fetchAuth(`/autores/${autorId}/seguir`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al seguir autor');
  return res.json();
}

// ─── Galería ──────────────────────────────────────────────────────────────────
export async function obtenerTestimonios(filters?: { tipo?: string; pagina?: number }) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
  }

  const res = await fetch(`${API_URL}/galeria?${params}`);
  if (!res.ok) throw new Error('Error al obtener testimonios');
  return res.json();
}

export async function crearTestimonio(data: {
  nombre_familia: string;
  texto: string;
  imagen_url?: string;
  tipo: 'testimonio' | 'foto';
}) {
  const res = await fetchAuth('/galeria', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear testimonio');
  return res.json();
}

export async function toggleLikeTestimonio(testimonioId: string) {
  const res = await fetchAuth(`/galeria/${testimonioId}/like`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Error al dar like');
  return res.json();
}

// ─── Videos ───────────────────────────────────────────────────────────────────
export async function obtenerVideos(filters?: { categoria?: string; pagina?: number }) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });
  }

  const res = await fetch(`${API_URL}/videos?${params}`);
  if (!res.ok) throw new Error('Error al obtener videos');
  return res.json();
}

export async function obtenerVideo(slug: string) {
  const res = await fetch(`${API_URL}/videos/${slug}`);
  if (!res.ok) throw new Error('Video no encontrado');
  return res.json();
}
