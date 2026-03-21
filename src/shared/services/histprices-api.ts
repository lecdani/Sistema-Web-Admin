import { apiClient, API_CONFIG } from '@/shared/config/api';

const E = API_CONFIG.ENDPOINTS.HISTPRICES;

export interface HistPriceRaw {
  id?: string;
  familyId: string;
  price: number;
  startDate: string; // ISO
  endDate: string;   // ISO
}

export interface HistPrice {
  id: string;
  familyId: string;
  price: number;
  startDate: Date;
  endDate: Date;
}

function toHistPrice(raw: any): HistPrice {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    familyId: String(raw.familyId ?? raw.FamilyId ?? raw.productId ?? raw.ProductId ?? ''),
    price: Number(raw.price ?? raw.Price ?? 0),
    startDate: raw.startDate ? new Date(raw.startDate) : raw.StartDate ? new Date(raw.StartDate) : new Date(),
    endDate: raw.endDate ? new Date(raw.endDate) : raw.EndDate ? new Date(raw.EndDate) : new Date()
  };
}

function parseHistPriceListResponse(res: any): HistPrice[] {
  const list = Array.isArray(res)
    ? res
    : res?.data ?? res?.items ?? res?.Data ?? res?.Items ?? res?.results ?? res?.Results ?? [];
  if (!Array.isArray(list)) return [];
  return (list as any[]).map(toHistPrice);
}

/** Crea un registro en el historial de precios */
export async function createHistPrice(data: {
  familyId: string;
  price: number;
  startDate: Date | string;
  endDate?: Date | string | null;
}): Promise<HistPrice> {
  const start = typeof data.startDate === 'string' ? data.startDate : (data.startDate as Date).toISOString();
  const end = data.endDate == null || data.endDate === ''
    ? start
    : typeof data.endDate === 'string'
      ? data.endDate
      : (data.endDate as Date).toISOString();
  const payload = {
    familyId: data.familyId,
    FamilyId: data.familyId,
    price: data.price,
    startDate: start,
    endDate: end
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return res ? toHistPrice(res) : toHistPrice({ id: '', ...payload });
}

/**
 * Lista el historial de precios de una familia.
 * Backend: GET /histprices/histprices/family/{familyId}
 */
export async function fetchHistPricesByFamily(familyId: string): Promise<HistPrice[]> {
  const endpoint = E.GET_BY_FAMILY.replace(
    '{familyId}',
    encodeURIComponent(String(familyId).trim())
  );
  try {
    const res = await apiClient.get<any>(endpoint);
    return parseHistPriceListResponse(res);
  } catch {
    return [];
  }
}

/** Obtiene el precio más reciente de una familia */
export async function fetchLatestPrice(familyId: string): Promise<HistPrice | null> {
  const endpoint = E.GET_LATEST.replace('{familyId}', encodeURIComponent(familyId));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toHistPrice(res) : null;
  } catch {
    return null;
  }
}

/** Obtiene el precio vigente en una fecha para una familia */
export async function fetchPriceByDate(familyId: string, date: string): Promise<HistPrice | null> {
  const endpoint = E.GET_BY_DATE
    .replace('{familyId}', encodeURIComponent(familyId))
    .replace('{date}', encodeURIComponent(date));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toHistPrice(res) : null;
  } catch {
    return null;
  }
}

export const histpricesApi = {
  create: createHistPrice,
  getByFamily: fetchHistPricesByFamily,
  // Alias legacy para no romper llamadas antiguas
  getByProduct: fetchHistPricesByFamily,
  getLatest: fetchLatestPrice,
  getByDate: fetchPriceByDate
};
