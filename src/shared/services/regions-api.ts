import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Region } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.REGIONS;

function toRegion(raw: any): Region {
  return {
    id: String(raw?.id ?? raw?.Id ?? '').trim(),
    areaId: String(raw?.areaId ?? raw?.AreaId ?? '').trim(),
    name: String(raw?.name ?? raw?.Name ?? '').trim(),
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : raw?.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : raw?.UpdatedAt ? new Date(raw.UpdatedAt) : new Date(),
  };
}

export async function fetchRegions(): Promise<Region[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toRegion);
}

export async function createRegion(params: { areaId: string; name: string }): Promise<Region> {
  const payload = {
    areaId: String(params.areaId ?? '').trim(),
    AreaId: String(params.areaId ?? '').trim(),
    name: String(params.name ?? '').trim(),
    Name: String(params.name ?? '').trim(),
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return toRegion(res ?? payload);
}

export async function updateRegion(id: string, params: { areaId: string; name: string }): Promise<Region> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(String(id)));
  const payload = {
    id,
    Id: id,
    areaId: String(params.areaId ?? '').trim(),
    AreaId: String(params.areaId ?? '').trim(),
    name: String(params.name ?? '').trim(),
    Name: String(params.name ?? '').trim(),
  };
  const res = await apiClient.put<any>(endpoint, payload);
  return toRegion(res ?? payload);
}

export async function deleteRegion(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(String(id)));
  await apiClient.delete(endpoint);
}

export const regionsApi = {
  fetchAll: fetchRegions,
  create: createRegion,
  update: updateRegion,
  delete: deleteRegion,
};
