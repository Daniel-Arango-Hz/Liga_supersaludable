const API_URL = import.meta.env.API_URL ?? 'http://localhost:3000/api';

// Descargar libro
export async function POST({ request }) {
  try {
    const { libroSlug } = await request.json();

    if (!libroSlug) {
      return new Response(JSON.stringify({ error: 'libroSlug requerido' }), { status: 400 });
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

    console.log(`[descargar] Calling backend: POST ${API_URL}/libros/${libroSlug}/descargar`);

    // Registrar la descarga en el backend
    const response = await fetch(`${API_URL}/libros/${libroSlug}/descargar`, {
      method: 'POST',
      headers,
      timeout: 10000
    });

    console.log(`[descargar] Backend response status:`, response.status);

    if (response.status === 204 || response.status === 200) {
      const responseText = await response.text();
      console.log(`[descargar] Response body:`, responseText);

      if (!responseText || responseText.trim() === '') {
        // Empty response, use default PDF URL
        console.log('[descargar] Empty response, using default PDF URL');
        return new Response(
          JSON.stringify({
            pdfUrl: `/pdfs/${libroSlug}.pdf`,
            success: true,
          }),
          { status: 200 }
        );
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[descargar] Failed to parse JSON:', responseText);
        return new Response(
          JSON.stringify({ error: 'Invalid JSON from backend', details: responseText }),
          { status: 500 }
        );
      }

      // Retornar la URL del PDF desde el backend
      return new Response(
        JSON.stringify({
          pdfUrl: data.pdfUrl || `/pdfs/${libroSlug}.pdf`,
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
    console.log(`[descargar] Error response:`, errorText);

    return new Response(
      JSON.stringify({ error: `Backend error: ${response.status}`, details: errorText }),
      { status: response.status }
    );
  } catch (error) {
    console.error('[descargar] Unexpected error:', error, error.message);
    return new Response(
      JSON.stringify({ error: 'Error al descargar', details: String(error) }),
      { status: 500 }
    );
  }
}
