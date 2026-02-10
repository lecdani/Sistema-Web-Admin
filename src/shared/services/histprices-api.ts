import { apiClient, API_CONFIG } from '@/shared/config/api';

const E = API_CONFIG.ENDPOINTS.HISTPRICES;

export interface HistPriceRaw {
  id?: string;
  productId: string;
  price: number;
  startDate: string; // ISO
  endDate: string;   // ISO
}

export interface HistPrice {
  id: string;
  productId: string;
  price: number;
  startDate: Date;
  endDate: Date;
}

function toHistPrice(raw: any): HistPrice {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    productId: String(raw.productId ?? raw.ProductId ?? ''),
    price: Number(raw.price ?? raw.Price ?? 0),
    startDate: raw.startDate ? new Date(raw.startDate) : raw.StartDate ? new Date(raw.StartDate) : new Date(),
    endDate: raw.endDate ? new Date(raw.endDate) : raw.EndDate ? new Date(raw.EndDate) : new Date()
  };
}

/** Crea un registro en el historial de precios */
export async function createHistPrice(data: {
  productId: string;
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
  const payload = { productId: data.productId, price: data.price, startDate: start, endDate: end };
  const res = await apiClient.post<any>(E.CREATE, payload);
  return res ? toHistPrice(res) : toHistPrice({ id: '', ...payload });
}

/** Lista el historial de precios de un producto */
export async function fetchHistPricesByProduct(productId: string): Promise<HistPrice[]> {
  const endpoint = E.GET_BY_PRODUCT.replace('{productId}', encodeURIComponent(productId));
  const res = await apiClient.get<any>(endpoint);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toHistPrice);
}

/** Obtiene el precio más reciente de un producto */
export async function fetchLatestPrice(productId: string): Promise<HistPrice | null> {
  const endpoint = E.GET_LATEST.replace('{productId}', encodeURIComponent(productId));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toHistPrice(res) : null;
  } catch {
    return null;
  }
}

/** Obtiene el precio vigente en una fecha para un producto */
export async function fetchPriceByDate(productId: string, date: string): Promise<HistPrice | null> {
  const endpoint = E.GET_BY_DATE
    .replace('{productId}', encodeURIComponent(productId))
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
  getByProduct: fetchHistPricesByProduct,
  getLatest: fetchLatestPrice,
  getByDate: fetchPriceByDate
};
