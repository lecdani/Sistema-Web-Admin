import { apiClient, API_CONFIG } from '@/shared/config/api';

const E = API_CONFIG.ENDPOINTS.HISTPRICES;

const GUID_DASHED =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function normalizePresentationGuid(s: string): string {
  const t = String(s ?? '').trim();
  if (!t) return '';
  if (GUID_DASHED.test(t)) return t;
  const c = t.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/i.test(c)) {
    return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
  }
  return t;
}

function isValidPresentationGuid(s: string): boolean {
  return GUID_DASHED.test(normalizePresentationGuid(s));
}

export interface HistPrice {
  id: string;
  /** Id de la presentación asociada al precio. */
  presentationId: string;
  price: number;
  startDate: Date;
  endDate: Date;
}

function toHistPrice(raw: any): HistPrice {
  const presentationId = String(
    raw.presentationId ??
      raw.PresentationId ??
      raw.familyId ??
      raw.FamilyId ??
      raw.productId ??
      raw.ProductId ??
      ''
  ).trim();
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    presentationId,
    price: Number(raw.price ?? raw.Price ?? 0),
    startDate: raw.startDate ? new Date(raw.startDate) : raw.StartDate ? new Date(raw.StartDate) : new Date(),
    endDate: raw.endDate ? new Date(raw.endDate) : raw.EndDate ? new Date(raw.EndDate) : new Date(),
  };
}

function parseHistPriceListResponse(res: any): HistPrice[] {
  const list = Array.isArray(res)
    ? res
    : res?.data ?? res?.items ?? res?.Data ?? res?.Items ?? res?.results ?? res?.Results ?? [];
  if (!Array.isArray(list)) return [];
  return (list as any[]).map(toHistPrice);
}

export async function createHistPrice(data: {
  presentationId: string;
  price: number;
  startDate: Date | string;
  endDate?: Date | string | null;
}): Promise<HistPrice> {
  const start = typeof data.startDate === 'string' ? data.startDate : (data.startDate as Date).toISOString();
  const end =
    data.endDate == null || data.endDate === ''
      ? start
      : typeof data.endDate === 'string'
        ? data.endDate
        : (data.endDate as Date).toISOString();
  const pid = normalizePresentationGuid(String(data.presentationId ?? '').trim());
  if (!isValidPresentationGuid(pid)) {
    throw new Error(
      `[histprices] presentationId debe ser un GUID válido (recibido: ${JSON.stringify(data.presentationId)})`
    );
  }
  const payload = {
    presentationId: pid,
    PresentationId: pid,
    price: data.price,
    Price: data.price,
    startDate: start,
    StartDate: start,
    endDate: end,
    EndDate: end,
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return res ? toHistPrice(res) : toHistPrice({ id: '', ...payload });
}

function pickLatestFromList(list: HistPrice[]): HistPrice | null {
  if (!list.length) return null;
  const sorted = [...list].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  return sorted[0] ?? null;
}

export async function fetchHistPricesByPresentation(presentationId: string): Promise<HistPrice[]> {
  const endpoint = E.GET_BY_PRESENTATION.replace(
    '{presentationId}',
    encodeURIComponent(String(presentationId).trim())
  );
  try {
    const res = await apiClient.get<any>(endpoint);
    return parseHistPriceListResponse(res);
  } catch {
    return [];
  }
}

/**
 * Precio vigente: muchos backends no exponen GET `/latest/{id}` (404) y solo devuelven historial por presentación.
 * Usamos `presentation/{id}` y tomamos el registro con `startDate` más reciente (mismo criterio que “último”).
 */
export async function fetchLatestPrice(presentationId: string): Promise<HistPrice | null> {
  const list = await fetchHistPricesByPresentation(String(presentationId).trim());
  return pickLatestFromList(list);
}

export async function fetchPriceByDate(presentationId: string, date: string): Promise<HistPrice | null> {
  const endpoint = E.GET_BY_DATE.replace('{presentationId}', encodeURIComponent(String(presentationId).trim())).replace(
    '{date}',
    encodeURIComponent(date)
  );
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toHistPrice(res) : null;
  } catch {
    return null;
  }
}

export const histpricesApi = {
  create: createHistPrice,
  getByPresentation: fetchHistPricesByPresentation,
  getLatest: fetchLatestPrice,
  getByDate: fetchPriceByDate,
};
