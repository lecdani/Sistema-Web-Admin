import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Distribution } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.DISTRIBUTIONS;

/** API: Xposition = fila (row), Yposition = columna (column), mismo criterio que nosotros. */
function getPositionFromRaw(raw: any): { x: number; y: number } {
  const pos = raw?.position ?? raw?.Position;
  const xFromPos = pos?.x ?? pos?.X ?? pos?.row ?? pos?.Row;
  const yFromPos = pos?.y ?? pos?.Y ?? pos?.column ?? pos?.Column ?? pos?.col ?? pos?.Col;
  const apiX = raw.Xposition ?? raw.xposition ?? raw.xPosition ?? raw.XPosition ?? raw.x_position ?? raw.X_POSITION ?? raw.x ?? raw.row ?? raw.Row ?? xFromPos ?? 0;
  const apiY = raw.Yposition ?? raw.yposition ?? raw.yPosition ?? raw.YPosition ?? raw.y_position ?? raw.Y_POSITION ?? raw.y ?? raw.column ?? raw.Column ?? raw.col ?? raw.Col ?? yFromPos ?? 0;
  const x = Math.max(0, Math.min(9, Math.floor(isNaN(Number(apiX)) ? 0 : Number(apiX))));
  const y = Math.max(0, Math.min(9, Math.floor(isNaN(Number(apiY)) ? 0 : Number(apiY))));
  return { x, y };
}

function toDistribution(raw: any): Distribution {
  const { x: xPosition, y: yPosition } = getPositionFromRaw(raw);
  return {
    id: String(raw.id ?? raw.distributionId ?? raw.Id ?? ''),
    planogramId: String(
      raw.planogramId ?? raw.PlanogramId ?? raw.planogram_id ?? raw.PLANOGRAM_ID ?? ''
    ),
    productId: String(
      raw.productId ?? raw.ProductId ?? raw.product_id ?? raw.PRODUCT_ID ?? ''
    ),
    xPosition,
    yPosition,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date()
  };
}

/** API: Xposition = fila (xPosition), Yposition = columna (yPosition). Mismo criterio que nosotros. */
function toPayload(data: { planogramId: string; productId: string; xPosition: number; yPosition: number }) {
  const row = Math.max(0, Math.min(9, Math.floor(Number(data.xPosition)) || 0));
  const col = Math.max(0, Math.min(9, Math.floor(Number(data.yPosition)) || 0));
  return {
    planogramId: data.planogramId,
    productId: data.productId,
    PlanogramId: data.planogramId,
    ProductId: data.productId,
    Xposition: row,
    Yposition: col,
    xposition: row,
    yposition: col,
    XPosition: row,
    YPosition: col,
    xPosition: row,
    yPosition: col,
    X_POSITION: row,
    Y_POSITION: col,
    position: { x: row, y: col },
    Position: { X: row, Y: col }
  };
}

/** Lista distribuciones de un planograma */
export async function fetchDistributionsByPlanogram(planogramId: string): Promise<Distribution[]> {
  const endpoint = E.LIST_BY_PLANOGRAM.replace('{id}', encodeURIComponent(planogramId));
  try {
    const res = await apiClient.get<any>(endpoint);
    const list = Array.isArray(res)
      ? res
      : res?.data ?? res?.items ?? res?.value ?? res?.distributions ?? res?.Distributions ?? (res && typeof res === 'object' && !Array.isArray(res) ? [res] : []);
    const items = Array.isArray(list) ? list : [];
    return items.map((item: any) => toDistribution(item?.distribution ?? item?.Distribution ?? item));
  } catch {
    return [];
  }
}

/** Crea una distribución */
export async function createDistribution(data: {
  planogramId: string;
  productId: string;
  xPosition: number;
  yPosition: number;
}): Promise<Distribution> {
  const payload = toPayload(data);
  const res = await apiClient.post<any>(E.CREATE, payload);
  if (typeof res === 'string' || typeof res === 'number') {
    const list = await fetchDistributionsByPlanogram(data.planogramId);
    const found = list.find(
      (d) => d.productId === data.productId && d.xPosition === data.xPosition && d.yPosition === data.yPosition
    );
    if (found) return found;
    return {
      id: String(res),
      ...data,
      createdAt: new Date()
    };
  }
  return toDistribution(res);
}

/** Actualiza una distribución (posición, producto, planograma). Incluir planogramId y productId para no violar FKs. */
export async function updateDistribution(
  id: string,
  data: { planogramId?: string; productId?: string; xPosition?: number; yPosition?: number }
): Promise<Distribution> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload: any = { id };
  if (data.planogramId != null && data.planogramId !== '') {
    payload.planogramId = data.planogramId;
    payload.PlanogramId = data.planogramId;
    payload.planogram_id = data.planogramId;
    payload.PLANOGRAM_ID = data.planogramId;
  }
  const row = data.xPosition != null ? Math.max(0, Math.min(9, Math.floor(Number(data.xPosition)) || 0)) : undefined;
  const col = data.yPosition != null ? Math.max(0, Math.min(9, Math.floor(Number(data.yPosition)) || 0)) : undefined;
  if (row != null) {
    payload.Xposition = row;
    payload.xposition = row;
    payload.xPosition = row;
    payload.XPosition = row;
    payload.X_POSITION = row;
  }
  if (col != null) {
    payload.Yposition = col;
    payload.yposition = col;
    payload.yPosition = col;
    payload.YPosition = col;
    payload.Y_POSITION = col;
  }
  if (row != null || col != null) {
    payload.position = { x: row ?? 0, y: col ?? 0 };
    payload.Position = { X: row ?? 0, Y: col ?? 0 };
  }
  if (data.productId != null) {
    payload.productId = data.productId;
    payload.ProductId = data.productId;
  }
  const res = await apiClient.put<any>(endpoint, payload);
  if (typeof res === 'string' || res == null) {
    return { id, planogramId: '', productId: data.productId ?? '', xPosition: data.xPosition ?? 0, yPosition: data.yPosition ?? 0, createdAt: new Date(), ...data } as Distribution;
  }
  return toDistribution(res);
}

/** Desactiva una distribución (PUT /distributions/distributions/desactivate/{id}) */
export async function toggleDistributionActive(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.put(endpoint, { id });
}

export const distributionsApi = {
  getByPlanogram: fetchDistributionsByPlanogram,
  create: createDistribution,
  update: updateDistribution,
  toggleActive: toggleDistributionActive
};
