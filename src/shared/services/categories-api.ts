import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Category } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.FAMILIES;

export type FamilyWritePayload = {
  name: string;
  shortName: string;
  familyCode: string;
  genericCode: string;
  sku: string;
  volume: number;
  unit: string;
};

function buildFamilyJsonBody(p: FamilyWritePayload): Record<string, unknown> {
  return {
    name: p.name,
    Name: p.name,
    shortName: p.shortName,
    ShortName: p.shortName,
    familyCode: p.familyCode,
    FamilyCode: p.familyCode,
    genericCode: p.genericCode,
    GenericCode: p.genericCode,
    sku: p.sku,
    Sku: p.sku,
    volume: p.volume,
    Volume: p.volume,
    unit: p.unit,
    Unit: p.unit,
  };
}

/** Respuesta POST/PUT a veces trae solo id+nombre; rellenamos con lo enviado para que la UI no muestre "—" hasta recargar. */
function mergeFamilyResponseWithPayload(raw: Record<string, any>, payload: Record<string, any>) {
  if (!String(raw.name ?? raw.Name ?? '').trim()) {
    raw.name = payload.name;
    raw.Name = payload.Name;
  }
  if (!String(raw.shortName ?? raw.ShortName ?? '').trim() && String(payload.shortName ?? '').trim()) {
    raw.shortName = payload.shortName;
    raw.ShortName = payload.ShortName;
  }
  const pCode = String(payload.familyCode ?? payload.code ?? '').trim();
  if (!String(raw.familyCode ?? raw.FamilyCode ?? raw.family_code ?? '').trim() && pCode) {
    raw.familyCode = pCode;
    raw.FamilyCode = pCode;
    raw.code = pCode;
    raw.Code = pCode;
  }
  if (!String(raw.genericCode ?? raw.GenericCode ?? raw.generic_code ?? '').trim() && String(payload.genericCode ?? '').trim()) {
    raw.genericCode = payload.genericCode;
    raw.GenericCode = payload.GenericCode;
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
  let idValue =
    raw?.familyId ??
    raw?.FamilyId ??
    raw?.family_id ??
    raw?.id ??
    raw?.Id ??
    null;

  if (idValue == null || String(idValue).trim() === '') {
    idValue = `temp-${Math.random().toString(36).slice(2, 10)}`;
  }

  const familyCode = String(
    raw.familyCode ?? raw.FamilyCode ?? raw.family_code ?? raw.code ?? raw.Code ?? ''
  ).trim();
  const shortName = String(raw.shortName ?? raw.ShortName ?? raw.short_name ?? '').trim();
  const genericCode = String(raw.genericCode ?? raw.GenericCode ?? raw.generic_code ?? '').trim();

  return {
    id: String(idValue),
    name: String(raw.name ?? raw.Name ?? '').trim() || 'Familia',
    shortName: shortName || undefined,
    familyCode: familyCode || undefined,
    code: familyCode || undefined,
    genericCode: genericCode || undefined,
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

/** Crea una familia (POST body: name, shortName, familyCode, genericCode, sku, volume, unit). */
export async function createCategory(data: FamilyWritePayload): Promise<Category> {
  const p: FamilyWritePayload = {
    name: (data.name ?? '').trim() || 'Familia',
    shortName: String(data.shortName ?? '').trim(),
    familyCode: String(data.familyCode ?? '').trim(),
    genericCode: String(data.genericCode ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
    volume: Number(data.volume ?? 0),
    unit: String(data.unit ?? '').trim(),
  };
  const payload = buildFamilyJsonBody(p);
  const res = await apiClient.post<any>(E.CREATE, payload);

  const body = unwrapCreatedFamilyBody(res);
  if (body) {
    mergeFamilyResponseWithPayload(body, payload);
    return toCategory(body);
  }

  return toCategory({ id: `temp-${Math.random().toString(36).slice(2, 10)}`, ...payload });
}

/** Actualiza una familia (mismo shape que create). */
export async function updateCategory(id: string, data: FamilyWritePayload): Promise<Category> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const p: FamilyWritePayload = {
    name: (data.name ?? '').trim(),
    shortName: String(data.shortName ?? '').trim(),
    familyCode: String(data.familyCode ?? '').trim(),
    genericCode: String(data.genericCode ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
    volume: Number(data.volume ?? 0),
    unit: String(data.unit ?? '').trim(),
  };
  const payload = { id, Id: id, ...buildFamilyJsonBody(p) };
  const res = await apiClient.put<any>(endpoint, payload);
  const body = unwrapCreatedFamilyBody(res);
  if (body) {
    mergeFamilyResponseWithPayload(body, payload);
    if (!String(body.id ?? body.Id ?? body.familyId ?? body.FamilyId ?? '').trim()) {
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
