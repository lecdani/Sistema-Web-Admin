import { NextRequest, NextResponse } from 'next/server';

// Forzar renderizado dinámico para el proxy
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.0.113:5107';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'PATCH');
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
    
    // Obtener la respuesta
    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
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
