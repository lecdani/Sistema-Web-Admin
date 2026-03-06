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

    // Para multipart/form-data (upload de archivos) reenviar body y Content-Type tal cual
    const contentType = request.headers.get('content-type') ?? '';
    const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data');

    let body: string | ArrayBufferView | Blob | FormData | ReadableStream | null | undefined;
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (method !== 'GET' && method !== 'DELETE') {
      if (isMultipart) {
        body = request.body;
        headers['Content-Type'] = contentType;
      } else {
        try {
          const textBody = await request.text();
          body = textBody || undefined;
          if (textBody) headers['Content-Type'] = 'application/json';
        } catch {
          body = undefined;
        }
      }
    } else {
      body = undefined;
    }

    if (!isMultipart) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    console.log(`[API Proxy] ${method} ${fullUrl}${isMultipart ? ' (multipart)' : ''}`);

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body ?? undefined,
      duplex: isMultipart ? 'half' : undefined,
    } as RequestInit);

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
    const responseContentType = response.headers.get('content-type');
    let data: any;

    // Leemos como texto primero para evitar errores
    const text = await response.text();

    if (responseContentType && responseContentType.includes('application/json')) {
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
          'Content-Type': responseContentType || 'text/plain',
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
