import { apiClient, API_CONFIG } from '@/shared/config/api';

const E = API_CONFIG.ENDPOINTS.PRESENTATIONS;

/** Guid con guiones (lo que exige System.Guid en JSON del API). */
function isValidGuidString(s: string): boolean {
  const t = String(s ?? '').trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(t);
}

function unwrapCreatedPresentationBody(res: any): Record<string, any> | null {
  if (res == null) return null;
  if (typeof res === 'string') {
    const id = res.trim();
    return id ? { id, Id: id } : null;
  }
  if (typeof res !== 'object' || Array.isArray(res)) return null;
  const inner = res.data ?? res.Data ?? res.item ?? res.Item ?? res.result ?? res.Result;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) return { ...inner };
  return { ...res };
}

export interface Presentation {
  id: string;
  /** FK a FAMILY (obligatorio en BD). */
  familyId: string;
  /** Legacy: algunos backends aún pueden devolverlo, pero ya no se usa en UI. */
  sku?: string;
  genericCode: string;
  volume?: number;
  unit?: string;
  isActive: boolean;
}

function toPresentation(raw: any): Presentation {
  const fam = raw?.family ?? raw?.Family;
  const familyId = String(
    raw?.familyId ??
      raw?.FamilyId ??
      raw?.family_id ??
      fam?.id ??
      fam?.Id ??
      ''
  ).trim();
  return {
    id: String(
      raw?.id ??
        raw?.Id ??
        raw?.presentationId ??
        raw?.PresentationId ??
        raw?.presentation_id ??
        ''
    ).trim(),
    familyId,
    sku: String(raw?.sku ?? raw?.Sku ?? '').trim(),
    genericCode: String(raw?.genericCode ?? raw?.GenericCode ?? '').trim(),
    volume: Number(raw?.volume ?? raw?.Volume ?? 0) || undefined,
    unit: String(raw?.unit ?? raw?.Unit ?? '').trim() || undefined,
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : (raw?.IsActive ?? true),
  };
}

export async function fetchPresentations(): Promise<Presentation[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toPresentation);
}

export async function createPresentation(data: {
  familyId: string;
  genericCode: string;
  volume?: number;
  unit?: string;
}): Promise<Presentation> {
  const payload = {
    familyId: String(data.familyId ?? '').trim(),
    FamilyId: String(data.familyId ?? '').trim(),
    genericCode: String(data.genericCode ?? '').trim(),
    GenericCode: String(data.genericCode ?? '').trim(),
    volume: Number(data.volume ?? 0),
    unit: String(data.unit ?? '').trim(),
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  const body = unwrapCreatedPresentationBody(res);
  let created = toPresentation(body ?? res ?? payload);

  if (!isValidGuidString(created.id)) {
    const all = await fetchPresentations();
    const fam = String(data.familyId ?? '').trim();
    const gen = String(data.genericCode ?? '').trim();
    const match = all.find(
      (p) =>
        String(p.familyId).trim() === fam && (!gen || String(p.genericCode).trim() === gen)
    );
    if (match && isValidGuidString(match.id)) {
      created = { ...match };
    }
  }

  return created;
}

export async function updatePresentation(
  id: string,
  data: { familyId: string; genericCode: string; volume?: number; unit?: string }
): Promise<Presentation> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = {
    id,
    Id: id,
    familyId: String(data.familyId ?? '').trim(),
    FamilyId: String(data.familyId ?? '').trim(),
    genericCode: String(data.genericCode ?? '').trim(),
    GenericCode: String(data.genericCode ?? '').trim(),
    volume: Number(data.volume ?? 0),
    unit: String(data.unit ?? '').trim(),
  };
  const res = await apiClient.put<any>(endpoint, payload);
  return toPresentation(res ?? payload);
}

export async function deletePresentation(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(id));
  await apiClient.delete(endpoint);
}

export async function togglePresentationActive(id: string): Promise<void> {
  const endpoint = E.TOGGLE_STATUS.replace('{id}', encodeURIComponent(id));
  await apiClient.patch(endpoint, {});
}

export const presentationsApi = {
  fetchAll: fetchPresentations,
  create: createPresentation,
  update: updatePresentation,
  delete: deletePresentation,
  toggleActive: togglePresentationActive,
};
