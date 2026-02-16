import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Planogram } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.PLANOGRAMS;

function toPlanogram(raw: any): Planogram {
  const id = String(raw.id ?? raw.planogramId ?? raw.Id ?? '');
  const createdAt = raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date();
  const updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : createdAt;
  return {
    id,
    name: String(raw.name ?? raw.Name ?? raw.id ?? 'Planograma').trim() || `Planograma ${id}`,
    description: raw.description ?? raw.Description,
    version: typeof raw.version === 'number' ? raw.version : (raw.Version ?? 1),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt,
    updatedAt,
    activatedAt: raw.activatedAt ? new Date(raw.activatedAt) : raw.ActivatedAt ? new Date(raw.ActivatedAt) : undefined
  };
}

function toPayload(data: Partial<Planogram>) {
  const name = (data.name ?? '').toString().trim();
  const description = (data.description ?? '').toString().trim();
  const payload: any = {
    name: name || 'Planograma',
    description: description,
    Name: name || 'Planograma',
    Description: description,
    isActive: data.isActive,
    IsActive: data.isActive
  };
  if (data.createdAt) payload.createdAt = data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt;
  if (data.version != null) payload.version = data.version;
  return payload;
}

/** Payload solo para actualizar nombre/descripción; no envía isActive para no desactivar al editar */
function toUpdatePayload(data: Partial<Planogram>) {
  const name = (data.name ?? '').toString().trim();
  const description = (data.description ?? '').toString().trim();
  return {
    name: name || 'Planograma',
    description: description,
    Name: name || 'Planograma',
    Description: description
  };
}

/** Lista todos los planogramas */
export async function fetchPlanograms(): Promise<Planogram[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toPlanogram);
}

/** Obtiene un planograma por id */
export async function fetchPlanogramById(id: string): Promise<Planogram | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toPlanogram(res) : null;
  } catch {
    return null;
  }
}

/** Crea un planograma */
export async function createPlanogram(data: Partial<Planogram> & { name?: string }): Promise<Planogram> {
  const payload = toPayload({ ...data, name: data.name || 'Planograma' });
  const res = await apiClient.post<any>(E.CREATE, payload);
  if (typeof res === 'string' || typeof res === 'number') {
    const fetched = await fetchPlanogramById(String(res));
    if (fetched) return fetched;
    return {
      id: String(res),
      name: data.name || 'Planograma',
      description: data.description,
      version: 1,
      isActive: data.isActive ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  return toPlanogram(res);
}

/** Actualiza un planograma (solo nombre y descripción; no se toca isActive para no desactivar al editar) */
export async function updatePlanogram(id: string, data: Partial<Planogram>): Promise<Planogram> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, ...toUpdatePayload(data) };
  const res = await apiClient.put<any>(endpoint, payload);
  if (typeof res === 'string' || res == null) {
    const fetched = await fetchPlanogramById(id);
    if (fetched) return fetched;
    return { id, name: data.name ?? '', version: data.version ?? 1, isActive: data.isActive ?? true, createdAt: new Date(), updatedAt: new Date(), ...data } as Planogram;
  }
  return toPlanogram(res);
}

/** Activa/desactiva un planograma (mismo endpoint: PUT /planograms/planograms/desactivate/{id} hace toggle) */
export async function togglePlanogramActive(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.put(endpoint, { id });
}

/** Activa o desactiva usando el mismo endpoint (toggle). */
export async function setPlanogramActive(id: string, active: boolean): Promise<Planogram> {
  await togglePlanogramActive(id);
  const p = await fetchPlanogramById(id);
  return p ?? { id, name: '', description: '', version: 1, isActive: active, createdAt: new Date(), updatedAt: new Date() } as Planogram;
}

export const planogramsApi = {
  fetchAll: fetchPlanograms,
  getById: fetchPlanogramById,
  create: createPlanogram,
  update: updatePlanogram,
  toggleActive: togglePlanogramActive,
  setActive: setPlanogramActive
};
