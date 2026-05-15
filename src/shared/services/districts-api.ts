import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { District } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.DISTRICTS;

function normId(id: string | undefined | null): string {
  return String(id ?? '').trim().toLowerCase();
}

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

export async function fetchDistrictById(id: string): Promise<District | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(String(id)));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toDistrict(res) : null;
  } catch {
    return null;
  }
}

/** POST a veces devuelve solo el id (string) o cuerpo sin `id`; sin id no se puede pinear en la tabla. */
async function resolveDistrictAfterCreate(
  params: { regionId: string; name: string },
  res: unknown
): Promise<District> {
  if (typeof res === 'string') {
    const trimmed = res.trim();
    if (trimmed) {
      const byId = await fetchDistrictById(trimmed);
      if (byId?.id) return byId;
      return toDistrict({ id: trimmed, Id: trimmed, regionId: params.regionId, name: params.name });
    }
  }
  const fromRes = toDistrict(res ?? {});
  if (fromRes.id) return fromRes;

  const list = await fetchDistricts();
  const rid = normId(params.regionId);
  const nm = params.name.trim().toLowerCase();
  const matches = list.filter((d) => normId(d.regionId) === rid && d.name.trim().toLowerCase() === nm);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return matches.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
  }
  return toDistrict({ ...(typeof res === 'object' && res != null ? res : {}), regionId: params.regionId, name: params.name });
}

export async function createDistrict(params: { regionId: string; name: string }): Promise<District> {
  const payload = {
    regionId: String(params.regionId ?? '').trim(),
    RegionId: String(params.regionId ?? '').trim(),
    name: String(params.name ?? '').trim(),
    Name: String(params.name ?? '').trim(),
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return resolveDistrictAfterCreate(params, res);
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
  const merged = toDistrict({
    ...payload,
    ...(typeof res === 'object' && res != null ? res : {}),
  });
  if (merged.id.trim()) return merged;
  return (await fetchDistrictById(id)) ?? merged;
}

export async function deleteDistrict(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(String(id)));
  await apiClient.delete(endpoint);
}

export const districtsApi = {
  fetchAll: fetchDistricts,
  getById: fetchDistrictById,
  create: createDistrict,
  update: updateDistrict,
  delete: deleteDistrict,
};
