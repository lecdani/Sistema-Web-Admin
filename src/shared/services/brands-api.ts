import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Brand } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.BRANDS;

function toBrand(raw: any): Brand {
  // Asegurar un id no vacío para evitar keys `` duplicadas en React
  let idValue =
    raw?.id ??
    raw?.Id ??
    raw?.name ??
    raw?.Name ??
    null;

  if (idValue == null || String(idValue).trim() === '') {
    idValue = `temp-${Math.random().toString(36).slice(2, 10)}`;
  }

  return {
    id: String(idValue),
    name: String(raw.name ?? raw.Name ?? '').trim() || 'Marca',
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

/** Lista todas las marcas */
export async function fetchBrands(): Promise<Brand[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toBrand);
}

/** Obtiene una marca por id */
export async function fetchBrandById(id: string): Promise<Brand | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toBrand(res) : null;
  } catch {
    return null;
  }
}

/** Crea una marca */
export async function createBrand(data: { name: string }): Promise<Brand> {
  const payload = { name: (data.name ?? '').trim() || 'Marca', Name: (data.name ?? '').trim() || 'Marca' };
  const res = await apiClient.post<any>(E.CREATE, payload);

  // Algunos backends devuelven solo el id o un objeto sin nombre.
  // Aseguramos que el Brand resultante siempre tenga el nombre que el usuario escribió.
  if (res) {
    const raw = { ...res };
    if (!raw.name && !raw.Name) {
      raw.name = payload.name;
      raw.Name = payload.Name;
    }
    return toBrand(raw);
  }

  // Si el backend no devuelve nada, crear una marca temporal con id único
  return toBrand({ id: `temp-${Math.random().toString(36).slice(2, 10)}`, ...payload });
}

/** Actualiza una marca */
export async function updateBrand(id: string, data: { name: string }): Promise<Brand> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, name: (data.name ?? '').trim(), Name: (data.name ?? '').trim() };
  const res = await apiClient.put<any>(endpoint, payload);
  if (res) {
    const raw = { ...res };
    if (!raw.name && !raw.Name) {
      raw.name = payload.name;
      raw.Name = payload.Name;
    }
    return toBrand(raw);
  }
  const fetched = await fetchBrandById(id);
  return fetched ?? toBrand({ id, name: data.name, isActive: true, createdAt: new Date(), updatedAt: new Date() });
}

/** Activa/desactiva una marca (mismo endpoint toggle) */
export async function toggleBrandActive(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.put(endpoint, { id });
}

export const brandsApi = {
  fetchAll: fetchBrands,
  getById: fetchBrandById,
  create: createBrand,
  update: updateBrand,
  toggleActive: toggleBrandActive
};
