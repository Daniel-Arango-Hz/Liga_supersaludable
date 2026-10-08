const API_URL = import.meta.env.PUBLIC_API_URL || import.meta.env.API_URL || 'http://localhost:3000/api';

export async function GET({ params, request }) {
  const { slug } = params;
  const authHeader = request.headers.get('Authorization');

  const headers = {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const response = await fetch(`${API_URL}/autores/${encodeURIComponent(slug)}`, {
    method: 'GET',
    headers,
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
