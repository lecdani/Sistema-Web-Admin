import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { ProductClass } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.CLASSES;

function toClass(raw: any): ProductClass {
  return {
    id: String(raw?.id ?? raw?.Id ?? ''),
    name: String(raw?.name ?? raw?.Name ?? '').trim(),
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : (raw?.IsActive ?? true),
    createdAt: raw?.createdAt ? new Date(raw.createdAt) : raw?.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : raw?.UpdatedAt ? new Date(raw.UpdatedAt) : new Date(),
  };
}

export async function fetchClasses(): Promise<ProductClass[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toClass);
}

export async function createClass(data: { name: string }): Promise<ProductClass> {
  const payload = { name: String(data.name ?? '').trim(), Name: String(data.name ?? '').trim() };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return toClass(res ?? payload);
}

export async function updateClass(id: string, data: { name: string }): Promise<ProductClass> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, Id: id, name: String(data.name ?? '').trim(), Name: String(data.name ?? '').trim() };
  const res = await apiClient.put<any>(endpoint, payload);
  return toClass(res ?? payload);
}

export async function deleteClass(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(id));
  await apiClient.delete(endpoint);
}

export async function toggleClassActive(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.put(endpoint, { id, Id: id });
}

export const classesApi = {
  fetchAll: fetchClasses,
  create: createClass,
  update: updateClass,
  delete: deleteClass,
  toggleActive: toggleClassActive,
};
