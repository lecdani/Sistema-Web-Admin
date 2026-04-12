import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Category } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.FAMILIES;

/** Body alineado con tabla FAMILY: name, family_code, brand_id, class_id. */
export type FamilyWritePayload = {
  name: string;
  familyCode: string;
  brandId: string;
  classId: string;
};

function buildFamilyJsonBody(p: FamilyWritePayload): Record<string, unknown> {
  return {
    name: p.name,
    Name: p.name,
    familyCode: p.familyCode,
    FamilyCode: p.familyCode,
    brandId: p.brandId,
    BrandId: p.brandId,
    classId: p.classId,
    ClassId: p.classId,
  };
}

/** Respuesta POST/PUT a veces trae solo id+nombre; rellenamos con lo enviado para que la UI no muestre "—" hasta recargar. */
function mergeFamilyResponseWithPayload(raw: Record<string, any>, payload: Record<string, any>) {
  if (!String(raw.name ?? raw.Name ?? '').trim()) {
    raw.name = payload.name;
    raw.Name = payload.Name;
  }
  const pCode = String(payload.familyCode ?? payload.code ?? '').trim();
  if (!String(raw.familyCode ?? raw.FamilyCode ?? raw.family_code ?? '').trim() && pCode) {
    raw.familyCode = pCode;
    raw.FamilyCode = pCode;
    raw.code = pCode;
    raw.Code = pCode;
  }
  if (!String(raw.brandId ?? raw.BrandId ?? '').trim() && String(payload.brandId ?? '').trim()) {
    raw.brandId = payload.brandId;
    raw.BrandId = payload.BrandId;
  }
  if (!String(raw.classId ?? raw.ClassId ?? '').trim() && String(payload.classId ?? '').trim()) {
    raw.classId = payload.classId;
    raw.ClassId = payload.ClassId;
  }
  const bid = brandIdFromRaw(raw);
  const cid = classIdFromRaw(raw);
  if (bid) {
    raw.brandId = bid;
    raw.BrandId = bid;
  }
  if (cid) {
    raw.classId = cid;
    raw.ClassId = cid;
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

function brandIdFromRaw(raw: any): string | undefined {
  const flat = raw?.brandId ?? raw?.BrandId;
  if (flat != null && String(flat).trim() !== '') return String(flat).trim();
  const b = raw?.brand ?? raw?.Brand;
  if (b && (b.id != null || b.Id != null)) {
    const id = String(b.id ?? b.Id ?? '').trim();
    return id || undefined;
  }
  return undefined;
}

function classIdFromRaw(raw: any): string | undefined {
  const flat = raw?.classId ?? raw?.ClassId;
  if (flat != null && String(flat).trim() !== '') return String(flat).trim();
  const c = raw?.class ?? raw?.Class;
  if (c && (c.id != null || c.Id != null)) {
    const id = String(c.id ?? c.Id ?? '').trim();
    return id || undefined;
  }
  return undefined;
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
    brandId: brandIdFromRaw(raw),
    classId: classIdFromRaw(raw),
    presentationId: raw.presentationId ?? raw.PresentationId ?? undefined,
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

/** Crea una familia (POST: name, familyCode, brandId, classId). */
export async function createCategory(data: FamilyWritePayload): Promise<Category> {
  const p: FamilyWritePayload = {
    name: (data.name ?? '').trim() || 'Familia',
    familyCode: String(data.familyCode ?? '').trim(),
    brandId: String(data.brandId ?? '').trim(),
    classId: String(data.classId ?? '').trim(),
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
    familyCode: String(data.familyCode ?? '').trim(),
    brandId: String(data.brandId ?? '').trim(),
    classId: String(data.classId ?? '').trim(),
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

/** Elimina una familia (DELETE /families/families/{id}); el servidor puede exigir que no haya presentaciones ni productos. */
export async function deleteCategory(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(id));
  await apiClient.delete(endpoint);
}

export const categoriesApi = {
  fetchAll: fetchCategories,
  getById: fetchCategoryById,
  create: createCategory,
  update: updateCategory,
  toggleActive: toggleCategoryActive,
  delete: deleteCategory,
};
