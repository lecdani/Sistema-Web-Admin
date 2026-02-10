// Configuración para la integración con backend .NET
// ============================================================
// ÚNICO LUGAR para cambiar la URL de la API:
// - Opción 1: variable de entorno NEXT_PUBLIC_API_URL (ej. en .env.local)
// - Opción 2: editar el valor por defecto aquí abajo
// ============================================================
const DEFAULT_API_URL = 'http://100.127.113.86:5107';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

const USE_PROXY = process.env.NEXT_PUBLIC_USE_API_PROXY !== 'false'; // Por defecto true

export const API_CONFIG = {
  // URL base del API (usa API_BASE_URL)
  BASE_URL: USE_PROXY ? '' : API_BASE_URL,
  // URL real del servidor (para el proxy)
  REAL_API_URL: API_BASE_URL,
  USE_PROXY,

  // Endpoints del API
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      LOGOUT: '/auth/logout',
      REFRESH: '/auth/refresh',
      FORGOT_PASSWORD: '/auth/forgot-password',
      RESET_PASSWORD: '/auth/reset-password',
      VERIFY_EMAIL: '/auth/verify-email'
    },
    USERS: {
      GET_ALL: '/users/users',
      GET_BY_ID: '/users/users/{id}',
      CREATE: '/users/users',
      UPDATE: '/users/users/{id}',
      DELETE: '/users/users/{id}',
      DEACTIVATE: '/users/users/desactivate/{id}',
      GET_PROFILE: '/users/profile',
      UPDATE_PROFILE: '/users/profile'
    },
    DASHBOARD: {
      STATS: '/dashboard/stats',
      RECENT_ACTIVITY: '/dashboard/recent-activity'
    },
    CITIES: {
      LIST: '/cities/cities',
      GET_BY_ID: '/cities/cities/{id}',
      GET_BY_NAME: '/cities/cities/by-name/{name}',
      CREATE: '/cities/cities',
      UPDATE: '/cities/cities/{id}'
    },
    STORES: {
      LIST: '/stores/stores',
      GET_BY_ID: '/stores/stores/{id}',
      GET_BY_NAME: '/stores/stores/by-name/{name}',
      CREATE: '/stores/stores',
      UPDATE: '/stores/stores/{id}',
      DEACTIVATE: '/stores/stores/deactivate/{id}',
      GET_BY_CITY: '/stores/stores/by-city/{cityId}'
    },
    PRODUCTS: {
      LIST: '/products/products',
      GET_BY_ID: '/products/products/{id}',
      GET_BY_CATEGORY: '/products/products/category/{category}',
      CREATE: '/products/products',
      UPDATE: '/products/products/{id}',
      DELETE: '/products/products/{id}'
    },
    HISTPRICES: {
      CREATE: '/histprices/histprices',
      GET_BY_PRODUCT: '/histprices/histprices/product/{productId}',
      GET_LATEST: '/histprices/histprices/latest/{productId}',
      GET_BY_DATE: '/histprices/histprices/by-date/{productId}/{date}'
    }
  },

  // Headers por defecto
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },

  // Timeout para las peticiones (en ms)
  TIMEOUT: 10000,

  // Configuración de reintentos
  RETRY: {
    attempts: 3,
    delay: 1000
  }
};

// Clase para manejo de API calls
export class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private token: string | null = null;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.defaultHeaders = API_CONFIG.DEFAULT_HEADERS;
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  clearAuthToken() {
    this.token = null;
  }

  private getHeaders(): Record<string, string> {
    const headers = { ...this.defaultHeaders };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Si usamos proxy, construir la URL con /api/proxy
    let url: string;
    if (API_CONFIG.USE_PROXY) {
      url = `/api/proxy${endpoint}`;
    } else {
      url = `${this.baseURL}${endpoint}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    };

    console.log(`[ApiClient] Realizando petición: ${config.method || 'GET'} ${url}${API_CONFIG.USE_PROXY ? ` (proxy a ${API_CONFIG.REAL_API_URL}${endpoint})` : ''}`);

    try {
      const response = await fetch(url, config);

      // Intentar parsear la respuesta como JSON
      let data: any;
      const contentType = response.headers.get('content-type');

      // Leemos el texto crudo primero para evitar errores de streaming si falla el JSON
      const text = await response.text();

      if (contentType && contentType.includes('application/json')) {
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          console.warn('[ApiClient] Error al parsear JSON, usando texto plano:', text);
          // Si el servidor dice que es JSON pero envía texto plano (ej. un ID), lo devolvemos tal cual
          data = text;
        }
      } else {
        data = text ? { message: text } : {};
      }

      if (!response.ok) {
        // Crear un error con la respuesta para que pueda ser manejado
        const error: any = new Error(data.message || `HTTP error! status: ${response.status}`);
        error.response = response;
        error.data = data;
        error.status = response.status;
        console.error(`[ApiClient] Error en respuesta: ${response.status}`, data);
        throw error;
      }

      console.log(`[ApiClient] Respuesta exitosa de ${url}`);
      return data;
    } catch (error: any) {
      // Si el error ya tiene información de respuesta, re-lanzarlo
      if (error.response) {
        throw error;
      }

      // Detectar el tipo de error de red
      let errorMessage = 'Error de conexión con el servidor';

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        // Error de red (CORS, servidor no disponible, etc.)
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = `No se pudo conectar con el servidor en ${url}. Verifica que:
            - El servidor esté corriendo
            - La URL sea correcta
            - No haya problemas de CORS
            - El firewall permita la conexión`;
        } else {
          errorMessage = `Error de red: ${error.message}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error(`[ApiClient] Error de red en ${url}:`, error);

      // Crear un error estructurado
      const networkError: any = new Error(errorMessage);
      networkError.originalError = error;
      networkError.url = url;
      networkError.isNetworkError = true;
      throw networkError;
    }
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();
