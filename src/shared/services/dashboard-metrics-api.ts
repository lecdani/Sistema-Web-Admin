import type { DashboardStats } from '@/shared/types';
import { apiClient, API_CONFIG } from '@/shared/config/api';
import { salesRoutesApi } from '@/shared/services/sales-routes-api';
import type { OrderForUI } from '@/shared/services/orders-api';
import { extractSalesRouteId, extractSalesRouteName, usersApi } from '@/shared/services/users-api';

/** Respuesta del backend puede ser número, texto o objeto con count/total/value. */
export function parseApiCountPayload(data: unknown): number {
  if (typeof data === 'number' && Number.isFinite(data)) return Math.max(0, Math.floor(data));
  if (typeof data === 'string') {
    const n = Number.parseInt(data.trim(), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (data != null && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of ['count', 'Count', 'total', 'Total', 'value', 'Value'] as const) {
      const v = o[key];
      if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
      if (typeof v === 'string') {
        const n = Number.parseInt(v.trim(), 10);
        if (Number.isFinite(n)) return Math.max(0, n);
      }
    }
    const nested = o.data ?? o.Data;
    if (nested !== undefined && nested !== data) return parseApiCountPayload(nested);
  }
  return 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha local YYYY-MM-DD */
export function formatLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Inicio del día local */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Fin del día local */
export function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Primer instante del mes local */
export function startOfLocalMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** Último instante del mes local */
export function endOfLocalMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Mismo contrato que el API .NET: query `startDate` y `endDate` (DateTime). */
function toQueryRange(from: Date, to: Date): string {
  const startDate = formatLocalDateKey(from) + 'T00:00:00';
  const endDate = formatLocalDateKey(to) + 'T23:59:59.999';
  const q = new URLSearchParams({
    startDate,
    endDate,
  });
  return q.toString();
}

async function safeCountGet(pathWithQuery: string): Promise<number> {
  try {
    const data = await apiClient.get<unknown>(pathWithQuery);
    return parseApiCountPayload(data);
  } catch {
    return 0;
  }
}

/** GET /orders/orders/count-by-date-range */
export async function fetchOrderCountByDateRange(from: Date, to: Date): Promise<number> {
  const qs = toQueryRange(from, to);
  return safeCountGet(`${API_CONFIG.ENDPOINTS.ORDERS.COUNT_BY_DATE_RANGE}?${qs}`);
}

/** GET /invoice/invoices/count-by-date-range */
export async function fetchInvoiceCountByDateRange(from: Date, to: Date): Promise<number> {
  const qs = toQueryRange(from, to);
  return safeCountGet(`${API_CONFIG.ENDPOINTS.INVOICES.COUNT_BY_DATE_RANGE}?${qs}`);
}

export interface SalesRoutesSnapshot {
  salesRoutesTotal: number;
  salesRoutesActive: number;
  /** id → nombre para enriquecer pedidos en el panel. */
  routeNameById: Record<string, string>;
  /** id → código de ruta (misma semántica que detalle de pedido). */
  routeCodeById: Record<string, string>;
}

export async function fetchSalesRoutesSnapshot(): Promise<SalesRoutesSnapshot> {
  try {
    const routes = await salesRoutesApi.fetchAll();
    const routeNameById: Record<string, string> = {};
    const routeCodeById: Record<string, string> = {};
    for (const r of routes) {
      routeNameById[r.id] = r.name;
      const code = (r.code ?? '').trim();
      if (code) routeCodeById[r.id] = code;
    }
    return {
      salesRoutesTotal: routes.length,
      salesRoutesActive: routes.filter((x: any) => x?.isActive !== false && x?.IsActive !== false).length,
      routeNameById,
      routeCodeById,
    };
  } catch {
    return { salesRoutesTotal: 0, salesRoutesActive: 0, routeNameById: {}, routeCodeById: {} };
  }
}

function normUserKey(v: string | undefined | null): string {
  return String(v ?? '').trim().toLowerCase();
}

function displayNameFromUser(u: { firstName?: string; lastName?: string; email?: string }): string {
  const fn = String(u.firstName ?? '').trim();
  const ln = String(u.lastName ?? '').trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  return String(u.email ?? '').trim();
}

/**
 * Completa nombre de ruta desde catálogo y vendedor/ruta desde usuarios cuando el listado de pedidos viene plano.
 */
export async function enrichPendingOrdersForDashboard(
  orders: OrderForUI[],
  routeNameById: Record<string, string>
): Promise<OrderForUI[]> {
  if (!orders.length) return orders;

  const needsCatalogRouteName = orders.some((o) => {
    const rid = String(o.salesRouteId ?? '').trim();
    return !!rid && !o.salesRouteName?.trim() && !!routeNameById[rid]?.trim();
  });
  const needsUserFetch = orders.some((o) => {
    const sid = String(o.salespersonId ?? '').trim();
    if (!sid) return false;
    return !o.salespersonName?.trim() || !o.salesRouteId?.trim() || !o.salesRouteName?.trim();
  });
  if (!needsCatalogRouteName && !needsUserFetch) return orders;

  let users: Awaited<ReturnType<typeof usersApi.fetchAll>> = [];
  if (needsUserFetch) {
    try {
      users = await usersApi.fetchAll();
    } catch {
      users = [];
    }
  }

  const userByKey = new Map<string, (typeof users)[0]>();
  for (const u of users) {
    userByKey.set(normUserKey(u.id), u);
    if (u.identityUserId) userByKey.set(normUserKey(u.identityUserId), u);
  }

  return orders.map((o) => {
    let next = { ...o };
    const sid = String(o.salespersonId ?? '').trim();
    if (sid && users.length) {
      const u = userByKey.get(normUserKey(sid));
      if (u) {
        if (!next.salespersonName?.trim()) {
          const nm = displayNameFromUser(u);
          if (nm) next = { ...next, salespersonName: nm };
        }
        if (!next.salesRouteId?.trim()) {
          const rid = String(u.salesRouteId ?? extractSalesRouteId(u as any) ?? '').trim();
          if (rid) next = { ...next, salesRouteId: rid };
        }
        if (!next.salesRouteName?.trim()) {
          const rn = String(u.salesRouteName ?? extractSalesRouteName(u as any) ?? '').trim();
          if (rn) next = { ...next, salesRouteName: rn };
        }
      }
    }
    const routeId = String(next.salesRouteId ?? '').trim();
    if (routeId && !next.salesRouteName?.trim()) {
      const cat = routeNameById[routeId]?.trim();
      if (cat) next = { ...next, salesRouteName: cat };
    }
    return next;
  });
}

export interface DashboardVolumeCounts {
  ordersToday: number;
  invoicesToday: number;
  ordersYesterday: number;
  invoicesYesterday: number;
  ordersThisMonth: number;
  invoicesThisMonth: number;
}

/** Conteos: hoy, ayer (para variación), mes (6 GET en paralelo). */
export async function fetchDashboardVolumeCounts(now = new Date()): Promise<DashboardVolumeCounts> {
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0, 0);
  const yesterdayStart = startOfLocalDay(y);
  const yesterdayEnd = endOfLocalDay(y);

  const monthStart = startOfLocalMonth(now);
  const monthEnd = endOfLocalMonth(now);

  const [ordersToday, invoicesToday, ordersYesterday, invoicesYesterday, ordersThisMonth, invoicesThisMonth] =
    await Promise.all([
      fetchOrderCountByDateRange(dayStart, dayEnd),
      fetchInvoiceCountByDateRange(dayStart, dayEnd),
      fetchOrderCountByDateRange(yesterdayStart, yesterdayEnd),
      fetchInvoiceCountByDateRange(yesterdayStart, yesterdayEnd),
      fetchOrderCountByDateRange(monthStart, monthEnd),
      fetchInvoiceCountByDateRange(monthStart, monthEnd),
    ]);

  return {
    ordersToday,
    invoicesToday,
    ordersYesterday,
    invoicesYesterday,
    ordersThisMonth,
    invoicesThisMonth,
  };
}

/** Solo campos de volumen (sin catálogo). */
export function volumeCountsToStatsPartial(
  volume: DashboardVolumeCounts
): Pick<
  DashboardStats,
  | 'ordersToday'
  | 'invoicesToday'
  | 'ordersYesterday'
  | 'invoicesYesterday'
  | 'ordersThisMonth'
  | 'invoicesThisMonth'
> {
  return { ...volume };
}
