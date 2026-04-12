// Configuración para la integración con backend .NET
// ============================================================
// ÚNICO LUGAR para cambiar la URL de la API:
// - Opción 1: variable de entorno NEXT_PUBLIC_API_URL (ej. en .env.local)
// - Opción 2: editar el valor por defecto aquí abajo
// ============================================================
const DEFAULT_API_URL = 'http://100.127.113.86:5107';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

const USE_PROXY = process.env.NEXT_PUBLIC_USE_API_PROXY !== 'false'; // Por defecto true

/** URL para mostrar imágenes del backend (POD, etc.). Si usas proxy, carga por proxy para evitar CORS. Acepta null/undefined (la API puede devolver null si la imagen falló). */
export function getBackendAssetUrl(path: string | null | undefined): string {
  if (!path || path.startsWith('data:') || path.startsWith('http')) return path ?? '';
  const base = USE_PROXY ? '/api/proxy' : API_BASE_URL.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}

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
      VERIFY_EMAIL: '/auth/verify-email',
      CHANGE_PASSWORD: '/auth/change-password',
      /** Admin: actualizar contraseña de otro usuario (IdentityUserId + nueva contraseña). */
      UPDATE_USER_PASSWORD: '/auth/admin/update-user-password'
    },
    USERS: {
      GET_ALL: '/users/users',
      GET_BY_ID: '/users/users/{id}',
      CREATE: '/users/users',
      UPDATE: '/users/users/{id}',
      ASSIGN_ROUTE: '/users/users/{id}/assign-route',
      DELETE: '/users/users/{id}',
      DEACTIVATE: '/users/users/desactivate/{id}',
      GET_PROFILE: '/users/profile',
      UPDATE_PROFILE: '/users/profile'
    },
    DASHBOARD: {
      STATS: '/dashboard/stats',
      RECENT_ACTIVITY: '/dashboard/recent-activity'
    },
    UTILITIES: {
      /** Enumerado de estado (US) para crear/editar ciudad. */
      STATES: '/utilities/states',
    },
    CITIES: {
      LIST: '/cities/cities',
      GET_BY_ID: '/cities/cities/{id}',
      GET_BY_NAME: '/cities/cities/by-name/{name}',
      CREATE: '/cities/cities',
      UPDATE: '/cities/cities/{id}'
    },
    AREAS: {
      LIST: '/areas/areas',
      GET_BY_ID: '/areas/areas/{id}',
      CREATE: '/areas/areas',
      UPDATE: '/areas/areas/{id}',
      DELETE: '/areas/areas/{id}',
    },
    REGIONS: {
      LIST: '/regions/regions',
      GET_BY_ID: '/regions/regions/{id}',
      CREATE: '/regions/regions',
      UPDATE: '/regions/regions/{id}',
      DELETE: '/regions/regions/{id}',
    },
    DISTRICTS: {
      LIST: '/districts/districts',
      GET_BY_ID: '/districts/districts/{id}',
      CREATE: '/districts/districts',
      UPDATE: '/districts/districts/{id}',
      DELETE: '/districts/districts/{id}',
    },
    STORES: {
      LIST: '/stores/stores',
      GET_BY_ID: '/stores/stores/{id}',
      CREATE: '/stores/stores',
      UPDATE: '/stores/stores/{id}',
      DEACTIVATE: '/stores/stores/deactivate/{id}',
      GET_BY_CITY: '/stores/stores/by-city/{cityId}',
      GET_BY_DISTRICT: '/stores/stores/by-district/{districtId}',
    },
    PRODUCTS: {
      LIST: '/products/products',
      GET_BY_ID: '/products/products/{id}',
      GET_BY_BRAND: '/products/products/brand/{brandId}',
      CREATE: '/products/products',
      UPDATE: '/products/products/{id}',
      DELETE: '/products/products/{id}',
      DEACTIVATE: '/products/products/{id}/deactivate'
    },
    BRANDS: {
      LIST: '/brands/brands',
      GET_BY_ID: '/brands/brands/{id}',
      CREATE: '/brands/brands',
      UPDATE: '/brands/brands/{id}',
      DEACTIVATE: '/brands/brands/desactivate/{id}'
    },
    CLASSES: {
      LIST: '/classes/classes',
      GET_BY_ID: '/classes/classes/{id}',
      CREATE: '/classes/classes',
      UPDATE: '/classes/classes/{id}',
      DELETE: '/classes/classes/{id}',
      DEACTIVATE: '/classes/classes/desactivate/{id}'
    },
    FAMILIES: {
      LIST: '/families/families',
      GET_BY_ID: '/families/families/{id}',
      CREATE: '/families/families',
      UPDATE: '/families/families/{id}',
      DELETE: '/families/families/{id}',
      DEACTIVATE: '/families/families/desactivate/{id}'
    },
    PRESENTATIONS: {
      LIST: '/presentations/presentations',
      GET_BY_ID: '/presentations/presentations/{id}',
      CREATE: '/presentations/presentations',
      UPDATE: '/presentations/presentations/{id}',
      DELETE: '/presentations/presentations/{id}',
      TOGGLE_STATUS: '/presentations/presentations/{id}/toggle-status'
    },
    HISTPRICES: {
      CREATE: '/histprices/histprices',
      /** Historial por presentación; el cliente deriva el “último” ordenando por startDate (evita GET /latest/ que a veces no existe en el API). */
      GET_BY_PRESENTATION: '/histprices/histprices/presentation/{presentationId}',
      /** Opcional en backend; el admin no lo usa si prefieres solo GET_BY_PRESENTATION. */
      GET_LATEST: '/histprices/histprices/latest/{presentationId}',
      GET_BY_DATE: '/histprices/histprices/by-date/{presentationId}/{date}',
    },
    PLANOGRAMS: {
      LIST: '/planograms/planograms',
      GET_BY_ID: '/planograms/planograms/{id}',
      CREATE: '/planograms/planograms',
      UPDATE: '/planograms/planograms/{id}',
      DELETE: '/planograms/planograms/{id}',
      DEACTIVATE: '/planograms/planograms/desactivate/{id}'
    },
    DISTRIBUTIONS: {
      LIST_BY_PLANOGRAM: '/distributions/distributions/planogram/{id}',
      CREATE: '/distributions/distributions',
      UPDATE: '/distributions/distribution/{id}',
      DELETE: '/distributions/distributions/{id}',
      /** Algunos backends solo exponen la ruta plural; otros la singular (como UPDATE). */
      DEACTIVATE: '/distributions/distributions/desactivate/{id}',
      DEACTIVATE_SINGULAR: '/distributions/distribution/desactivate/{id}'
    },
    IMAGES: {
      UPLOAD: '/images/upload',
      URL: '/images/url/{fileName}'
    },
    ASSIGNMENTS: {
      LIST: '/assignments/assignments',
      CREATE: '/assignments/assignments',
      DELETE: '/assignments/assignments/{id}'
    },
    SALES_ROUTES: {
      LIST: '/salesRoutes',
      GET_BY_ID: '/salesRoutes/{id}',
      CREATE: '/salesRoutes',
      UPDATE: '/salesRoutes/{id}',
      DELETE: '/salesRoutes/{id}',
      TOGGLE_STATUS: '/salesRoutes/{id}/toggle-status'
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

  private emitCrudToast(message: string) {
    if (typeof window === 'undefined') return;
    const text = String(message ?? '').trim();
    if (!text) return;
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: text, type: 'error' },
      })
    );
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
    const method = String(config.method || 'GET').toUpperCase();
    const isCrudWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

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
          const isSilentEndpoint =
            endpoint === API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD ||
            endpoint === API_CONFIG.ENDPOINTS.AUTH.UPDATE_USER_PASSWORD ||
            endpoint === API_CONFIG.ENDPOINTS.USERS.GET_PROFILE ||
            endpoint === API_CONFIG.ENDPOINTS.USERS.UPDATE_PROFILE;
          const trimmed = (text || '').trim();
          // Si el backend devuelve un valor simple (Guid, número, texto plano), tratarlo como tal
          const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
          if (trimmed && (guidRegex.test(trimmed))) {
            // Valor tipo Guid: úsalo directamente y no hagas ruido en consola
            data = trimmed;
          } else {
            if (!isSilentEndpoint) {
              console.warn('[ApiClient] Error al parsear JSON, usando texto plano:', text);
            }
            data = typeof text === 'string' && text ? { message: text } : {};
          }
        }
      } else {
        // Respuesta no JSON: devolver el texto tal cual (útil para ids simples, Guids, etc.)
        const trimmed = (text || '').trim();
        data = trimmed || '';
      }

      if (!response.ok) {
        // Crear un error con la respuesta para que pueda ser manejado
        const error: any = new Error(data.message || `HTTP error! status: ${response.status}`);
        error.response = response;
        error.data = data;
        error.status = response.status;

        // No loguear errores de endpoints de perfil, cambio de contraseña o 404 esperados
        const isProfileEndpoint =
          endpoint === API_CONFIG.ENDPOINTS.USERS.GET_PROFILE ||
          endpoint === API_CONFIG.ENDPOINTS.USERS.UPDATE_PROFILE;
        const isChangePasswordEndpoint =
          endpoint === API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD ||
          endpoint === API_CONFIG.ENDPOINTS.AUTH.UPDATE_USER_PASSWORD;
        /** Sin precio / sin historial: el backend suele responder 404; el front trata como null o []. */
        const histLatestPrefix = API_CONFIG.ENDPOINTS.HISTPRICES.GET_LATEST.replace('{presentationId}', '');
        const histPresentationPrefix = API_CONFIG.ENDPOINTS.HISTPRICES.GET_BY_PRESENTATION.replace(
          '{presentationId}',
          ''
        );
        const histByDatePrefix = API_CONFIG.ENDPOINTS.HISTPRICES.GET_BY_DATE.split('{presentationId}')[0] ?? '';
        const isHistPriceOptional404 =
          response.status === 404 &&
          (endpoint.startsWith(histLatestPrefix) ||
            endpoint.startsWith(histPresentationPrefix) ||
            (histByDatePrefix && endpoint.startsWith(histByDatePrefix)));
        const isOrdersByUserEndpoint =
          endpoint.startsWith('/orders/orders/user/');
        /** Sin factura / sin datos / ruta aún no desplegada: el front trata como lista vacía. */
        const isOrderDiscrepanciesEndpoint =
          endpoint.includes('/orders/orders/dicrepancies/') ||
          endpoint.includes('/orders/dicrepancies/') ||
          endpoint.includes('/orders/orders/discrepancies/') ||
          endpoint.includes('/orders/discrepancies/');
        /** Rutas de baja de distribución: a veces no existen y el front hace fallback por PUT update. */
        const isDistributionDesactivate404 =
          response.status === 404 &&
          endpoint.includes('/distributions/') &&
          /desactiv|deactiv/i.test(endpoint);
        const isUtilitiesStatesOptional404 =
          response.status === 404 && endpoint === API_CONFIG.ENDPOINTS.UTILITIES.STATES;
        const isExpected404 =
          response.status === 404 &&
          (isProfileEndpoint ||
            endpoint.startsWith('/users/users/') ||
            isHistPriceOptional404 ||
            isOrdersByUserEndpoint ||
            isOrderDiscrepanciesEndpoint ||
            isDistributionDesactivate404 ||
            isUtilitiesStatesOptional404);

        if (!isExpected404 && !isProfileEndpoint && !isChangePasswordEndpoint) {
          console.error(`[ApiClient] Error en respuesta: ${response.status}`, data);
        }
        if (isCrudWrite && !isExpected404 && !isChangePasswordEndpoint) {
          this.emitCrudToast(
            String(data?.message || data?.title || `No se pudo completar la operación (${response.status}).`)
          );
        }

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
      const isChangePasswordEndpoint =
        endpoint === API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD ||
        endpoint === API_CONFIG.ENDPOINTS.AUTH.UPDATE_USER_PASSWORD;
      if (isCrudWrite && !isChangePasswordEndpoint) {
        this.emitCrudToast(errorMessage);
      }

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

  /** POST con FormData (para upload de archivos). No envía Content-Type para que el navegador ponga multipart/form-data con boundary. */
  async postFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    let url: string;
    if (API_CONFIG.USE_PROXY) {
      url = `/api/proxy${endpoint}`;
    } else {
      url = `${this.baseURL}${endpoint}`;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });
    const text = await response.text();
    let data: any = text || {};
    const ct = response.headers.get('content-type') || '';
    if (text && (ct.includes('application/json') || (text.trim().startsWith('{') && text.trim().endsWith('}')))) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const err: any = new Error(data?.message || `HTTP ${response.status}`);
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data as T;
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /** PUT con JSON ya serializado (payload exacto para DTO .NET). */
  async putBody<T = any>(endpoint: string, jsonBody: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: jsonBody
    });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();
