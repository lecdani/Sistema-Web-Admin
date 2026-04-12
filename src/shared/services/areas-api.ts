import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Area } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.AREAS;

function toArea(raw: any): Area {
  return {
    id: String(raw?.id ?? raw?.Id ?? '').trim(),
    name: String(raw?.name ?? raw?.Name ?? '').trim(),
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : raw?.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : raw?.UpdatedAt ? new Date(raw.UpdatedAt) : new Date(),
  };
}

export async function fetchAreas(): Promise<Area[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toArea);
}

export async function createArea(name: string): Promise<Area> {
  const payload = { name: String(name ?? '').trim(), Name: String(name ?? '').trim() };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return toArea(res ?? payload);
}

export async function updateArea(id: string, name: string): Promise<Area> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(String(id)));
  const payload = { id, Id: id, name: String(name ?? '').trim(), Name: String(name ?? '').trim() };
  const res = await apiClient.put<any>(endpoint, payload);
  return toArea(res ?? payload);
}

export async function deleteArea(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(String(id)));
  await apiClient.delete(endpoint);
}

export const areasApi = {
  fetchAll: fetchAreas,
  create: createArea,
  update: updateArea,
  delete: deleteArea,
};
