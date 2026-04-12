import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { District } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.DISTRICTS;

function toDistrict(raw: any): District {
  return {
    id: String(raw?.id ?? raw?.Id ?? '').trim(),
    regionId: String(raw?.regionId ?? raw?.RegionId ?? '').trim(),
    name: String(raw?.name ?? raw?.Name ?? '').trim(),
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : raw?.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : raw?.UpdatedAt ? new Date(raw.UpdatedAt) : new Date(),
  };
}

export async function fetchDistricts(): Promise<District[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toDistrict);
}

export async function createDistrict(params: { regionId: string; name: string }): Promise<District> {
  const payload = {
    regionId: String(params.regionId ?? '').trim(),
    RegionId: String(params.regionId ?? '').trim(),
    name: String(params.name ?? '').trim(),
    Name: String(params.name ?? '').trim(),
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return toDistrict(res ?? payload);
}

export async function updateDistrict(id: string, params: { regionId: string; name: string }): Promise<District> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(String(id)));
  const payload = {
    id,
    Id: id,
    regionId: String(params.regionId ?? '').trim(),
    RegionId: String(params.regionId ?? '').trim(),
    name: String(params.name ?? '').trim(),
    Name: String(params.name ?? '').trim(),
  };
  const res = await apiClient.put<any>(endpoint, payload);
  return toDistrict(res ?? payload);
}

export async function deleteDistrict(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(String(id)));
  await apiClient.delete(endpoint);
}

export const districtsApi = {
  fetchAll: fetchDistricts,
  create: createDistrict,
  update: updateDistrict,
  delete: deleteDistrict,
};
