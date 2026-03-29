import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { SalesRoute } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.SALES_ROUTES;

function toSalesRoute(raw: any): SalesRoute | null {
  const id = String(raw?.id ?? raw?.Id ?? '').trim();
  const name = String(raw?.name ?? raw?.Name ?? '').trim();
  if (!id || !name) return null;
  const cityId = String(raw?.cityId ?? raw?.CityId ?? raw?.city_id ?? '').trim();
  const isActive =
    typeof raw?.isActive === 'boolean'
      ? raw.isActive
      : typeof raw?.IsActive === 'boolean'
        ? raw.IsActive
        : true;
  return {
    id,
    name,
    cityId,
    code: (() => {
      const v =
        raw?.code ??
        raw?.Code ??
        raw?.routeCode ??
        raw?.RouteCode ??
        raw?.salesRouteCode ??
        raw?.SalesRouteCode ??
        raw?.route_code ??
        raw?.Route_Code;
      if (v == null || String(v).trim() === '') return undefined;
      return String(v).trim();
    })(),
    isActive,
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : raw?.CreatedAt ? new Date(raw.CreatedAt) : undefined,
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : raw?.UpdatedAt ? new Date(raw.UpdatedAt) : undefined,
  };
}

function normalizeList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  if (res?.items && Array.isArray(res.items)) return res.items;
  if (res?.value && Array.isArray(res.value)) return res.value;
  if (res?.Results && Array.isArray(res.Results)) return res.Results;
  if (res && typeof res === 'object') {
    for (const v of Object.values(res)) {
      if (Array.isArray(v)) return v as any[];
    }
  }
  return [];
}

export const salesRoutesApi = {
  async fetchAll(): Promise<SalesRoute[]> {
    const raw = await apiClient.get<any>(E.LIST);
    const list = normalizeList(raw);
    return list.map(toSalesRoute).filter((r): r is SalesRoute => r != null);
  },

  async getById(id: string): Promise<SalesRoute | null> {
    const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
    try {
      const res = await apiClient.get<any>(endpoint);
      return res ? toSalesRoute(res) : null;
    } catch {
      return null;
    }
  },

  async create(params: { name: string; cityId: string }): Promise<SalesRoute | null> {
    const name = String(params.name ?? '').trim();
    const cityId = String(params.cityId ?? '').trim();
    if (!name || !cityId) return null;
    const body = { name, cityId, Name: name, CityId: cityId };
    const res = await apiClient.post<any>(E.CREATE, body);
    if (res == null) return null;
    return toSalesRoute(res) ?? null;
  },

  async update(params: { id: string; name: string; cityId: string }): Promise<SalesRoute | null> {
    const id = String(params.id ?? '').trim();
    if (!id) return null;
    const body = {
      id,
      name: String(params.name ?? '').trim(),
      cityId: String(params.cityId ?? '').trim(),
      Name: String(params.name ?? '').trim(),
      CityId: String(params.cityId ?? '').trim(),
    };
    const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
    const res = await apiClient.put<any>(endpoint, body);
    if (res == null) return (await this.getById(id)) ?? null;
    return toSalesRoute(res) ?? (await this.getById(id));
  },

  async remove(id: string): Promise<void> {
    const endpoint = E.DELETE.replace('{id}', encodeURIComponent(String(id).trim()));
    await apiClient.delete(endpoint);
  },

  async toggleStatus(id: string): Promise<void> {
    const endpoint = E.TOGGLE_STATUS.replace('{id}', encodeURIComponent(String(id).trim()));
    await apiClient.patch(endpoint, {});
  },
};
