import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Brand } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.BRANDS;

function toBrand(raw: any): Brand {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
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
  return res ? toBrand(res) : toBrand({ id: '', ...payload });
}

/** Actualiza una marca */
export async function updateBrand(id: string, data: { name: string }): Promise<Brand> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, name: (data.name ?? '').trim(), Name: (data.name ?? '').trim() };
  const res = await apiClient.put<any>(endpoint, payload);
  if (res) return toBrand(res);
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
