import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Category } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.FAMILIES;

/** Respuesta POST/PUT a veces trae solo id+nombre; rellenamos con lo que ya enviamos para que la UI no muestre "—" hasta recargar. */
function mergeFamilyResponseWithPayload(raw: Record<string, any>, payload: Record<string, any>) {
  if (!String(raw.name ?? raw.Name ?? '').trim()) {
    raw.name = payload.name;
    raw.Name = payload.Name;
  }
  if (!String(raw.code ?? raw.Code ?? '').trim()) {
    raw.code = payload.code;
    raw.Code = payload.Code;
  }
  if (!String(raw.sku ?? raw.Sku ?? '').trim()) {
    raw.sku = payload.sku;
    raw.Sku = payload.Sku;
  }
  if (raw.volume == null && raw.Volume == null) {
    raw.volume = payload.volume;
    raw.Volume = payload.Volume;
  }
  if (!String(raw.unit ?? raw.Unit ?? '').trim() && String(payload.unit ?? '').trim()) {
    raw.unit = payload.unit;
    raw.Unit = payload.Unit;
  }
}

function unwrapCreatedFamilyBody(res: any): Record<string, any> | null {
  if (res == null) return null;
  if (typeof res === 'string') {
    const id = res.trim();
    return id ? { id, Id: id } : null;
  }
  if (typeof res !== 'object' || Array.isArray(res)) return null;
  const inner = res.data ?? res.Data ?? res.item ?? res.Item;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) return { ...inner };
  return { ...res };
}

function toCategory(raw: any): Category {
  // Asegurar un id no vacío para evitar keys `` duplicadas en React
  let idValue =
    raw?.id ??
    raw?.Id ??
    raw?.name ??
    raw?.Name ??
    null;

  if (idValue == null || String(idValue).trim() === '') {
    idValue = `temp-${Math.random().toString(36).slice(2, 10)}`;
  }

  return {
    id: String(idValue),
    name: String(raw.name ?? raw.Name ?? '').trim() || 'Familia',
    code: String(raw.code ?? raw.Code ?? '').trim() || undefined,
    sku: String(raw.sku ?? raw.Sku ?? '').trim() || undefined,
    volume: Number(raw.volume ?? raw.Volume ?? 0) || undefined,
    unit: String(raw.unit ?? raw.Unit ?? '').trim() || undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

/** Lista todas las familias (antes categorías) */
export async function fetchCategories(): Promise<Category[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toCategory);
}

/** Obtiene una familia por id */
export async function fetchCategoryById(id: string): Promise<Category | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toCategory(res) : null;
  } catch {
    return null;
  }
}

/** Crea una familia */
export async function createCategory(data: { name: string; code?: string; sku?: string; volume?: number; unit?: string }): Promise<Category> {
  const payload = {
    name: (data.name ?? '').trim() || 'Familia',
    Name: (data.name ?? '').trim() || 'Familia',
    code: String(data.code ?? '').trim(),
    Code: String(data.code ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
    Sku: String(data.sku ?? '').trim(),
    volume: Number(data.volume ?? 0),
    Volume: Number(data.volume ?? 0),
    unit: String(data.unit ?? '').trim(),
    Unit: String(data.unit ?? '').trim(),
  };
  const res = await apiClient.post<any>(E.CREATE, payload);

  const body = unwrapCreatedFamilyBody(res);
  if (body) {
    mergeFamilyResponseWithPayload(body, payload);
    return toCategory(body);
  }

  // Si el backend no devuelve nada, crear una categoría temporal con id único
  return toCategory({ id: `temp-${Math.random().toString(36).slice(2, 10)}`, ...payload });
}

/** Actualiza una familia */
export async function updateCategory(id: string, data: { name: string; code?: string; sku?: string; volume?: number; unit?: string }): Promise<Category> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = {
    id,
    name: (data.name ?? '').trim(),
    Name: (data.name ?? '').trim(),
    code: String(data.code ?? '').trim(),
    Code: String(data.code ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
    Sku: String(data.sku ?? '').trim(),
    volume: Number(data.volume ?? 0),
    Volume: Number(data.volume ?? 0),
    unit: String(data.unit ?? '').trim(),
    Unit: String(data.unit ?? '').trim(),
  };
  const res = await apiClient.put<any>(endpoint, payload);
  const body = unwrapCreatedFamilyBody(res);
  if (body) {
    mergeFamilyResponseWithPayload(body, payload);
    if (!String(body.id ?? body.Id ?? '').trim()) {
      body.id = id;
      body.Id = id;
    }
    return toCategory(body);
  }
  const fetched = await fetchCategoryById(id);
  return fetched ?? toCategory({ id, ...payload, isActive: true, createdAt: new Date(), updatedAt: new Date() });
}

/** Activa/desactiva una familia */
export async function toggleCategoryActive(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.put(endpoint, { id });
}

export const categoriesApi = {
  fetchAll: fetchCategories,
  getById: fetchCategoryById,
  create: createCategory,
  update: updateCategory,
  toggleActive: toggleCategoryActive
};
