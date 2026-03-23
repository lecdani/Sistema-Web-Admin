import { apiClient, API_BASE_URL } from '@/shared/config/api';
import { histpricesApi } from '@/shared/services/histprices-api';
import { productsApi } from '@/shared/services/products-api';
import type { Product } from '@/shared/types';

/**
 * Tipos ligeros para pedidos obtenidos desde la API real.
 * No reutilizamos el tipo local `Order` porque en el admin
 * los pedidos simulados usan otro flujo basado en localStorage.
 */
export interface AdminOrderSummary {
  id: string;
  backendOrderId?: string | number;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  salespersonId?: string;
  salespersonName?: string;
  date: string; // ISO string
  deliveryDate?: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  invoiceId?: string | number;
  /** Código PO (Purchase Order), único. */
  po?: string;
  /** ID del planograma asociado al pedido (tabla orders.planogram_id). */
  planogramId?: string;
}

export interface OrderDiscrepancyItem {
  productId: string;
  sku?: string;
  productName?: string;
  orderedQty: number;
  deliveredQty: number;
  difference: number;
}

function normDiscrepancyKey(s: string): string {
  return String(s || '')
    .trim()
    .replace(/-/g, '')
    .toLowerCase();
}

/**
 * Si el endpoint de discrepancias no devuelve filas, calcula faltantes comparando
 * líneas del pedido con líneas de factura (mismas claves que en la vista de factura).
 */
export function computeOrderInvoiceShortfall(
  orderItems: Array<{
    productId?: string;
    ProductId?: string;
    productName?: string;
    sku?: string;
    quantity?: number;
    toOrder?: number;
  }>,
  invoiceLines: Array<{ qty: number; code: string; description: string }>
): OrderDiscrepancyItem[] {
  if (!orderItems?.length || !invoiceLines?.length) return [];

  const deliveredByCode = new Map<string, number>();
  for (const line of invoiceLines) {
    const c = String(line.code || '').trim();
    if (!c || c === '—') continue;
    const k = normDiscrepancyKey(c);
    const q = Number(line.qty) || 0;
    deliveredByCode.set(k, (deliveredByCode.get(k) ?? 0) + q);
  }

  const out: OrderDiscrepancyItem[] = [];
  for (const it of orderItems) {
    /** Cantidades del pedido inicial (líneas del pedido al crearse / order details). */
    const ordered =
      Number(
        (it as any).quantity ??
          (it as any).toOrder ??
          (it as any).Quantity ??
          (it as any).ToOrder ??
          (it as any).originalQuantity ??
          (it as any).OriginalQuantity ??
          (it as any).requestedQuantity ??
          (it as any).RequestedQuantity ??
          0
      ) || 0;
    if (ordered <= 0) continue;

    const pid = String((it as any).productId ?? (it as any).ProductId ?? '').trim();
    const sku = String(
      (it as any).sku ??
        (it as any).Sku ??
        (it as any).code ??
        (it as any).Code ??
        (it as any).productCode ??
        (it as any).ProductCode ??
        ''
    ).trim();

    const extraCodes = [
      sku,
      pid,
      String((it as any).barcode ?? (it as any).Barcode ?? '').trim(),
    ].filter(Boolean);

    let delivered = 0;
    for (const raw of extraCodes) {
      const k = normDiscrepancyKey(raw);
      if (!k) continue;
      const v = deliveredByCode.get(k) ?? 0;
      if (v > delivered) delivered = v;
    }

    if (ordered > delivered) {
      const diff = ordered - delivered;
      out.push({
        productId: pid,
        sku: sku || undefined,
        productName: String((it as any).productName ?? '').trim() || undefined,
        orderedQty: ordered,
        deliveredQty: delivered,
        difference: diff,
      });
    }
  }
  return out;
}

function mapRawDiscrepancyRow(r: any): OrderDiscrepancyItem {
  const row = r?.line ?? r?.Line ?? r?.item ?? r?.Item ?? r;

  const shortFallRaw = Number(
    row?.shortFall ??
      row?.shortfall ??
      row?.ShortFall ??
      row?.missingQty ??
      row?.MissingQty ??
      row?.shortQty ??
      row?.ShortQty ??
      row?.quantityShort ??
      row?.QuantityShort ??
      Number.NaN
  );

  let orderedQty = Number(
    row?.orderedQty ??
      row?.OrderedQty ??
      row?.orderQty ??
      row?.OrderQty ??
      row?.quantityOrdered ??
      row?.QuantityOrdered ??
      row?.ordered_qty ??
      row?.qtyOrdered ??
      row?.QtyOrdered ??
      row?.requested ??
      row?.Requested ??
      row?.orderQuantity ??
      row?.OrderQuantity ??
      0
  );
  let deliveredQty = Number(
    row?.deliveredQty ??
      row?.DeliveredQty ??
      row?.invoiceQty ??
      row?.InvoiceQty ??
      row?.quantityDelivered ??
      row?.QuantityDelivered ??
      row?.delivered_qty ??
      row?.qtyDelivered ??
      row?.QtyDelivered ??
      row?.billedQty ??
      row?.BilledQty ??
      row?.invoicedQty ??
      row?.InvoicedQty ??
      row?.received ??
      row?.Received ??
      0
  );

  if (!Number.isFinite(orderedQty)) orderedQty = 0;
  if (!Number.isFinite(deliveredQty)) deliveredQty = 0;

  if (Number.isFinite(shortFallRaw) && shortFallRaw > 0) {
    if (orderedQty <= 0 && deliveredQty >= 0) {
      orderedQty = deliveredQty + shortFallRaw;
    }
    if (orderedQty > 0 && deliveredQty === 0 && shortFallRaw <= orderedQty) {
      deliveredQty = orderedQty - shortFallRaw;
    }
  }

  const differenceRaw = Number(
    row?.difference ?? row?.Difference ?? row?.delta ?? row?.Delta ?? row?.diff ?? row?.Diff ?? Number.NaN
  );
  const difference = Number.isFinite(differenceRaw)
    ? differenceRaw
    : orderedQty - deliveredQty;

  const prod = row?.product ?? row?.Product ?? {};

  return {
    productId: String(
      row?.productId ?? row?.ProductId ?? prod?.id ?? prod?.Id ?? row?.id ?? row?.Id ?? ''
    ).trim(),
    sku:
      String(
        row?.sku ??
          row?.Sku ??
          row?.code ??
          row?.Code ??
          row?.productCode ??
          row?.ProductCode ??
          prod?.sku ??
          prod?.Sku ??
          prod?.code ??
          prod?.Code ??
          ''
      ).trim() || undefined,
    productName:
      String(
        row?.productName ??
          row?.ProductName ??
          prod?.name ??
          prod?.Name ??
          row?.description ??
          row?.Description ??
          ''
      ).trim() || undefined,
    orderedQty,
    deliveredQty,
    difference,
  };
}

// Igual que PWA: list?.data ?? list?.items ?? []
function normalizeOrderListResponse(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw?.Results && Array.isArray(raw.Results)) return raw.Results;
  if (raw?.orders && Array.isArray(raw.orders)) return raw.orders;
  if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw)) {
      if (Array.isArray(v)) return v as any[];
    }
  }
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  if (raw?.items && Array.isArray(raw.items)) return raw.items;
  if (raw?.value && Array.isArray(raw.value)) return raw.value;
  return [];
}

/** Mismo contrato que el backend .NET: 1=Creado, 2=Facturado, 3=Cancelado */
export const ORDER_STATUS_CODE = {
  created: 1,
  invoiced: 2,
  cancelled: 3,
} as const;

/**
 * Normaliza status de API (número o texto) a etiquetas de UI alineadas con la PWA.
 */
function normalizeBackendOrderStatus(raw: any): string {
  const inner = raw?.data ?? raw?.order ?? raw?.Order ?? raw?.value ?? raw?.result ?? raw;
  const v =
    inner?.status ??
    inner?.Status ??
    inner?.isInvoiced ??
    inner?.IsInvoiced ??
    inner?.orderStatus ??
    inner?.OrderStatus ??
    inner?.state ??
    inner?.State ??
    raw?.status ??
    raw?.Status ??
    raw?.isInvoiced ??
    raw?.IsInvoiced ??
    raw?.orderStatus ??
    raw?.OrderStatus ??
    raw?.state ??
    raw?.State;
  if (v === true) return 'invoiced';
  if (v === false) return 'initial';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v === ORDER_STATUS_CODE.cancelled) return 'cancelled';
    if (v === ORDER_STATUS_CODE.invoiced) return 'invoiced';
    if (v === ORDER_STATUS_CODE.created) return 'initial';
  }
  const sTrim = String(v ?? '').trim();
  if (/^\d+$/.test(sTrim)) {
    const n = Number(sTrim);
    if (n === 3) return 'cancelled';
    if (n === 2) return 'invoiced';
    if (n === 1) return 'initial';
  }
  const s = sTrim.toLowerCase();
  if (s === 'cancelled' || s === 'canceled' || s === 'cancelado' || s === 'anulado' || s === 'void') {
    return 'cancelled';
  }
  if (
    s === 'invoiced' ||
    s === 'facturado' ||
    s === 'invoice' ||
    s === 'billed' ||
    s === 'facturada' ||
    s === 'delivered'
  ) {
    return 'invoiced';
  }
  if (s === 'created' || s === 'creado' || s === 'pending' || s === 'initial' || s === 'new') {
    return 'initial';
  }
  // Legacy: tratar como facturado (backend oficial: 1 creado, 2 facturado, 3 cancelado)
  if (s === 'completed' || s === 'confirmado' || s === 'confirmed') return 'invoiced';
  return sTrim || 'initial';
}

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapRawOrderToAdmin(raw: any): AdminOrderSummary | null {
  const id =
    raw?.orderId ??
    raw?.OrderId ??
    raw?.id ??
    raw?.Id ??
    '';
  if (id == null || `${id}`.trim() === '') return null;

  const createdAt =
    raw?.createdAt ??
    raw?.CreatedAt ??
    raw?.date ??
    raw?.Date ??
    new Date().toISOString();

  // Mismos campos que PWA mapRawOrderToUI
  const subtotalRaw = raw?.subtotal ?? raw?.Subtotal ?? raw?.SubTotal;
  const taxRaw = raw?.tax ?? raw?.Tax;
  const totalRaw =
    raw?.total ??
    raw?.Total ??
    raw?.orderTotal ??
    raw?.OrderTotal ??
    raw?.amount ??
    raw?.Amount ??
    raw?.invoice?.total ??
    raw?.Invoice?.Total ??
    raw?.invoice?.amount ??
    raw?.Invoice?.Amount;

  const subtotal = Number(subtotalRaw ?? 0) || 0;
  const tax = Number(taxRaw ?? 0) || 0;
  let total = Number(totalRaw ?? 0) || 0;
  if (total <= 0 && subtotal > 0) {
    total = subtotal + tax;
  }

  const salespersonIdRaw =
    raw?.salespersonId ??
    raw?.SalespersonId ??
    raw?.userId ??
    raw?.UserId;

  const storeNameVal =
    raw?.storeName ?? raw?.StoreName ?? raw?.store?.name ?? raw?.Store?.Name ?? '';
  const salespersonNameVal =
    typeof (raw?.salespersonName ?? raw?.SalespersonName ?? raw?.sellerName ?? raw?.SellerName ?? raw?.user?.name) === 'string'
      ? (raw?.salespersonName ?? raw?.SalespersonName ?? raw?.sellerName ?? raw?.SellerName ?? raw?.user?.name as string).trim()
      : (raw?.user?.firstName != null || raw?.user?.lastName != null)
        ? `${raw?.user?.firstName ?? ''} ${raw?.user?.lastName ?? ''}`.trim()
        : '';

  return {
    id: String(id),
    backendOrderId: raw?.orderId ?? raw?.OrderId ?? raw?.id ?? raw?.Id,
    storeId: String(raw?.storeId ?? raw?.StoreId ?? ''),
    storeName: (typeof storeNameVal === 'string' ? storeNameVal : '').trim() || '—',
    storeAddress:
      raw?.storeAddress ??
      raw?.StoreAddress ??
      raw?.store?.address ??
      raw?.Store?.Address,
    salespersonId:
      salespersonIdRaw != null && salespersonIdRaw !== ''
        ? String(salespersonIdRaw)
        : undefined,
    salespersonName: salespersonNameVal || undefined,
    date:
      typeof createdAt === 'string'
        ? createdAt
        : createdAt instanceof Date
        ? createdAt.toISOString()
        : new Date().toISOString(),
    deliveryDate: raw?.deliveryDate ?? raw?.DeliveryDate,
    status: normalizeBackendOrderStatus(raw),
    subtotal,
    tax,
    total,
    invoiceId:
      raw?.invoiceId ??
      raw?.InvoiceId ??
      raw?.invoice?.id ??
      raw?.Invoice?.Id,
    po: raw?.po ?? raw?.Po ?? raw?.purchaseOrder ?? raw?.PurchaseOrder ?? raw?.PO ?? undefined,
    planogramId:
      (raw?.planogramId ?? raw?.planogram_id ?? '').trim()
        ? String(raw?.planogramId ?? raw?.planogram_id ?? '').trim()
        : undefined,
  };
}

/**
 * Devuelve todos los pedidos de un vendedor directamente desde la API .NET
 * usando GET /orders/orders/user/{id}.
 */
export async function fetchOrdersBySalespersonId(userId: string): Promise<AdminOrderSummary[]> {
  if (!userId || !`${userId}`.trim()) return [];

  try {
    const raw = await apiClient.get<any>(
      `/orders/orders/user/${encodeURIComponent(String(userId))}`
    );
    const list = normalizeOrderListResponse(raw);
    const mapped = list
      .map((item) => mapRawOrderToAdmin(item))
      .filter((o): o is AdminOrderSummary => o != null);
    return mapped;
  } catch (error) {
    console.error('[orders-api] Error al obtener pedidos por vendedor:', error);
    return [];
  }
}

/**
 * Devuelve solo los pedidos completados para un vendedor.
 * Considera como completados los que tienen status 'completed', 'invoiced' o 'delivered'.
 */
export async function fetchCompletedOrdersBySalespersonId(userId: string): Promise<AdminOrderSummary[]> {
  const all = await fetchOrdersBySalespersonId(userId);
  return all.filter((o) => {
    const s = (o.status || '').toLowerCase();
    return (
      s === 'completed' ||
      s === 'invoiced' ||
      s === 'delivered' ||
      s === '2'
    );
  });
}

/**
 * Construye un mapa orderId -> { total, subtotal } desde la lista de facturas (API).
 * Así el listado puede mostrar total/subtotal aunque el pedido no los traiga.
 */
// Igual que PWA getOrdersByUser: byOrderId con inv.orderId ?? inv.OrderId ?? inv.order?.id ?? inv.Order?.Id
async function buildInvoiceTotalsByOrderId(): Promise<Map<string, { total: number; subtotal: number }>> {
  const map = new Map<string, { total: number; subtotal: number }>();
  try {
    const invoices = await getInvoiceList();
    for (const inv of invoices as any[]) {
      const orderId =
        inv?.orderId ??
        inv?.OrderId ??
        inv?.order_id ??
        inv?.Order_Id ??
        inv?.order?.id ??
        inv?.Order?.Id;
      if (orderId == null) continue;
      const key = String(orderId).trim();
      if (!key) continue;
      let total = Number(
        inv?.total ??
          inv?.Total ??
          inv?.amount ??
          inv?.Amount ??
          inv?.grandTotal ??
          inv?.GrandTotal ??
          0
      );
      let subtotal = Number(
        inv?.subtotal ??
          inv?.Subtotal ??
          inv?.SubTotal ??
          inv?.totalBeforeTax ??
          inv?.TotalBeforeTax ??
          0
      );
      const details =
        inv?.invoiceDetails ??
        inv?.InvoiceDetails ??
        inv?.details ??
        inv?.Details ??
        inv?.items ??
        inv?.Items ??
        [];
      const detailsArr = Array.isArray(details) ? details : [];
      if (total <= 0 && detailsArr.length > 0) {
        total = detailsArr.reduce(
          (s: number, d: any) =>
            s +
            Number(
              d?.subtotal ??
                d?.Subtotal ??
                d?.SubTotal ??
                d?.total ??
                d?.Total ??
                0
            ),
          0
        );
      }
      if (subtotal <= 0 && total > 0) subtotal = total;
      if (total > 0 || subtotal > 0) {
        map.set(key, { total: total || subtotal, subtotal: subtotal || total });
      }
    }
  } catch (e) {
    // No romper el listado si falla facturas
  }
  return map;
}

/**
 * Devuelve todos los pedidos del sistema (resumen por pedido).
 * Usa GET /orders/orders y enriquece total/subtotal desde GET /invoice/invoices
 * cuando el pedido no los trae (todo desde la API).
 */
export async function fetchAllOrderSummaries(): Promise<AdminOrderSummary[]> {
  try {
    const [raw, invoiceTotalsByOrderId] = await Promise.all([
      apiClient.get<any>('/orders/orders'),
      buildInvoiceTotalsByOrderId(),
    ]);
    const list = normalizeOrderListResponse(raw);
    const mapped = list
      .map((item) => mapRawOrderToAdmin(item))
      .filter((o): o is AdminOrderSummary => o != null);

    // Enriquecer total/subtotal desde facturas cuando el pedido no los trae
    for (const o of mapped) {
      if (o.total > 0 && o.subtotal > 0) continue;
      const key = o.id || (o.backendOrderId != null ? String(o.backendOrderId) : '');
      if (!key) continue;
      const fromInv =
        invoiceTotalsByOrderId.get(key) ??
        invoiceTotalsByOrderId.get(String(o.backendOrderId ?? ''));
      if (fromInv) {
        if (o.subtotal <= 0) o.subtotal = fromInv.subtotal;
        if (o.total <= 0) o.total = fromInv.total;
      }
    }
    return mapped;
  } catch (error) {
    console.error('[orders-api] Error al obtener todos los pedidos:', error);
    return [];
  }
}

/**
 * Indica si un código PO ya está en uso por otro pedido (para validación al editar PO).
 * excludeOrderId: al editar, ese pedido se ignora (mismo PO del mismo pedido permitido).
 */
export async function isPoAlreadyUsed(
  po: string,
  options?: { excludeOrderId?: string }
): Promise<boolean> {
  const poNorm = (po ?? '').trim().toLowerCase();
  if (!poNorm) return false;
  const all = await fetchAllOrderSummaries();
  const excludeId = options?.excludeOrderId ? String(options.excludeOrderId).trim() : '';
  return all.some((o) => {
    const oid = String(o.id ?? o.backendOrderId ?? '').trim();
    if (excludeId && (oid === excludeId || String(o.backendOrderId ?? '').trim() === excludeId))
      return false;
    const opo = (o.po ?? '').trim().toLowerCase();
    return opo === poNorm;
  });
}

// ============================
// Tipos y helpers para CRUD de pedidos (API real, compartido con la PWA)
// ============================

export interface OrderItemInput {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface CreateOrderInput {
  storeId: string;
  storeName?: string;
  storeAddress?: string;
  salespersonId?: string;
  vendorNumber?: string;
  /** Código PO (Purchase Order), único en el sistema. */
  po?: string;
  items: OrderItemInput[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface CreatedOrderResult {
  orderId: number | string;
  invoiceId?: number | string;
}

interface ApiError extends Error {
  response?: Response;
  data?: any;
  status?: number;
}

async function safePost<T>(endpoint: string, body: unknown): Promise<T | null> {
  try {
    return await apiClient.post<T>(endpoint, body);
  } catch (error) {
    const err = error as ApiError;
    console.error('[orders-api] POST', endpoint, 'failed:', err.message || err);
    return null;
  }
}

async function safePut<T>(endpoint: string, body: unknown): Promise<T | null> {
  try {
    if (typeof body === 'string') {
      return await apiClient.putBody<T>(endpoint, body);
    }
    return await apiClient.put<T>(endpoint, body);
  } catch (error) {
    const err = error as ApiError;
    console.error('[orders-api] PUT', endpoint, 'failed:', err.message || err);
    return null;
  }
}

/** UpdateStatusCommand: orderId + newStatus (camelCase o PascalCase; número o nombre enum C#). */
function orderStatusEnumNameAdmin(code: 1 | 2 | 3): 'Created' | 'Invoiced' | 'Canceled' {
  if (code === 1) return 'Created';
  if (code === 2) return 'Invoiced';
  return 'Canceled';
}

async function putOrderStatusUntilOkAdmin(orderId: string, statusCode: 1 | 2 | 3): Promise<boolean> {
  const id = String(orderId).trim();
  if (!id) return false;
  const n = Number(statusCode);
  if (!Number.isInteger(n) || n < 1 || n > 3) return false;
  const name = orderStatusEnumNameAdmin(statusCode);
  const path = `/orders/order/${encodeURIComponent(id)}/status`;
  const candidates = [
    JSON.stringify({ orderId: id, newStatus: n }),
    JSON.stringify({ OrderId: id, NewStatus: n }),
    JSON.stringify({ orderId: id, newStatus: name }),
    JSON.stringify({ OrderId: id, NewStatus: name }),
  ];
  for (const payload of candidates) {
    const res = await safePut<any>(path, payload);
    if (res !== null) return true;
  }
  return false;
}

async function safePatch<T>(endpoint: string, body: unknown): Promise<T | null> {
  try {
    return await apiClient.patch<T>(endpoint, body);
  } catch (error) {
    const err = error as ApiError;
    console.error('[orders-api] PATCH', endpoint, 'failed:', err.message || err);
    return null;
  }
}

async function safeDelete<T>(endpoint: string): Promise<T | null> {
  try {
    return await apiClient.delete<T>(endpoint);
  } catch (error) {
    const err = error as ApiError;
    console.error('[orders-api] DELETE', endpoint, 'failed:', err.message || err);
    return null;
  }
}

async function safeGet<T>(endpoint: string): Promise<T | null> {
  try {
    return await apiClient.get<T>(endpoint);
  } catch (error) {
    const err = error as ApiError;
    // Si el backend responde 404, para este servicio lo interpretamos como "sin datos"
    if ((err as any)?.status === 404) {
      return null;
    }
    console.error('[orders-api] GET', endpoint, 'failed:', err.message || err);
    return null;
  }
}

/** Primer array no vacío dentro de un objeto (hasta 2 niveles). */
function extractFirstArray(obj: any, depth = 0): any[] | null {
  if (obj == null || depth > 2) return null;
  if (Array.isArray(obj)) return obj.length > 0 ? obj : null;
  if (typeof obj !== 'object') return null;
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) return v.length > 0 ? (v as any[]) : null;
    const nested = extractFirstArray(v, depth + 1);
    if (nested && nested.length > 0) return nested;
  }
  return null;
}

function peelInvoiceLayers(obj: any, maxDepth = 8): any[] {
  const out: any[] = [];
  const seen = new Set<any>();
  let cur: any = obj;
  let d = 0;
  while (cur != null && typeof cur === 'object' && d < maxDepth) {
    if (seen.has(cur)) break;
    seen.add(cur);
    out.push(cur);
    const next =
      cur?.data ??
      cur?.Data ??
      cur?.value ??
      cur?.Value ??
      cur?.invoice ??
      cur?.Invoice ??
      cur?.result ??
      cur?.Result ??
      null;
    if (next == null || typeof next !== 'object') break;
    cur = next;
    d++;
  }
  return out;
}

function firstPositiveNumericFromLayers(layers: any[], keys: string[]): number {
  for (const L of layers) {
    if (!L || typeof L !== 'object') continue;
    for (const k of keys) {
      const n = Number((L as any)[k]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 0;
}

// Lista de facturas: soporta .NET (value, Data), arrays y objetos con data/invoices/items
function normalizeInvoiceList(list: any): any[] {
  if (list == null) return [];
  if (Array.isArray(list)) return list;
  const arr =
    (list as any).value ??
    (list as any).Value ??
    (list as any).Data ??
    (list as any).Results ??
    (list as any).invoices ??
    (list as any).data ??
    (list as any).items ??
    (list as any).Items ??
    [];
  return Array.isArray(arr) ? arr : [];
}

async function getInvoiceList(): Promise<any[]> {
  const list = await safeGet<any>('/invoice/invoices');
  return normalizeInvoiceList(list);
}

async function getInvoiceById(invoiceId: string): Promise<any | null> {
  const id = String(invoiceId).trim();
  if (!id) return null;
  let one = await safeGet<any>(
    `/invoice/invoices/${encodeURIComponent(id)}`
  );
  if (one == null) {
    one = await safeGet<any>(
      `/invoice/invoice/${encodeURIComponent(id)}`
    );
  }
  if (one == null) return null;
  /** Respuesta completa: POD puede ir en el wrapper y líneas en data/invoice. */
  return one;
}

/** Lee la ruta/link del POD de la factura (igual que PWA: en BD se guarda la ruta, ej. imagenes/Dani.png). */
function getPodFromInvoice(inv: any): string {
  if (inv == null) return '';
  const podKeys = [
    'pod',
    'Pod',
    'POD',
    'podUrl',
    'PodUrl',
    'podImageUrl',
    'PodImageUrl',
    'podPath',
    'PodPath',
    'ruta',
    'Ruta',
    'imagePath',
    'ImagePath',
    'filePath',
    'FilePath',
    'fileName',
    'FileName',
    'PodFileName',
    'podFileName',
    'url',
    'Url',
    'link',
    'Link',
    'Reference',
    'reference',
  ] as const;
  const layers = peelInvoiceLayers(inv);
  const seen = new Set<any>();
  for (const root of layers) {
    if (root == null || typeof root !== 'object' || seen.has(root)) continue;
    seen.add(root);
    for (const pk of podKeys) {
      const v = (root as any)[pk];
      const str = typeof v === 'string' ? v.trim() : v != null && v !== '' ? String(v).trim() : '';
      if (str) return str;
    }
    const base64 = (root as any)?.podBase64 ?? (root as any)?.PodBase64;
    if (typeof base64 === 'string' && base64.length > 0) {
      return `data:image/png;base64,${base64}`;
    }
  }
  return '';
}

// Formato de pedido para la UI (muy similar al usado en la PWA)
export interface OrderForUI {
  id: string;
  backendOrderId?: number | string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  date: string;
  deliveryDate?: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    toOrder?: number;
    quantity?: number;
    price: number;
    row?: number;
    col?: number;
  }>;
  totalUnits: number;
  subtotal: number;
  tax: number;
  total: number;
  podRequired?: boolean;
  podUploaded?: boolean;
  podImageUrl?: string;
  podFileName?: string;
  vendorNumber?: string;
  comments?: string;
  invoiceId?: number | string;
  salespersonId?: string;
  /** Código PO (Purchase Order), único. */
  po?: string;
  /** ID del planograma asociado al pedido (tabla orders.planogram_id). */
  planogramId?: string;
}

function detailQuantity(d: any): number {
  const n = Number(
    d?.quantity ??
      d?.Quantity ??
      d?.qty ??
      d?.Qty ??
      d?.invoiceQty ??
      d?.InvoiceQty ??
      d?.deliveredQuantity ??
      d?.DeliveredQuantity ??
      d?.deliveredQty ??
      d?.DeliveredQty ??
      0
  );
  return Number.isFinite(n) ? n : 0;
}

function detailSubtotal(d: any): number {
  const n = Number(
    d?.subtotal ??
      d?.Subtotal ??
      d?.SubTotal ??
      d?.lineTotal ??
      d?.LineTotal ??
      d?.amount ??
      d?.Amount ??
      d?.total ??
      d?.Total ??
      d?.price ??
      d?.Price ??
      0
  );
  if (Number.isFinite(n) && n > 0) return n;
  const qty = detailQuantity(d);
  const up = Number(d?.unitPrice ?? d?.UnitPrice ?? 0);
  if (qty > 0 && up > 0) return qty * up;
  return Number.isFinite(n) ? n : 0;
}

function detailProductId(d: any): string {
  return String(
    d?.productId ??
      d?.ProductId ??
      d?.product_id ??
      d?.product?.id ??
      d?.Product?.Id ??
      ''
  ).trim();
}

function detailProductName(d: any): string {
  const fromDetail =
    d?.productName ??
    d?.ProductName ??
    d?.description ??
    d?.Description ??
    d?.name ??
    d?.Name ??
    d?.product?.name ??
    d?.Product?.Name ??
    d?.product?.description ??
    d?.Product?.Description ??
    d?.product?.productName ??
    d?.Product?.ProductName ??
    '';
  return (typeof fromDetail === 'string' ? fromDetail : '').trim();
}

/** ¿Parece línea de pedido/factura? (misma lógica que PWA orders-api). */
function isLineLikeRecord(el: any): boolean {
  if (el == null || typeof el !== 'object' || Array.isArray(el)) return false;
  const pid = detailProductId(el);
  const sku = String(el?.sku ?? el?.Sku ?? '').trim();
  return pid.length > 0 || sku.length > 0;
}

function isInvoiceLineCandidate(el: any): boolean {
  if (el == null || typeof el !== 'object' || Array.isArray(el)) return false;
  if (isLineLikeRecord(el)) return true;
  if (el?.product && typeof el.product === 'object') return true;
  if (el?.Product && typeof el.Product === 'object') return true;
  const nm = (
    detailProductName(el) ||
    String(el?.code ?? el?.Code ?? el?.itemCode ?? el?.ItemCode ?? el?.description ?? el?.Description ?? '').trim()
  );
  const sub = detailSubtotal(el);
  const q = detailQuantity(el);
  if (nm.length > 0 && (sub > 0 || q > 0)) return true;
  const lineId = String(
    el?.invoiceDetailId ??
      el?.InvoiceDetailId ??
      el?.orderDetailId ??
      el?.OrderDetailId ??
      el?.lineNumber ??
      el?.LineNumber ??
      ''
  ).trim();
  if (lineId.length > 0 && (sub > 0 || q > 0)) return true;
  if (q > 0 && sub > 0) return true;
  return false;
}

/** Barrido del JSON de factura para encontrar el array de líneas (como PWA). */
function findBestInvoiceDetailsArray(raw: any): any[] {
  if (raw == null) return [];
  const buckets: any[][] = [];
  const seenNodes = new WeakSet<object>();
  const seenArrays = new Set<any>();

  function visit(obj: any, depth: number) {
    if (obj == null || depth > 16) return;
    if (typeof obj !== 'object') return;
    if (seenNodes.has(obj)) return;
    seenNodes.add(obj);
    if (Array.isArray(obj)) {
      for (const el of obj) visit(el, depth + 1);
      return;
    }
    for (const v of Object.values(obj)) {
      if (!Array.isArray(v) || v.length === 0 || seenArrays.has(v)) continue;
      const first = v[0];
      if (first && typeof first === 'object' && !Array.isArray(first) && isInvoiceLineCandidate(first)) {
        seenArrays.add(v);
        buckets.push(v);
      }
    }
    for (const v of Object.values(obj)) {
      if (v != null && typeof v === 'object') visit(v, depth + 1);
    }
  }

  visit(raw, 0);
  if (buckets.length === 0) return [];
  buckets.sort((a, b) => b.length - a.length);
  return buckets[0];
}

function extractOrderDetailsFromRaw(raw: any): any[] {
  if (!raw) return [];
  const nested =
    raw?.orderDetails ??
    raw?.OrderDetails ??
    raw?.details ??
    raw?.Details ??
    raw?.items ??
    raw?.Items;
  return Array.isArray(nested) ? nested : [];
}

/**
 * Subtotal/total desde líneas del pedido en el listado (pedidos sin factura o total 0), con histprices por familia.
 */
async function computeMonetaryTotalsFromOrderRaw(raw: any): Promise<{ subtotal: number; total: number } | null> {
  const details = extractOrderDetailsFromRaw(raw);
  if (!details.length) return null;
  const tax = Number(raw?.tax ?? raw?.Tax ?? 0);
  let sub = 0;
  for (const d of details) {
    const qty = Number(d?.quantity ?? d?.Quantity ?? 0);
    if (qty <= 0) continue;
    let price = Number(
      d?.unitPrice ??
        d?.UnitPrice ??
        d?.price ??
        d?.Price ??
        d?.product?.unitPrice ??
        d?.Product?.UnitPrice ??
        0
    );
    const subRow = Number(d?.subtotal ?? d?.Subtotal ?? d?.SubTotal ?? 0);
    if (!(price > 0) && subRow > 0) price = subRow / qty;
    const pid = String(d?.productId ?? d?.ProductId ?? '').trim();
    if (!(price > 0) && pid) {
      try {
        const product = await productsApi.getById(pid);
        const fid = String((product as any)?.familyId ?? product?.categoryId ?? '').trim();
        if (fid) {
          const hp = await histpricesApi.getLatest(fid);
          price = hp?.price ?? 0;
        }
      } catch {
        /* ignore */
      }
    }
    sub += qty * price;
  }
  if (!(sub > 0)) return null;
  return { subtotal: sub, total: sub + tax };
}

function normalizeDetailList(raw: any): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  const detailKeys = [
    'invoiceDetails',
    'InvoiceDetails',
    'details',
    'Details',
    'items',
    'Items',
    'invoiceItems',
    'InvoiceItems',
    'lines',
    'Lines',
    'invoiceLines',
    'InvoiceLines',
  ] as const;
  const layers = peelInvoiceLayers(raw);
  const seenLayers = new Set<any>();
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object' || seenLayers.has(layer)) continue;
    seenLayers.add(layer);
    for (const k of detailKeys) {
      const v = (layer as any)[k];
      if (Array.isArray(v)) return v;
    }
  }
  const fallbackKeys = detailKeys.map((k) => (raw as any)?.[k]).find((v) => Array.isArray(v));
  if (Array.isArray(fallbackKeys)) return fallbackKeys;
  const extracted = extractFirstArray(raw);
  return Array.isArray(extracted) ? extracted : [];
}

const productNameCache = new Map<string, { name: string; sku: string }>();

async function enrichOrderItemsWithProductNames(
  items: OrderForUI['items']
): Promise<OrderForUI['items']> {
  if (!items?.length) return items;
  const out = [...items];
  for (let i = 0; i < out.length; i++) {
    const item = out[i];
    const pid = String(item?.productId ?? '').trim();
    const currentName = String(item?.productName ?? '').trim();
    const currentSku = String(item?.sku ?? '').trim();
    if (!pid) continue;
    if (currentName && !/^[0-9a-f-]{36}$/i.test(currentName) && !/^\d+$/.test(currentName)) {
      continue;
    }
    let cached = productNameCache.get(pid);
    if (!cached) {
      const product = await productsApi.getById(pid);
      cached = product
        ? {
            name: product.name || '',
            sku: String(product.sku || (product as any).code || '').trim() || '',
          }
        : { name: currentName, sku: currentSku };
      productNameCache.set(pid, cached);
    }
    out[i] = {
      ...item,
      productName: cached.name || item.productName,
      sku: cached.sku || item.sku,
    };
  }
  return out;
}

function mapRawOrderToUI(raw: any, details: any[] = []): OrderForUI {
  const id = String(
    raw?.orderId ?? raw?.OrderId ?? raw?.id ?? raw?.Id ?? ''
  );
  const date =
    raw?.createdAt ?? raw?.CreatedAt ?? raw?.date ?? raw?.Date ?? new Date().toISOString();
  const planogramIdRaw =
    (raw?.planogramId ??
      raw?.PlanogramId ??
      raw?.planogram_id ??
      raw?.PLANOGRAM_ID ??
      '') as string;
  const items = (details || []).map((d: any) => {
    const qty = Number(d?.quantity ?? d?.Quantity ?? 0);
    const subtotalRow = Number(
      d?.subtotal ?? d?.Subtotal ?? d?.SubTotal ?? 0
    );
    const unitPrice =
      Number(
        d?.unitPrice ??
          d?.UnitPrice ??
          d?.price ??
          d?.Price ??
          d?.product?.unitPrice ??
          d?.Product?.UnitPrice ??
          0
      ) || (qty > 0 && subtotalRow > 0 ? subtotalRow / qty : 0);
    return {
      productId: String(d?.productId ?? d?.ProductId ?? ''),
      productName: String(
        d?.productName ??
          d?.ProductName ??
          d?.product?.name ??
          d?.Product?.Name ??
          d?.description ??
          d?.Description ??
          d?.name ??
          d?.Name ??
          ''
      ).trim(),
      sku: String(
        d?.sku ??
          d?.Sku ??
          d?.product?.sku ??
          d?.Product?.Sku ??
          d?.code ??
          d?.Code ??
          d?.productCode ??
          d?.ProductCode ??
          d?.product?.code ??
          d?.Product?.Code ??
          ''
      ),
      toOrder: qty,
      quantity: qty,
      price: unitPrice,
      row: d?.row ?? d?.Row,
      col: d?.col ?? d?.Col ?? d?.column ?? d?.Column,
    };
  });
  const rawTotal =
    raw?.total ??
    raw?.Total ??
    raw?.orderTotal ??
    raw?.OrderTotal ??
    raw?.amount ??
    raw?.Amount ??
    raw?.totalAmount ??
    raw?.TotalAmount ??
    raw?.grandTotal ??
    raw?.GrandTotal ??
    raw?.invoice?.total ??
    raw?.Invoice?.Total ??
    raw?.invoice?.amount ??
    raw?.Invoice?.Amount;
  let total = Number(rawTotal ?? 0);
  let subtotal = Number(
    raw?.subtotal ?? raw?.Subtotal ?? raw?.SubTotal ?? total
  );
  const tax = Number(raw?.tax ?? raw?.Tax ?? 0);
  const totalUnits = items.reduce(
    (s, i) => s + (i.quantity ?? i.toOrder ?? 0),
    0
  );
  const computedSubtotal = items.reduce(
    (s, i) => s + (i.quantity ?? i.toOrder ?? 0) * (i.price || 0),
    0
  );
  if (subtotal === 0 && computedSubtotal > 0) subtotal = computedSubtotal;
  if (total === 0 && computedSubtotal > 0) total = computedSubtotal + tax;
  if (total === 0 && subtotal > 0) total = subtotal + tax;
  const salespersonIdRaw =
    raw?.salespersonId ??
    raw?.SalespersonId ??
    raw?.userId ??
    raw?.UserId;
  return {
    id,
    backendOrderId: raw?.orderId ?? raw?.OrderId ?? raw?.id ?? raw?.Id,
    storeId: String(raw?.storeId ?? raw?.StoreId ?? ''),
    storeName: String(
      raw?.storeName ??
        raw?.StoreName ??
        raw?.store?.name ??
        raw?.Store?.Name ??
        ''
    ).trim() || '—',
    storeAddress:
      raw?.storeAddress ??
      raw?.StoreAddress ??
      raw?.store?.address ??
      raw?.Store?.Address ??
      '',
    date:
      typeof date === 'string'
        ? date
        : date instanceof Date
        ? date.toISOString()
        : new Date().toISOString(),
    deliveryDate: raw?.deliveryDate ?? raw?.DeliveryDate,
    status: normalizeBackendOrderStatus(raw),
    items,
    totalUnits,
    subtotal,
    tax,
    total,
    podRequired: true,
    podUploaded: !!raw?.podUploaded || !!raw?.PodUploaded,
    podImageUrl: raw?.podImageUrl ?? raw?.PodImageUrl,
    podFileName: raw?.podFileName ?? raw?.PodFileName,
    vendorNumber: raw?.vendorNumber ?? raw?.VendorNumber,
    comments: raw?.comments ?? raw?.Comments,
    po: raw?.po ?? raw?.Po ?? raw?.purchaseOrder ?? raw?.PurchaseOrder ?? raw?.PO ?? undefined,
    planogramId: (planogramIdRaw || '').trim() || undefined,
    invoiceId:
      raw?.invoiceId ??
      raw?.InvoiceId ??
      raw?.invoice?.id ??
      raw?.Invoice?.Id,
    salespersonId: salespersonIdRaw != null ? String(salespersonIdRaw) : undefined,
  };
}

// API de pedidos usada también por el Admin (basada en la implementación de la PWA)
export const ordersApi = {
  /**
   * Lista todos los pedidos (rápido: solo 2 peticiones).
   * GET /orders/orders + GET /invoice/invoices. Total desde factura. Sin getOrderById por pedido.
   * El detalle completo se carga al abrir un pedido (getOrderById).
   */
  async getAllOrders(): Promise<OrderForUI[]> {
    const [ordersRaw, invoicesRaw] = await Promise.all([
      safeGet<any>('/orders/orders'),
      safeGet<any>('/invoice/invoices'),
    ]);

    const ordersArr: any[] = Array.isArray(ordersRaw)
      ? ordersRaw
      : ordersRaw?.data ?? ordersRaw?.Data ?? ordersRaw?.items ?? ordersRaw?.value ?? ordersRaw?.Value ?? ordersRaw?.orders ?? ordersRaw?.Orders ?? [];
    const invoicesList: any[] = Array.isArray(invoicesRaw)
      ? invoicesRaw
      : invoicesRaw?.value ?? invoicesRaw?.Value ?? invoicesRaw?.data ?? invoicesRaw?.Data ?? invoicesRaw?.invoices ?? invoicesRaw?.items ?? invoicesRaw?.Items ?? [];

    if (!ordersArr.length) return [];

    const byOrderId = new Map<string, any>();
    const byInvoiceId = new Map<string, any>();
    invoicesList.forEach((inv: any) => {
      const root = inv?.data ?? inv?.value ?? inv?.invoice ?? inv;
      const oid = String(
        root?.orderId ?? root?.OrderId ?? inv?.orderId ?? inv?.OrderId ?? root?.order?.id ?? root?.Order?.Id ?? ''
      );
      if (oid) {
        byOrderId.set(oid, inv);
        if (!Number.isNaN(Number(oid))) byOrderId.set(String(Number(oid)), inv);
      }
      const invId = String(root?.id ?? root?.Id ?? inv?.id ?? inv?.Id ?? inv?.invoiceId ?? inv?.InvoiceId ?? '');
      if (invId) byInvoiceId.set(invId, inv);
    });

    const sumFromDetails = (rawInv: any): number => {
      const inv = rawInv?.data ?? rawInv?.value ?? rawInv?.invoice ?? rawInv;
      const details = inv?.invoiceDetails ?? inv?.InvoiceDetails ?? inv?.details ?? inv?.Details ?? inv?.items ?? inv?.Items ?? [];
      const arr = Array.isArray(details) ? details : [];
      return arr.reduce(
        (s: number, d: any) =>
          s + Number(d?.subtotal ?? d?.Subtotal ?? d?.SubTotal ?? d?.total ?? d?.Total ?? 0),
        0
      );
    };

    const getTotalFromInv = (rawInv: any): number => {
      if (!rawInv) return 0;
      const inv = rawInv?.data ?? rawInv?.value ?? rawInv?.invoice ?? rawInv;
      let t = Number(
        inv?.totalUsd ?? inv?.TotalUsd ?? inv?.amountUsd ?? inv?.AmountUsd ??
        inv?.total ?? inv?.Total ?? inv?.amount ?? inv?.Amount ??
        inv?.totalAmount ?? inv?.TotalAmount ?? inv?.grandTotal ?? inv?.GrandTotal ?? 0
      );
      if (t <= 0) t = sumFromDetails(rawInv);
      return t;
    };

    const mapped = await Promise.all(
      ordersArr.map(async (raw) => {
        const summary = mapRawOrderToAdmin(raw);
        if (!summary) return null;

        const oid = String(summary.id);
        const rawInv =
          byOrderId.get(oid) ??
          byOrderId.get(String(Number(oid))) ??
          (summary.invoiceId != null ? byInvoiceId.get(String(summary.invoiceId)) : null);
        const totalFromInv = rawInv ? getTotalFromInv(rawInv) : 0;
        let total = Number(summary.total) > 0 ? summary.total : totalFromInv;
        let subtotal = Number(summary.subtotal) > 0 ? summary.subtotal : total;

        if (total <= 0 && !rawInv) {
          const fromLines = await computeMonetaryTotalsFromOrderRaw(raw);
          if (fromLines) {
            subtotal = fromLines.subtotal;
            total = fromLines.total;
          }
        }

        return {
          id: summary.id,
          backendOrderId: summary.backendOrderId ?? summary.id,
          storeId: summary.storeId,
          storeName: summary.storeName,
          storeAddress: summary.storeAddress,
          date: summary.date,
          deliveryDate: summary.deliveryDate,
          status: summary.status,
          items: [] as OrderForUI['items'],
          totalUnits: 0,
          subtotal: subtotal || total,
          tax: summary.tax,
          total,
          salespersonId: summary.salespersonId,
          invoiceId: summary.invoiceId,
          po: summary.po,
          planogramId: summary.planogramId,
        } satisfies OrderForUI;
      })
    );
    return mapped.filter((o): o is OrderForUI => o != null);
  },
  /**
   * Crea un pedido con Unit of Work (header + detalles en un solo POST /orders/orders).
   */
  async createOrder(input: CreateOrderInput): Promise<CreatedOrderResult | null> {
    const generatedOrderId = generateUuidV4();
    const mappedItems = input.items.map((item) => {
      const detailId = generateUuidV4();
      return {
        orderDetailId: detailId,
        OrderDetailId: detailId,
        productId: item.productId,
        ProductId: item.productId,
        quantity: Number(item.quantity) || 0,
        Quantity: Number(item.quantity) || 0,
      };
    });

    const payload: Record<string, unknown> = {
      id: generatedOrderId,
      Id: generatedOrderId,
      storeId: input.storeId,
      StoreId: input.storeId,
      salespersonId: input.salespersonId,
      SalespersonId: input.salespersonId,
      items: mappedItems,
      Items: mappedItems,
    };
    const poTrimmed = (input.po ?? '').trim();
    if (poTrimmed) {
      payload.po = poTrimmed;
      payload.Po = poTrimmed;
    }
    if ((input.planogramId ?? '').trim()) {
      const pid = String(input.planogramId).trim();
      payload.planogramId = pid;
      payload.PlanogramId = pid;
      payload.planogram_id = pid;
      payload.PLANOGRAM_ID = pid;
    }

    const createdOrder = await safePost<any>('/orders/orders', payload);
    if (!createdOrder) {
      return null;
    }

    let createdOrderId: string | number | null = null;
    if (typeof createdOrder === 'string' && createdOrder.trim().length > 0) {
      createdOrderId = createdOrder.trim();
    } else if (typeof createdOrder === 'object') {
      createdOrderId =
        createdOrder.orderId ??
        createdOrder.OrderId ??
        createdOrder.id ??
        createdOrder.Id ??
        createdOrder.data?.orderId ??
        createdOrder.data?.OrderId ??
        createdOrder.data?.id ??
        createdOrder.data?.Id ??
        (typeof createdOrder.data === 'string' ? createdOrder.data : null) ??
        createdOrder.value?.orderId ??
        createdOrder.value?.id ??
        (typeof createdOrder.value === 'string' ? createdOrder.value : null) ??
        null;
    }

    if (createdOrderId == null || createdOrderId === '') {
      console.warn('[orders-api] createOrder: respuesta sin orderId.', createdOrder);
      return null;
    }

    const invoiceId =
      createdOrder?.invoiceId ??
      createdOrder?.InvoiceId ??
      createdOrder?.data?.invoiceId ??
      createdOrder?.data?.InvoiceId ??
      createdOrder?.value?.invoiceId ??
      createdOrder?.value?.InvoiceId;

    return { orderId: createdOrderId, invoiceId };
  },

  /**
   * Lista pedidos del usuario con totales enriquecidos desde la factura.
   * GET /orders/orders/user/{id} + GET /invoice/invoices
   */
  // Nota: getOrdersByUser se usa solo en la PWA (un vendedor). En el Admin usamos getAllOrders (todos los vendedores) + getOrderById; misma lógica de total/subtotal desde facturas.

  /**
   * Obtiene un pedido por id. Los detalles ahora vienen en el propio payload de la orden.
   */
  async getOrderById(orderId: string): Promise<OrderForUI | null> {
    const raw = await safeGet<any>(`/orders/orders/${encodeURIComponent(orderId)}`);
    if (!raw) return null;
    let details: any[] = [];
    if (!details.length && raw) {
      const nested =
        raw?.orderDetails ??
        raw?.OrderDetails ??
        raw?.details ??
        raw?.Details ??
        raw?.items ??
        raw?.Items;
      details = Array.isArray(nested) ? nested : [];
    }
    const backendId =
      raw?.orderId ?? raw?.OrderId ?? raw?.id ?? raw?.Id ?? orderId;
    if (!details?.length && backendId !== orderId) {
      const altDetails = await ordersApi.getOrderDetailsByOrderIdRaw(
        String(backendId)
      );
      if (altDetails?.length) details = altDetails;
    }
    const result = mapRawOrderToUI(raw, details);
    if (result?.items?.length) {
      result.items = await enrichOrderItemsWithProductNames(result.items);
    }
    if (result && (result.invoiceId == null || result.invoiceId === '')) {
      const invId =
        (await ordersApi.getInvoiceIdForOrder(orderId)) ??
        (await ordersApi.getInvoiceIdForOrder(String(backendId)));
      if (invId != null) result.invoiceId = invId;
    }
    // Una sola factura: POD + total (la factura ya trae pod y orderId)
    let invoice: any = null;
    if (result?.invoiceId) invoice = await getInvoiceById(String(result.invoiceId));
    if (!invoice && result) invoice = await ordersApi.getInvoiceForOrder(orderId);
    if (invoice) {
      const podText = getPodFromInvoice(invoice);
      if (podText) {
        result.podImageUrl = result.podImageUrl || podText;
        result.podFileName = result.podFileName || podText;
        if (!result.podUploaded) result.podUploaded = true;
      }
      if (result.total <= 0 || result.subtotal <= 0) {
        const layers = peelInvoiceLayers(invoice);
        const totalKeys = [
          'total',
          'Total',
          'amount',
          'Amount',
          'totalUsd',
          'TotalUsd',
          'totalAmount',
          'TotalAmount',
        ];
        let invTotal = firstPositiveNumericFromLayers(layers, totalKeys);
        if (invTotal <= 0) {
          const arr = normalizeDetailList(invoice);
          invTotal = arr.reduce((s: number, d: any) => s + Number(d?.subtotal ?? d?.Subtotal ?? d?.total ?? d?.Total ?? 0), 0);
        }
        if (invTotal > 0) {
          if (result.total <= 0) result.total = invTotal;
          if (result.subtotal <= 0) result.subtotal = invTotal;
        }
      }
    }
    if (result && result.subtotal <= 0 && result.total > 0) result.subtotal = result.total;
    // Si sigue en 0, calcular desde items
    if (result && result.total <= 0 && result.items?.length) {
      const computed = result.items.reduce(
        (s, i) => s + (i.quantity ?? i.toOrder ?? 0) * (Number(i.price) || 0),
        0
      );
      if (computed > 0) {
        result.total = computed;
        if (result.subtotal <= 0) result.subtotal = computed;
      }
    }
    return result;
  },

  /**
   * Detalles de un pedido desde GET /orders/orders/{orderId}.
   */
  async getOrderDetailsByOrderIdRaw(orderId: string): Promise<any[]> {
    const list = await safeGet<any>(`/orders/orders/${encodeURIComponent(orderId)}`);
    if (list == null) return [];
    const root =
      list?.order ??
      list?.Order ??
      list?.data ??
      list?.Data ??
      list?.value ??
      list?.Value ??
      list;
    if (Array.isArray(root)) return root;
    const arr =
      root?.orderDetails ??
      root?.OrderDetails ??
      root?.details ??
      root?.Details ??
      root?.items ??
      root?.Items ??
      [];
    return Array.isArray(arr) ? arr : [];
  },

  /**
   * Detalles de factura por invoiceId desde GET /invoice/invoices/{invoiceId}.
   * El backend devuelve la factura con sus detalles anidados.
   */
  async getInvoiceDetailsByInvoiceId(invoiceId: string): Promise<any[]> {
    const id = String(invoiceId).trim();
    if (!id) return [];
    const invoice = await getInvoiceById(id);
    return normalizeDetailList(invoice ?? null);
  },

  /**
   * Total desde la factura asociada a un pedido.
   * Desenvuelve inv.data/inv.value por si la API devuelve la factura anidada.
   */
  async getInvoiceTotalForOrder(orderId: string): Promise<number> {
    const raw = await ordersApi.getInvoiceForOrder(orderId);
    if (!raw) return 0;
    const layers = peelInvoiceLayers(raw);
    const totalKeys = [
      'totalUsd',
      'TotalUsd',
      'amountUsd',
      'AmountUsd',
      'total',
      'Total',
      'amount',
      'Amount',
      'totalAmount',
      'TotalAmount',
      'grandTotal',
      'GrandTotal',
    ];
    let total = firstPositiveNumericFromLayers(layers, totalKeys);
    if (total <= 0) {
      const arr = normalizeDetailList(raw);
      total = arr.reduce(
        (s: number, d: any) =>
          s +
          Number(
            d?.subtotal ??
              d?.Subtotal ??
              d?.SubTotal ??
              d?.total ??
              d?.Total ??
              0
          ),
        0
      );
    }
    return total;
  },

  /**
   * Datos de la factura para pantalla (igual que en la PWA).
   * - Factura: GET /invoice/invoices/{id} cuando hay invoiceId.
   * - Detalles: del cuerpo de la factura (anidados en la misma respuesta).
   */
  /** Igual que PWA: datos de factura para pantalla (invoiceNumber, date, total, items). */
  async getInvoiceDisplayForOrder(
    orderId: string,
    optionalInvoiceId?: string | number,
    /** Pedido ya cargado: evita GET duplicado y alinea cruce SKU/productId con líneas de factura. */
    orderForLines?: OrderForUI | null
  ): Promise<{
    subtotal: number;
    invoiceNumber: string;
    date: string;
    total: number;
    storeId?: string;
    pod?: string;
    items: Array<{
      qty: number;
      code: string;
      description: string;
      price: number;
      amount: number;
    }>;
  } | null> {
    let invId = '';
    let invoice: any = null;
    let rawInvoice: any = null;

    if (optionalInvoiceId != null && String(optionalInvoiceId).trim()) {
      invId = String(optionalInvoiceId).trim();
    }
    if (!invId) {
      const idFromList = await ordersApi.getInvoiceIdForOrder(orderId);
      if (idFromList != null) invId = String(idFromList);
    }
    if (!invId) {
      const fromList = await ordersApi.getInvoiceForOrder(orderId);
      invoice = fromList;
      rawInvoice = fromList;
      if (invoice?.data && typeof invoice.data === 'object') invoice = invoice.data;
      if (invoice?.invoice && typeof invoice.invoice === 'object') invoice = invoice.invoice;
      if (invoice != null) {
        invId = String(
          invoice?.id ?? invoice?.Id ?? invoice?.invoiceId ?? invoice?.InvoiceId ?? ''
        ).trim();
      }
    }

    const order = orderForLines ?? (await ordersApi.getOrderById(orderId));
    if (!invId && order?.invoiceId != null) invId = String(order.invoiceId);
    if (!invId && order?.backendOrderId != null) {
      const byBackend = await ordersApi.getInvoiceIdForOrder(String(order.backendOrderId));
      if (byBackend != null) invId = String(byBackend);
    }
    if (!invId) return null;

    const invoiceById = await getInvoiceById(invId);
    const rawForInvoice = invoiceById ?? rawInvoice ?? invoice;
    if (rawForInvoice == null) return null;
    const layers = peelInvoiceLayers(rawForInvoice);
    invoice =
      layers[layers.length - 1] ??
      rawForInvoice?.data ??
      rawForInvoice?.Data ??
      rawForInvoice?.invoice ??
      rawForInvoice?.Invoice ??
      rawForInvoice?.value ??
      rawForInvoice?.Value ??
      rawForInvoice;

    let details = normalizeDetailList(rawForInvoice);
    if (details.length === 0) details = findBestInvoiceDetailsArray(rawForInvoice);
    if (details.length === 0) details = await ordersApi.getInvoiceDetailsByInvoiceId(invId);

    const orderItemsByProduct = new Map<
      string,
      { productName?: string; sku?: string; price?: number }
    >();
    if (order?.items) {
      order.items.forEach((i: any) => {
        const pid = String(i?.productId ?? i?.ProductId ?? '');
        if (pid) {
          orderItemsByProduct.set(pid, {
            productName: i.productName ?? i.ProductName,
            sku: i.sku ?? i.Sku,
            price: Number(i?.price ?? i?.Price) || 0,
          });
        }
      });
    }

    const filtered = details.filter((d: any) => detailQuantity(d) > 0);
    const detailsToUse = filtered.length > 0 ? filtered : details;

    const items = await Promise.all(
      detailsToUse.map(async (d: any) => {
        const qty = detailQuantity(d);
        let amount = detailSubtotal(d);
        let price = qty > 0 ? amount / qty : 0;
        const pid = detailProductId(d);
        const orderItem = orderItemsByProduct.get(pid);
        let product: Product | null = null;
        if (pid) {
          try {
            product = await productsApi.getById(pid);
          } catch {
            product = null;
          }
        }
        let description = (
          detailProductName(d) ||
          orderItem?.productName ||
          orderItem?.sku ||
          ''
        ).trim();
        if (!description && product) {
          description = (product.name || product.sku || '').trim();
        }
        description = description || '—';
        // SKU comercial preferente; si falta todo, usar productId para cruzar planograma/factura (misma línea útil que UUID en PWA).
        const codeFromSku =
          String(orderItem?.sku || '').trim() ||
          String(product?.sku || '').trim() ||
          String(d?.sku ?? d?.Sku ?? d?.product?.sku ?? d?.Product?.Sku ?? '').trim() ||
          String(product?.code || '').trim() ||
          '';
        const code = codeFromSku || (pid ? String(pid) : '—');
        if ((price === 0 || amount === 0) && pid) {
          let latestPrice = orderItem?.price && orderItem.price > 0 ? orderItem.price : 0;
          if (!(latestPrice > 0)) {
            const p = product ?? (await productsApi.getById(pid).catch(() => null));
            const familyId = String((p as any)?.familyId ?? p?.categoryId ?? '').trim();
            latestPrice = familyId ? await histpricesApi.getLatest(familyId).then((pr) => pr?.price ?? 0) : 0;
          }
          price = latestPrice;
          amount = qty * price;
        }
        return { qty, code, description, price, amount };
      })
    );

    const totalKeys = [
      'totalUsd',
      'TotalUsd',
      'amountUsd',
      'AmountUsd',
      'total',
      'Total',
      'amount',
      'Amount',
      'totalAmount',
      'TotalAmount',
    ];
    let total = firstPositiveNumericFromLayers(layers, totalKeys);
    if (total <= 0) {
      total = Number(
        invoice?.totalUsd ??
          invoice?.TotalUsd ??
          invoice?.amountUsd ??
          invoice?.AmountUsd ??
          invoice?.total ??
          invoice?.Total ??
          invoice?.amount ??
          invoice?.Amount ??
          0
      );
    }
    const totalFromDetails = items.reduce((s, i) => s + i.amount, 0);
    const subtotalKeys = ['subtotal', 'Subtotal', 'SubTotal', 'totalBeforeTax', 'TotalBeforeTax'];
    let subtotalFromInvoice = firstPositiveNumericFromLayers(layers, subtotalKeys);
    if (subtotalFromInvoice <= 0) {
      subtotalFromInvoice = Number(
        invoice?.subtotal ??
          invoice?.Subtotal ??
          invoice?.SubTotal ??
          invoice?.totalBeforeTax ??
          invoice?.TotalBeforeTax ??
          0
      );
    }
    const subtotal = subtotalFromInvoice > 0 ? subtotalFromInvoice : totalFromDetails;
    const dateFields = ['date', 'Date', 'createdAt', 'CreatedAt', 'invoiceDate', 'InvoiceDate'];
    let date: string | undefined;
    for (const L of layers) {
      if (!L || typeof L !== 'object') continue;
      for (const k of dateFields) {
        const v = (L as any)[k];
        if (v != null && v !== '') {
          date = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v);
          break;
        }
      }
      if (date) break;
    }
    if (!date) {
      date =
        (invoice?.date ??
          invoice?.Date ??
          invoice?.createdAt ??
          invoice?.CreatedAt ??
          order?.date ??
          new Date().toISOString()) as string;
    }
    const invNumber =
      invoice?.invoiceNumber ??
      invoice?.InvoiceNumber ??
      invoice?.invoiceId ??
      invoice?.InvoiceId ??
      invId;

    const pod = getPodFromInvoice(rawForInvoice);
    const dateOut = (typeof date === 'string' && date ? date : new Date().toISOString()) as string;
    return {
      invoiceNumber: String(invNumber),
      date: dateOut,
      total: total > 0 ? total : totalFromDetails,
      subtotal: subtotal > 0 ? subtotal : totalFromDetails,
      storeId: invoice?.storeId ?? invoice?.StoreId ?? order?.storeId,
      items,
      pod: pod || undefined,
    };
  },

  /**
   * Discrepancias pedido vs factura.
   * Prueba GET /orders/orders/dicrepancies/{id}, /orders/dicrepancies/{id} (typo histórico) y /orders/discrepancies/{id}.
   */
  async getOrderDiscrepancies(orderId: string): Promise<OrderDiscrepancyItem[]> {
    const id = String(orderId || '').trim();
    if (!id) return [];

    let raw = await safeGet<any>(
      `/orders/orders/dicrepancies/${encodeURIComponent(id)}`
    );
    if (raw == null) {
      raw = await safeGet<any>(
        `/orders/dicrepancies/${encodeURIComponent(id)}`
      );
    }
    if (raw == null) {
      raw = await safeGet<any>(
        `/orders/discrepancies/${encodeURIComponent(id)}`
      );
    }
    if (!raw) return [];

    let list: any[] = Array.isArray(raw)
      ? raw
      : raw?.results ??
        raw?.Results ??
        raw?.data ??
        raw?.Data ??
        raw?.items ??
        raw?.Items ??
        raw?.value ??
        raw?.Value ??
        raw?.discrepancies ??
        raw?.Discrepancies ??
        raw?.orderDiscrepancies ??
        raw?.OrderDiscrepancies ??
        raw?.lines ??
        raw?.Lines ??
        [];

    if (!Array.isArray(list) || list.length === 0) {
      const nested =
        raw?.order?.discrepancies ??
        raw?.Order?.Discrepancies ??
        raw?.invoice?.lines ??
        raw?.Invoice?.Lines;
      if (Array.isArray(nested) && nested.length) list = nested;
    }
    if (!Array.isArray(list) || list.length === 0) {
      const extracted = extractFirstArray(raw);
      if (extracted && extracted.length) list = extracted;
    }

    const rows = Array.isArray(list) ? list : [];
    return rows.map((r: any) => mapRawDiscrepancyRow(r));
  },

  /**
   * Devuelve el objeto factura para un pedido (para cálculos internos).
   */
  async getInvoiceForOrder(orderId: string): Promise<any | null> {
    const orderIdStr = String(orderId).toLowerCase();
    const arr = await getInvoiceList();
    const found = (arr as any[]).find((x: any) => {
      const invOrder =
        x?.orderId ??
        x?.OrderId ??
        x?.order_id ??
        x?.Order_Id ??
        x?.order?.id ??
        x?.Order?.Id;
      if (invOrder == null) return false;
      return String(invOrder).toLowerCase() === orderIdStr || String(invOrder) === String(orderId);
    });
    return found ?? null;
  },

  /**
   * Obtiene el id de la factura asociada a un pedido.
   */
  async getInvoiceIdForOrder(orderId: string): Promise<string | number | null> {
    const orderIdStr = String(orderId).toLowerCase();
    const orderIdNum = Number(orderId);
    const arr = await getInvoiceList();
    const found = (arr as any[]).find((x: any) => {
      const invOrder =
        x?.orderId ??
        x?.OrderId ??
        x?.order_id ??
        x?.Order_Id ??
        x?.order?.id ??
        x?.Order?.Id;
      if (invOrder == null) return false;
      if (String(invOrder).toLowerCase() === orderIdStr) return true;
      if (String(invOrder) === String(orderId)) return true;
      if (!Number.isNaN(orderIdNum) && Number(invOrder) === orderIdNum)
        return true;
      return false;
    });
    if (found) {
      const id =
        found?.id ?? found?.Id ?? found?.invoiceId ?? found?.InvoiceId;
      return id != null ? id : null;
    }
    return null;
  },

  /**
   * Actualiza el estado del pedido (como en la PWA).
   * PUT /orders/order/{id}/status — body Swagger: { orderId, newStatus } (1=Creado, 2=Facturado, 3=Cancelado).
   * isInvoiced === false: no-op (evita PUT con newStatus=1 si el backend rechaza 1→1).
   */
  async updateOrderStatus(orderId: string | number, isInvoiced: boolean = true): Promise<boolean> {
    const idStr = String(orderId).trim();
    if (!isInvoiced) {
      return true;
    }
    return putOrderStatusUntilOkAdmin(idStr, ORDER_STATUS_CODE.invoiced);
  },

  /**
   * Actualiza un pedido existente (tienda, ítems, totales). Como en la PWA.
   * PUT order header, sync orderdetails, PUT invoice e invoicedetails.
   */
  async updateOrder(
    orderId: string | number,
    input: CreateOrderInput,
    optionalInvoiceId?: string | number | null
  ): Promise<boolean> {
    void orderId;
    void input;
    void optionalInvoiceId;
    return false;
  },

  /**
   * Elimina un pedido. Solo debe aplicarse a pedidos pendientes (sin POD).
   */
  async deleteOrder(orderId: string | number): Promise<boolean> {
    const res = await safeDelete<any>(
      `/orders/orders/${encodeURIComponent(String(orderId))}`
    );
    return res !== null;
  },

  /**
   * Asocia el POD a la factura enviando solo el fileName (clave en S3).
   * La imagen debe subirse antes con POST /images/upload; este PATCH solo envía el link/fileName.
   * PATCH /invoice/invoices/{id}/pod — body: { pod: fileName } (sin base64).
   */
  async uploadPODForInvoice(params: {
    invoiceId: number | string;
    /** Nombre del archivo devuelto por POST /images/upload (clave S3). */
    fileName: string;
    notes?: string;
  }): Promise<boolean> {
    const id = String(params.invoiceId).trim();
    const fileName = (params.fileName || '').trim();
    if (!fileName) return false;
    const body: Record<string, unknown> = { id, pod: fileName };
    if (params.notes) body.notes = params.notes;
    const res = await safePatch<any>(`/invoice/invoices/${encodeURIComponent(id)}/pod`, body);
    return res !== null && res !== undefined;
  },

  /**
   * Obtiene todas las facturas con sus detalles para reportes de ventas (admin).
   * Usa GET /invoice/invoices y, cuando haga falta, GET /invoice/invoices/{id}.
   */
  async getInvoicesForSalesReport(): Promise<
    Array<{
      invoiceId: string;
      orderId: string;
      storeId: string;
      storeName?: string;
      sellerId: string;
      sellerName?: string;
      issueDate: string;
      invoiceNumber: string;
      details: Array<{
        productId: string;
        productName?: string;
        sku?: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>;
    }>
  > {
    const list = await safeGet<any>('/invoice/invoices');
    const invoicesList = normalizeInvoiceList(list ?? null);
    const result: Array<{
      invoiceId: string;
      orderId: string;
      storeId: string;
      storeName?: string;
      sellerId: string;
      sellerName?: string;
      issueDate: string;
      invoiceNumber: string;
      details: Array<{
        productId: string;
        productName?: string;
        sku?: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>;
    }> = [];

    for (const rawInv of invoicesList) {
      const inv = rawInv?.data ?? rawInv?.value ?? rawInv?.invoice ?? rawInv;
      const invoiceId = String(inv?.id ?? inv?.Id ?? rawInv?.id ?? rawInv?.Id ?? inv?.invoiceId ?? inv?.InvoiceId ?? '').trim();
      if (!invoiceId) continue;

      const orderId = String(inv?.orderId ?? inv?.OrderId ?? rawInv?.orderId ?? rawInv?.OrderId ?? '').trim();
      const storeId = String(inv?.storeId ?? inv?.StoreId ?? inv?.store?.id ?? inv?.Store?.Id ?? '').trim();
      const sellerId = String(inv?.salespersonId ?? inv?.SalespersonId ?? inv?.sellerId ?? inv?.SellerId ?? inv?.salesperson?.id ?? inv?.user?.id ?? '').trim();
      const storeName =
        inv?.storeName ?? inv?.StoreName ?? inv?.store?.name ?? inv?.Store?.Name ?? rawInv?.storeName ?? rawInv?.StoreName ?? undefined;
      const rawSellerName =
        inv?.sellerName ?? inv?.SellerName ?? inv?.salespersonName ?? inv?.SalespersonName ?? inv?.salesperson?.name ?? inv?.user?.name;
      let sellerName: string | undefined;
      if (typeof rawSellerName === 'string') sellerName = rawSellerName.trim();
      else if (rawSellerName && typeof rawSellerName === 'object') {
        const first = (rawSellerName as any)?.firstName ?? (rawSellerName as any)?.FirstName ?? '';
        const last = (rawSellerName as any)?.lastName ?? (rawSellerName as any)?.LastName ?? '';
        sellerName = `${first} ${last}`.trim() || undefined;
      }
      const issueDate =
        inv?.issueDate ?? inv?.IssueDate ?? inv?.date ?? inv?.Date ?? inv?.createdAt ?? inv?.CreatedAt ?? new Date().toISOString();
      const invoiceNumber = String(inv?.invoiceNumber ?? inv?.InvoiceNumber ?? inv?.number ?? inv?.Number ?? invoiceId).trim();

      let details = normalizeDetailList(inv);
      if (details.length === 0) details = await this.getInvoiceDetailsByInvoiceId(invoiceId);

      const detailRows: Array<{
        productId: string;
        productName?: string;
        sku?: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      for (const d of details) {
        const qty = Number(d?.quantity ?? d?.Quantity ?? d?.QuantitySold ?? 0) || 0;
        let unitPrice = Number(
          d?.unitPrice ?? d?.UnitPrice ?? d?.price ?? d?.Price ?? d?.unitPriceUsd ?? d?.UnitPriceUsd ?? d?.priceUsd ?? d?.PriceUsd ?? 0
        );
        let subtotal = Number(
          d?.subtotal ?? d?.Subtotal ?? d?.SubTotal ?? d?.total ?? d?.Total ?? d?.amount ?? d?.Amount ?? d?.lineTotal ?? d?.LineTotal ?? 0
        );
        if (unitPrice <= 0 && subtotal > 0 && qty > 0) unitPrice = subtotal / qty;
        if (subtotal <= 0 && unitPrice > 0 && qty > 0) subtotal = qty * unitPrice;
        if (unitPrice <= 0 && subtotal <= 0 && qty > 0) {
          const pid = String(d?.productId ?? d?.ProductId ?? '').trim();
          if (pid) {
            const product = await productsApi.getById(pid);
            const familyId = String((product as any)?.familyId ?? product?.categoryId ?? '').trim();
            const latest = familyId ? await histpricesApi.getLatest(familyId) : null;
            const p = latest?.price ?? 0;
            if (p > 0) {
              unitPrice = p;
              subtotal = qty * unitPrice;
            }
          }
        }
        detailRows.push({
          productId: String(d?.productId ?? d?.ProductId ?? ''),
          productName: d?.productName ?? d?.ProductName ?? d?.description ?? d?.Description,
          sku: d?.sku ?? d?.Sku ?? d?.code ?? d?.Code,
          quantity: qty,
          unitPrice,
          subtotal
        });
      }

      result.push({
        invoiceId,
        orderId,
        storeId,
        storeName: storeName || undefined,
        sellerId,
        sellerName: sellerName || undefined,
        issueDate: typeof issueDate === 'string' ? issueDate : new Date(issueDate).toISOString(),
        invoiceNumber,
        details: detailRows
      });
    }

    return result;
  },
};


