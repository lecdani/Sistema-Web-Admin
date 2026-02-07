import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/shared/config/api';

// Forzar renderizado dinámico para el proxy
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, 'PATCH');
}

export async function OPTIONS() {
  // Manejar preflight de CORS
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleProxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    // Construir la ruta del endpoint
    const path = Array.isArray(params.path) ? params.path.join('/') : params.path;

    // Construir la URL completa
    // Si API_BASE_URL termina con /api, no agregar otro /api
    // Si no, usar directamente (el usuario puede configurar la URL completa)
    let url: string;
    if (API_BASE_URL.endsWith('/api')) {
      // Ya tiene /api, usar directamente
      url = `${API_BASE_URL}/${path}`;
    } else {
      // Usar directamente (el usuario debe configurar la URL completa con o sin /api)
      url = `${API_BASE_URL}/${path}`;
    }

    // Obtener los query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    console.log(`[API Proxy] Path recibido:`, path);
    console.log(`[API Proxy] API_BASE_URL:`, API_BASE_URL);
    console.log(`[API Proxy] URL construida: ${fullUrl}`);

    // Obtener el body si existe
    let body: string | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        body = await request.text();
      } catch {
        // Si no hay body, está bien
      }
    }

    // Obtener headers relevantes
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Copiar el header de autorización si existe
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    console.log(`[API Proxy] ${method} ${fullUrl}`);

    // Hacer la petición al servidor real
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body || undefined,
    });

    // Si es 204 No Content, retornar inmediatamente sin leer body
    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Obtener la respuesta
    const contentType = response.headers.get('content-type');
    let data: any;

    // Leemos como texto primero para evitar errores
    const text = await response.text();

    if (contentType && contentType.includes('application/json')) {
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = text;
      }
    } else {
      data = text;
    }

    // Retornar la respuesta con los mismos headers de CORS
    // Si la respuesta no es JSON, retornarla como texto
    if (typeof data === 'string') {
      return new NextResponse(data, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Error al conectar con el servidor',
        error: 'Proxy error'
      },
      { status: 500 }
    );
  }
}
