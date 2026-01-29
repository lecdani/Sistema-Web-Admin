/**
 * Servicio de API - autenticación y peticiones con token
 * Usa fetch nativo.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.0.113:5107';
const USE_PROXY = process.env.NEXT_PUBLIC_USE_API_PROXY === 'true';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const storedUser = localStorage.getItem('LoggedOrderItAppUser');
  if (!storedUser) return null;
  try {
    const user = JSON.parse(storedUser);
    return user?.token || null;
  } catch {
    return null;
  }
}

/** Peticiones autenticadas con el token guardado en localStorage */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error("No se encontró el usuario autenticado");
  }

  const defaultOptions: RequestInit = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    // Si la respuesta es 204 (No Content), no intentar parsear JSON
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message || 'Error en la petición');
  }
}

/** Login contra la API (POST /auth/login) */
export const loginService = {
  async login(credentials: { email: string; password: string }) {
    const url = USE_PROXY ? `/api/proxy/auth/login` : `${API_BASE_URL}/auth/login`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        // Intentar obtener el mensaje de error del servidor
        let errorData: any = {};
        let serverMessage = '';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
            serverMessage = errorData.message || errorData.error || errorData.title || '';
          } else {
            const text = await response.text();
            serverMessage = text || '';
          }
        } catch {
          // Si no se puede parsear, usamos mensaje por defecto según el status
        }

        // 400 Bad Request o 401 Unauthorized = credenciales incorrectas (mensaje amigable para el usuario)
        if (response.status === 400 || response.status === 401) {
          const friendlyMessage = serverMessage && serverMessage.trim() 
            ? serverMessage 
            : 'Contraseña o correo incorrectos. Verifica tus datos e intenta de nuevo.';
          throw {
            response: {
              status: response.status,
              data: errorData,
              message: friendlyMessage,
            },
            message: friendlyMessage,
          };
        }
        
        // Otros errores HTTP
        const otherMessage = serverMessage || `Error del servidor (${response.status})`;
        throw {
          response: {
            status: response.status,
            data: errorData,
            message: otherMessage,
          },
          message: otherMessage,
        };
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      // Error ya estructurado (ej. 401 credenciales incorrectas): reenviar sin loguear
      if (error?.response) {
        throw error;
      }
      // Error de red (CORS, conexión, etc.)
      if (error instanceof TypeError && error.message?.includes('fetch')) {
        throw {
          response: {
            status: 0,
            data: { message: 'Error de conexión. Verifica que el servidor esté disponible y que no haya problemas de CORS.' },
          },
          message: 'Error de conexión con el servidor',
        };
      }
      // Cualquier otro error
      throw {
        response: {
          status: 500,
          data: { message: error?.message || 'Error al conectar con el servidor' },
        },
        message: error?.message || 'Error al conectar con el servidor',
      };
    }
  },
};
