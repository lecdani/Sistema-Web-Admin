import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Assignment } from '@/shared/types';
import { getLoggedUser } from '@/shared/utils/auth';

function toAssignment(raw: any): Assignment | null {
  const id = String(raw?.id ?? raw?.Id ?? raw?.assignmentId ?? raw?.AssignmentId ?? '').trim();
  const userId = String(
    raw?.userId ??
      raw?.UserId ??
      raw?.salespersonId ??
      raw?.SalespersonId ??
      raw?.salesperson_id ??
      raw?.Salesperson_Id ??
      raw?.salesperson ??
      raw?.Salesperson ??
      ''
  ).trim();
  const salesRouteId = String(
    raw?.routeId ??
      raw?.RouteId ??
      raw?.route_id ??
      raw?.Route_Id ??
      raw?.salesRouteId ??
      raw?.SalesRouteId ??
      raw?.sales_route_id ??
      raw?.Sales_Route_Id ??
      raw?.salesRoute?.id ??
      raw?.SalesRoute?.Id ??
      ''
  ).trim();
  const storeId = String(raw?.storeId ?? raw?.StoreId ?? '').trim();
  if (!storeId) return null;
  if (!userId && !salesRouteId) return null;
  const syntheticId =
    id ||
    (salesRouteId ? `${salesRouteId}::${storeId}` : userId ? `${userId}::${storeId}` : storeId);
  return {
    id: syntheticId,
    userId: userId || undefined,
    storeId,
    salesRouteId: salesRouteId || undefined,
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : raw?.CreatedAt ? new Date(raw.CreatedAt) : undefined,
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

export const assignmentsApi = {
  async fetchAll(): Promise<Assignment[]> {
    const raw = await apiClient.get<any>(API_CONFIG.ENDPOINTS.ASSIGNMENTS.LIST);
    const list = normalizeList(raw);
    return list.map(toAssignment).filter((a): a is Assignment => a != null);
  },

  async fetchByUser(userId: string, salesRouteId?: string): Promise<Assignment[]> {
    const uid = String(userId ?? '').trim();
    const rid = String(salesRouteId ?? '').trim();
    if (!uid && !rid) return [];
    const all = await this.fetchAll();
    return all.filter(
      (a) =>
        (uid && String(a.userId) === uid) || (rid && String(a.salesRouteId) === rid)
    );
  },

  async create(params: {
    userId?: string;
    storeId: string;
    salesRouteId?: string;
  }): Promise<Assignment | null> {
    const salespersonId = String(params.userId ?? '').trim();
    const storeId = String(params.storeId ?? '').trim();
    const salesRouteId = String(params.salesRouteId ?? '').trim();
    if (!storeId) return null;
    if (!salespersonId && !salesRouteId) return null;

    const logged = getLoggedUser();
    const assignedById =
      String((logged as any)?.id ?? (logged as any)?.Id ?? '').trim() ||
      String((logged as any)?.userId ?? (logged as any)?.UserId ?? '').trim() ||
      '';
    if (!assignedById) return null;

    const body: Record<string, string> = {
      assignedById,
      AssignedById: assignedById,
      storeId,
      StoreId: storeId,
    };
    if (salespersonId) {
      body.salespersonId = salespersonId;
      body.SalespersonId = salespersonId;
      body.userId = salespersonId;
      body.UserId = salespersonId;
    }
    if (salesRouteId) {
      body.routeId = salesRouteId;
      body.RouteId = salesRouteId;
      body.route_id = salesRouteId;
      body.salesRouteId = salesRouteId;
      body.SalesRouteId = salesRouteId;
    }

    const res = await apiClient.post<any>(API_CONFIG.ENDPOINTS.ASSIGNMENTS.CREATE, body);
    if (res == null) {
      return {
        id: salesRouteId ? `${salesRouteId}::${storeId}` : `${salespersonId}::${storeId}`,
        userId: salespersonId || undefined,
        storeId,
        salesRouteId: salesRouteId || undefined,
      };
    }
    if (typeof res === 'string' || typeof res === 'number') {
      return {
        id: String(res),
        userId: salespersonId || undefined,
        storeId,
        salesRouteId: salesRouteId || undefined,
      };
    }
    return (
      toAssignment(res) ?? {
        id: salesRouteId ? `${salesRouteId}::${storeId}` : `${salespersonId}::${storeId}`,
        userId: salespersonId || undefined,
        storeId,
        salesRouteId: salesRouteId || undefined,
      }
    );
  },

  async remove(params: {
    id?: string;
    userId?: string;
    storeId: string;
    salesRouteId?: string;
  }): Promise<boolean> {
    const userId = String(params.userId ?? '').trim();
    const storeId = String(params.storeId ?? '').trim();
    const salesRouteId = String(params.salesRouteId ?? '').trim();
    if (!storeId) return false;
    let id = String(params.id ?? '').trim();
    if (!id) {
      const all = await this.fetchAll();
      const found = all.find((a) => {
        if (String(a.storeId) !== storeId) return false;
        if (userId && String(a.userId) === userId) return true;
        if (salesRouteId && String(a.salesRouteId) === salesRouteId) return true;
        return false;
      });
      id = found?.id ? String(found.id) : '';
    }
    if (!id) return false;
    const endpoint = API_CONFIG.ENDPOINTS.ASSIGNMENTS.DELETE.replace('{id}', encodeURIComponent(id));
    try {
      await apiClient.delete<any>(endpoint);
      return true;
    } catch {
      return false;
    }
  },
};
