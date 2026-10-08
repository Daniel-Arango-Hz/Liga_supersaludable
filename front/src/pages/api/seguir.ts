const API_URL = import.meta.env.PUBLIC_API_URL ?? import.meta.env.API_URL ?? 'http://localhost:3000/api';

// Seguir/Dejar de seguir autor
export async function POST({ request }) {
  try {
    const { autorId } = await request.json();

    if (!autorId) {
      return new Response(JSON.stringify({ error: 'autorId requerido' }), { status: 400 });
    }

    // Obtener el token del header de la solicitud
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Requiere autenticación', requiresAuth: true }),
        { status: 401 }
      );
    }

    // Headers para enviar al backend
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'FamiliaLee-Frontend/1.0',
    };

    console.log(`[seguir] Calling backend: POST ${API_URL}/autores/${autorId}/seguir`);

    // Llamar al backend para seguir/dejar de seguir
    const response = await fetch(`${API_URL}/autores/${autorId}/seguir`, {
      method: 'POST',
      headers,
    });

    console.log(`[seguir] Backend response status:`, response.status);

    if (response.status === 204 || response.status === 200) {
      const responseText = await response.text();
      console.log(`[seguir] Response body:`, responseText);

      if (!responseText || responseText.trim() === '') {
        // Empty response, assume following status toggled
        console.log('[seguir] Empty response treated as success');
        return new Response(
          JSON.stringify({ siguiendo: true, success: true }),
          { status: 200 }
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[seguir] Failed to parse JSON:', responseText);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON from backend', details: responseText }),
          { status: 500 }
        );
      }

      const totalSeguidores = data.total_seguidores;
      return new Response(
        JSON.stringify({
          siguiendo: data.siguiendo !== false,
          total_seguidores: typeof totalSeguidores === 'number' || typeof totalSeguidores === 'string'
            ? Number(totalSeguidores)
            : undefined,
          success: true,
        }),
        { status: 200 }
      );
    }

    // Handle error responses
    if (response.status === 401) {
      return new Response(
        JSON.stringify({ error: 'Token inválido', requiresAuth: true }),
        { status: 401 }
      );
    }

    const errorText = await response.text();
    console.log(`[seguir] Error response:`, errorText);

    return new Response(
      JSON.stringify({ error: `Backend error: ${response.status}`, details: errorText }),
      { status: response.status }
    );
  } catch (error) {
    console.error('[seguir] Unexpected error:', error, error.message);
    return new Response(
      JSON.stringify({ error: 'Error al seguir', details: String(error) }),
      { status: 500 }
    );
  }
}
