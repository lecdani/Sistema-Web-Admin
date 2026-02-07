import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { City } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.CITIES;

function toCity(raw: any): City {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    state: raw.state ?? raw.State ?? undefined,
    country: String(raw.country ?? raw.Country ?? ''),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

function toPayload(data: { name: string; state?: string; country: string }) {
  return {
    name: data.name.trim(),
    state: data.state?.trim() || '', // Safe: empty string instead of null
    country: data.country.trim()
  } as any;
}

/** Lista todas las ciudades */
export async function fetchCities(): Promise<City[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toCity);
}

/** Obtiene una ciudad por id */
export async function fetchCityById(id: string): Promise<City | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toCity(res) : null;
  } catch {
    return null;
  }
}

/** Obtiene una ciudad por nombre */
export async function fetchCityByName(name: string): Promise<City | null> {
  const endpoint = E.GET_BY_NAME.replace('{name}', encodeURIComponent(name));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toCity(res) : null;
  } catch {
    return null;
  }
}

/** Crea una ciudad */
export async function createCity(data: { name: string; state?: string; country: string }): Promise<City> {
  const res = await apiClient.post<any>(E.CREATE, toPayload(data));

  // Si devuelve un string, asumimos que es el ID (fix para backend)
  if (typeof res === 'string') {
    const fetched = await fetchCityById(res);
    if (fetched) return fetched;

    // Fallback: construir objeto con los datos que tenemos
    return {
      id: res,
      name: data.name.trim(),
      state: data.state?.trim() || undefined,
      country: data.country.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  return toCity(res);
}

/** Actualiza una ciudad */
export async function updateCity(
  id: string,
  data: { name: string; state?: string; country: string }
): Promise<City> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, ...toPayload(data) };
  console.log('[CitiesApi] Update Payload:', payload);
  const res = await apiClient.put<any>(endpoint, payload);

  if (typeof res === 'string') {
    const fetched = await fetchCityById(id); // Usamos el ID original o el nuevo si cambiara
    if (fetched) return fetched;

    return {
      id,
      name: data.name.trim(),
      state: data.state?.trim() || undefined,
      country: data.country.trim(),
      createdAt: new Date(), // Esto no es ideal pero es fallback
      updatedAt: new Date()
    };
  }

  return toCity(res);
}

export const citiesApi = {
  fetchAll: fetchCities,
  getById: fetchCityById,
  getByName: fetchCityByName,
  create: createCity,
  update: updateCity
};
