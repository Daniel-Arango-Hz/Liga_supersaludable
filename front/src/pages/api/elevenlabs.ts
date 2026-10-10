import { env } from 'node:process';

const API_URL = (
  import.meta.env.API_URL
  || env.API_URL
  || import.meta.env.PUBLIC_API_URL
  || ''
).replace(/\/+$/, '');
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v2/voices';

async function authorizeAdmin(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Inicia sesión como administrador para crear un audiolibro.' }, { status: 401 });
  }

  if (!API_URL) {
    console.error('Falta configurar API_URL para validar la sesión de audiolibros.');
    return Response.json({ error: 'Falta configurar API_URL en el entorno del servidor.' }, { status: 503 });
  }

  try {
    const response = await fetch(`${API_URL}/usuarios/perfil`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401 || response.status === 403) {
      return Response.json({ error: 'Tu sesión expiró. Inicia sesión nuevamente.' }, { status: 401 });
    }
    if (!response.ok) {
      console.error(`No se pudo validar la sesión de audiolibros (status ${response.status}).`);
      return Response.json({ error: 'No se pudo validar tu sesión. Intenta de nuevo.' }, { status: 502 });
    }
    const profile = await response.json();
    if (profile?.tipo !== 'admin') {
      return Response.json({ error: 'Solo los administradores pueden crear audiolibros.' }, { status: 403 });
    }
    return null;
  } catch (error) {
    console.error('No se pudo conectar con el servicio de autenticación:', error);
    return Response.json({ error: 'No se pudo validar tu sesión. Intenta de nuevo.' }, { status: 502 });
  }
}

function getApiKey(): string | null {
  const apiKey = (import.meta.env.ELEVENLABS_API_KEY ?? env.ELEVENLABS_API_KEY)?.trim();
  return apiKey || null;
}

export async function GET({ request }: { request: Request }) {
  const authError = await authorizeAdmin(request);
  if (authError) return authError;

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Falta configurar ELEVENLABS_API_KEY en el entorno del servidor.');
    return Response.json({ error: 'Falta configurar ELEVENLABS_API_KEY en el entorno del servidor.' }, { status: 503 });
  }

  try {
    const url = new URL(ELEVENLABS_API_URL);
    url.searchParams.set('page_size', '100');
    url.searchParams.set('include_total_count', 'false');

    const response = await fetch(url, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`ElevenLabs no pudo listar voces (status ${response.status}).`);
      if (response.status === 401 || response.status === 403) {
        return Response.json(
          { error: 'ElevenLabs rechazó la clave del servidor. Revisa ELEVENLABS_API_KEY.' },
          { status: 503 },
        );
      }
      return Response.json({ error: 'No se pudieron cargar las voces de ElevenLabs.' }, { status: 502 });
    }

    const payload = await response.json();
    const voices = Array.isArray(payload.voices)
      ? payload.voices
          .filter((voice: { voice_id?: unknown; name?: unknown }) =>
            typeof voice.voice_id === 'string' && typeof voice.name === 'string',
          )
          .map((voice: {
            voice_id: string;
            name: string;
            labels?: Record<string, unknown>;
          }) => {
            const languages = voice.labels?.language;
            return {
              voice_id: voice.voice_id,
              name: voice.name,
              accent: typeof voice.labels?.accent === 'string' ? voice.labels.accent : '',
              language: Array.isArray(languages)
                ? languages.filter((language): language is string => typeof language === 'string').join(', ')
                : typeof languages === 'string' ? languages : '',
            };
          })
      : [];

    return Response.json({ voices }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (error) {
    console.error('No se pudieron cargar las voces de ElevenLabs:', error);
    return Response.json({ error: 'No se pudieron cargar las voces de ElevenLabs.' }, { status: 502 });
  }
}

export async function POST({ request }: { request: Request }) {
  const authError = await authorizeAdmin(request);
  if (authError) return authError;

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('Falta configurar ELEVENLABS_API_KEY en el entorno del servidor.');
    return Response.json({ error: 'Falta configurar ELEVENLABS_API_KEY en el entorno del servidor.' }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'La solicitud debe contener JSON válido.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return Response.json({ error: 'La solicitud no es válida.' }, { status: 400 });
  }

  const { text, voiceId, previousText, nextText } = payload as Record<string, unknown>;
  if (typeof text !== 'string' || !text.trim() || text.length > 4500) {
    return Response.json({ error: 'El fragmento debe contener entre 1 y 4500 caracteres.' }, { status: 400 });
  }
  if (typeof voiceId !== 'string' || !/^[\w-]{1,100}$/.test(voiceId)) {
    return Response.json({ error: 'Selecciona una voz válida.' }, { status: 400 });
  }
  if (
    (previousText !== undefined && (typeof previousText !== 'string' || previousText.length > 300)) ||
    (nextText !== undefined && (typeof nextText !== 'string' || nextText.length > 300))
  ) {
    return Response.json({ error: 'El contexto de voz no es válido.' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          ...(previousText ? { previous_text: previousText } : {}),
          ...(nextText ? { next_text: nextText } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      },
    );

    if (!response.ok) {
      console.error(`ElevenLabs no pudo generar el audio (status ${response.status}).`);
      const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 503 : 502;
      const message = status === 429
        ? 'Se alcanzó un límite o faltan créditos en ElevenLabs.'
        : response.status === 401
          ? 'ElevenLabs rechazó la clave API. Comprueba ELEVENLABS_API_KEY en el servidor y reinícialo.'
          : response.status === 403
            ? 'ElevenLabs denegó la generación. Comprueba los permisos de síntesis de la clave y el acceso a la voz seleccionada.'
          : 'ElevenLabs no pudo generar este fragmento.';
      return Response.json({ error: message }, { status });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Falló la solicitud de generación de audio a ElevenLabs:', error);
    return Response.json({ error: 'No se pudo conectar con ElevenLabs. Intenta de nuevo.' }, { status: 502 });
  }
}
