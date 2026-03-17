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
  const storeId = String(raw?.storeId ?? raw?.StoreId ?? '').trim();
  if (!userId || !storeId) return null;
  return {
    id: id || `${userId}::${storeId}`,
    userId,
    storeId,
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

  async fetchByUser(userId: string): Promise<Assignment[]> {
    const uid = String(userId ?? '').trim();
    if (!uid) return [];
    const all = await this.fetchAll();
    return all.filter((a) => String(a.userId) === uid);
  },

  async create(params: { userId: string; storeId: string }): Promise<Assignment | null> {
    const salespersonId = String(params.userId ?? '').trim();
    const storeId = String(params.storeId ?? '').trim();
    if (!salespersonId || !storeId) return null;

    const logged = getLoggedUser();
    const assignedById =
      String((logged as any)?.id ?? (logged as any)?.Id ?? '').trim() ||
      String((logged as any)?.userId ?? (logged as any)?.UserId ?? '').trim() ||
      '';
    if (!assignedById) return null;

    const body = {
      assignedById,
      AssignedById: assignedById,
      salespersonId,
      SalespersonId: salespersonId,
      storeId,
      StoreId: storeId,
    };
    const res = await apiClient.post<any>(API_CONFIG.ENDPOINTS.ASSIGNMENTS.CREATE, body);
    if (res == null) return { id: `${salespersonId}::${storeId}`, userId: salespersonId, storeId };
    if (typeof res === 'string' || typeof res === 'number') {
      return { id: String(res), userId: salespersonId, storeId };
    }
    return toAssignment(res) ?? { id: `${salespersonId}::${storeId}`, userId: salespersonId, storeId };
  },

  async remove(params: { id?: string; userId: string; storeId: string }): Promise<boolean> {
    const userId = String(params.userId ?? '').trim();
    const storeId = String(params.storeId ?? '').trim();
    if (!userId || !storeId) return false;
    let id = String(params.id ?? '').trim();
    if (!id) {
      const all = await this.fetchAll();
      const found = all.find((a) => String(a.userId) === userId && String(a.storeId) === storeId);
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

