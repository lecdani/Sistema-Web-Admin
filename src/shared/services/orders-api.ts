import { apiClient, API_BASE_URL } from '@/shared/config/api';
import { histpricesApi } from '@/shared/services/histprices-api';
import { productsApi } from '@/shared/services/products-api';

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
    status: String(raw?.status ?? raw?.Status ?? raw?.orderStatus ?? raw?.OrderStatus ?? raw?.state ?? raw?.State ?? 'pending').trim() || 'pending',
    subtotal,
    tax,
    total,
    invoiceId:
      raw?.invoiceId ??
      raw?.InvoiceId ??
      raw?.invoice?.id ??
      raw?.Invoice?.Id,
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
    return s === 'completed' || s === 'invoiced' || s === 'delivered';
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
    return await apiClient.put<T>(endpoint, body);
  } catch (error) {
    const err = error as ApiError;
    console.error('[orders-api] PUT', endpoint, 'failed:', err.message || err);
    return null;
  }
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
  if ((one as any)?.data && typeof (one as any).data === 'object')
    return (one as any).data;
  if ((one as any)?.invoice && typeof (one as any).invoice === 'object')
    return (one as any).invoice;
  if ((one as any)?.value && typeof (one as any).value === 'object')
    return (one as any).value;
  return one;
}

/** Lee la ruta/link del POD de la factura (igual que PWA: en BD se guarda la ruta, ej. imagenes/Dani.png). */
function getPodFromInvoice(inv: any): string {
  if (inv == null) return '';
  const root = inv?.data ?? inv?.invoice ?? inv?.value ?? inv;
  const v =
    root?.pod ??
    root?.Pod ??
    root?.POD ??
    root?.podUrl ??
    root?.PodUrl ??
    root?.podImageUrl ??
    root?.PodImageUrl ??
    root?.podPath ??
    root?.PodPath ??
    root?.ruta ??
    root?.Ruta ??
    root?.imagePath ??
    root?.ImagePath ??
    root?.filePath ??
    root?.FilePath ??
    root?.fileName ??
    root?.FileName ??
    root?.PodFileName ??
    root?.url ??
    root?.Url ??
    root?.link ??
    root?.Link ??
    root?.Reference ??
    root?.reference;
  const str = typeof v === 'string' ? v.trim() : '';
  if (str) return str;
  const base64 = root?.podBase64 ?? root?.PodBase64;
  if (typeof base64 === 'string' && base64.length > 0) {
    return `data:image/png;base64,${base64}`;
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
}

function detailQuantity(d: any): number {
  const n = Number(
    d?.quantity ??
      d?.Quantity ??
      d?.qty ??
      d?.Qty ??
      d?.amount ??
      d?.Amount ??
      0
  );
  return Number.isFinite(n) ? n : 0;
}

function detailSubtotal(d: any): number {
  const n = Number(
    d?.subtotal ??
      d?.Subtotal ??
      d?.SubTotal ??
      d?.amount ??
      d?.Amount ??
      d?.total ??
      d?.Total ??
      d?.price ??
      d?.Price ??
      0
  );
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

function normalizeDetailList(raw: any): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  const arr =
    raw?.invoiceDetails ??
    raw?.InvoiceDetails ??
    raw?.details ??
    raw?.Details ??
    raw?.items ??
    raw?.Items ??
    raw?.data ??
    raw?.Data ??
    [];
  return Array.isArray(arr) ? arr : [];
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
        ? { name: product.name || '', sku: product.sku || '' }
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
        d?.sku ?? d?.Sku ?? d?.product?.sku ?? d?.Product?.Sku ?? ''
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
    status: String(raw?.status ?? raw?.Status ?? raw?.orderStatus ?? raw?.OrderStatus ?? raw?.state ?? raw?.State ?? 'pending').trim() || 'pending',
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

    const result: OrderForUI[] = [];
    for (const raw of ordersArr) {
      const summary = mapRawOrderToAdmin(raw);
      if (!summary) continue;

      const oid = String(summary.id);
      const rawInv =
        byOrderId.get(oid) ??
        byOrderId.get(String(Number(oid))) ??
        (summary.invoiceId != null ? byInvoiceId.get(String(summary.invoiceId)) : null);
      const totalFromInv = rawInv ? getTotalFromInv(rawInv) : 0;
      const total = Number(summary.total) > 0 ? summary.total : totalFromInv;

      result.push({
        id: summary.id,
        backendOrderId: summary.backendOrderId ?? summary.id,
        storeId: summary.storeId,
        storeName: summary.storeName,
        storeAddress: summary.storeAddress,
        date: summary.date,
        deliveryDate: summary.deliveryDate,
        status: summary.status,
        items: [],
        totalUnits: 0,
        subtotal: summary.subtotal || total,
        tax: summary.tax,
        total,
        salespersonId: summary.salespersonId,
        invoiceId: summary.invoiceId,
      });
    }
    return result;
  },
  /**
   * Crea un pedido en la API (header + detalles) usando:
   * - POST /orders/orders
   * - POST /orderdetails/orderdetails
   * - POST /invoice/invoices
   * - POST /invoicedetails/invoicedetails
   */
  async createOrder(input: CreateOrderInput): Promise<CreatedOrderResult | null> {
    const headerBody = {
      storeId: input.storeId,
      StoreId: input.storeId,
      salespersonId: input.salespersonId,
      SalespersonId: input.salespersonId,
      vendorNumber: input.vendorNumber,
      VendorNumber: input.vendorNumber,
      status: 'pending',
      Status: 'pending',
      createdAt: new Date().toISOString(),
      CreatedAt: new Date().toISOString(),
      subtotal: input.subtotal,
      Subtotal: input.subtotal,
      tax: input.tax,
      Tax: input.tax,
      total: input.total,
      Total: input.total,
    };

    const createdOrder = await safePost<any>('/orders/orders', headerBody);
    if (!createdOrder) {
      return null;
    }

    let orderId: string | number | null = null;
    if (typeof createdOrder === 'string' && createdOrder.trim().length > 0) {
      orderId = createdOrder.trim();
    } else if (typeof createdOrder === 'object') {
      orderId =
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

    if (orderId == null || orderId === '') {
      console.warn('[orders-api] createOrder: respuesta sin orderId.', createdOrder);
      return null;
    }

    // Detalles del pedido
    for (const item of input.items) {
      const detailBody = {
        orderId,
        OrderId: orderId,
        productId: item.productId,
        ProductId: item.productId,
        quantity: item.quantity,
        Quantity: item.quantity,
        unitPrice: item.price,
        UnitPrice: item.price,
        subtotal: item.quantity * item.price,
        Subtotal: item.quantity * item.price,
      };
      await safePost<any>('/orderdetails/orderdetails', detailBody);
    }

    // Crear factura e items de factura
    let invoiceId: number | string | undefined;
    const invoiceBody = {
      orderId,
      OrderId: orderId,
      storeId: input.storeId,
      StoreId: input.storeId,
      total: input.total,
      Total: input.total,
      subtotal: input.subtotal,
      Subtotal: input.subtotal,
      tax: input.tax,
      Tax: input.tax,
      createdAt: new Date().toISOString(),
      CreatedAt: new Date().toISOString(),
    };
    const invoiceRes = await safePost<any>('/invoice/invoices', invoiceBody);
    if (invoiceRes != null) {
      if (typeof invoiceRes === 'string' && invoiceRes.trim()) {
        invoiceId = invoiceRes.trim();
      } else {
        const r = invoiceRes as any;
        invoiceId =
          r?.invoiceId ??
          r?.InvoiceId ??
          r?.id ??
          r?.Id ??
          r?.data?.invoiceId ??
          r?.data?.InvoiceId ??
          r?.data?.id ??
          r?.data?.Id ??
          r?.value?.invoiceId ??
          r?.value?.id ??
          r?.value?.Id ??
          undefined;
      }
      if (invoiceId && input.items.length > 0) {
        for (const item of input.items) {
          const lineSubtotal = item.quantity * item.price;
          const detailBody = {
            invoiceId: String(invoiceId),
            InvoiceId: String(invoiceId),
            productId: String(item.productId),
            ProductId: String(item.productId),
            quantity: Number(item.quantity) || 0,
            Quantity: Number(item.quantity) || 0,
            subtotal: lineSubtotal,
            Subtotal: lineSubtotal,
          };
          const postDetail = await safePost<any>(
            '/invoicedetails/invoicedetails',
            detailBody
          );
          if (postDetail === null) {
            console.error(
              '[orders-api] POST invoicedetails falló para productId',
              item.productId
            );
          }
        }
      }
    }

    return { orderId, invoiceId };
  },

  /**
   * Lista pedidos del usuario con totales enriquecidos desde la factura.
   * GET /orders/orders/user/{id} + GET /invoice/invoices
   */
  // Nota: getOrdersByUser se usa solo en la PWA (un vendedor). En el Admin usamos getAllOrders (todos los vendedores) + getOrderById; misma lógica de total/subtotal desde facturas.

  /**
   * Obtiene un pedido por id. GET /orders/orders/{id} + detalles en paralelo.
   */
  async getOrderById(orderId: string): Promise<OrderForUI | null> {
    const [raw, detailsFromApi] = await Promise.all([
      safeGet<any>(`/orders/orders/${encodeURIComponent(orderId)}`),
      ordersApi.getOrderDetailsByOrderIdRaw(orderId),
    ]);
    if (!raw) return null;
    let details = detailsFromApi?.length ? detailsFromApi : [];
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
        const inv = invoice?.data ?? invoice?.value ?? invoice?.invoice ?? invoice;
        let invTotal = Number(inv?.total ?? inv?.Total ?? inv?.amount ?? inv?.Amount ?? inv?.totalUsd ?? inv?.TotalUsd ?? 0);
        if (invTotal <= 0) {
          const details = inv?.invoiceDetails ?? inv?.InvoiceDetails ?? inv?.details ?? inv?.Details ?? inv?.items ?? inv?.Items ?? [];
          const arr = Array.isArray(details) ? details : [];
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
   * Detalles de un pedido. GET /orderdetails/orderdetails/order/{orderId}
   */
  async getOrderDetailsByOrderIdRaw(orderId: string): Promise<any[]> {
    const list = await safeGet<any>(
      `/orderdetails/orderdetails/order/${encodeURIComponent(orderId)}`
    );
    if (list == null) return [];
    if (Array.isArray(list)) return list;
    const arr =
      list?.orderDetails ??
      list?.OrderDetails ??
      list?.details ??
      list?.Details ??
      list?.data ??
      list?.Data ??
      list?.items ??
      list?.Items ??
      [];
    return Array.isArray(arr) ? arr : [];
  },

  /**
   * Detalles de factura por invoiceId. GET /invoicedetails/invoicedetails/invoice/{invoiceId}
   */
  async getInvoiceDetailsByInvoiceId(invoiceId: string): Promise<any[]> {
    const id = String(invoiceId).trim();
    if (!id) return [];
    const res = await safeGet<any>(
      `/invoicedetails/invoicedetails/invoice/${encodeURIComponent(id)}`
    );
    return normalizeDetailList(res ?? null);
  },

  /**
   * Total desde la factura asociada a un pedido.
   * Desenvuelve inv.data/inv.value por si la API devuelve la factura anidada.
   */
  async getInvoiceTotalForOrder(orderId: string): Promise<number> {
    const raw = await ordersApi.getInvoiceForOrder(orderId);
    if (!raw) return 0;
    const inv = raw?.data ?? raw?.value ?? raw?.invoice ?? raw;
    let total = Number(
      inv?.totalUsd ??
        inv?.TotalUsd ??
        inv?.amountUsd ??
        inv?.AmountUsd ??
        inv?.total ??
        inv?.Total ??
        inv?.amount ??
        inv?.Amount ??
        inv?.totalAmount ??
        inv?.TotalAmount ??
        inv?.grandTotal ??
        inv?.GrandTotal ??
        0
    );
    if (total <= 0) {
      const details =
        inv?.invoiceDetails ??
        inv?.InvoiceDetails ??
        inv?.details ??
        inv?.Details ??
        inv?.items ??
        inv?.Items ??
        [];
      const arr = Array.isArray(details) ? details : [];
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
   * - Detalles: del cuerpo de la factura o GET /invoicedetails/invoicedetails/invoice/{id}.
   */
  /** Igual que PWA: datos de factura para pantalla (invoiceNumber, date, total, items). */
  async getInvoiceDisplayForOrder(
    orderId: string,
    optionalInvoiceId?: string | number
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
    const order = await ordersApi.getOrderById(orderId);
    let invId = '';
    let invoice: any = null;

    if (order?.invoiceId != null) invId = String(order.invoiceId);
    if (!invId && optionalInvoiceId != null) invId = String(optionalInvoiceId);
    if (!invId) {
      const fromList = await ordersApi.getInvoiceForOrder(orderId);
      invoice = fromList;
      if (invoice?.data && typeof invoice.data === 'object')
        invoice = invoice.data;
      if (invoice?.invoice && typeof invoice.invoice === 'object')
        invoice = invoice.invoice;
      invId =
        invoice != null
          ? String(
              invoice?.id ??
                invoice?.Id ??
                invoice?.invoiceId ??
                invoice?.InvoiceId ??
                ''
            )
          : '';
    }
    if (!invId) {
      const idFromList =
        (await ordersApi.getInvoiceIdForOrder(orderId)) ??
        (order?.backendOrderId != null
          ? await ordersApi.getInvoiceIdForOrder(
              String(order.backendOrderId)
            )
          : null);
      if (idFromList != null) invId = String(idFromList);
    }
    if (!invId) return null;

    if (!invoice) invoice = await getInvoiceById(invId);
    if (invoice?.data && typeof invoice.data === 'object')
      invoice = invoice.data;
    if (invoice?.invoice && typeof invoice.invoice === 'object')
      invoice = invoice.invoice;

    let details = normalizeDetailList(invoice);
    if (details.length === 0)
      details = await ordersApi.getInvoiceDetailsByInvoiceId(invId);

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
        let description = (
          detailProductName(d) ||
          orderItem?.productName ||
          orderItem?.sku ||
          ''
        ).trim();
        if (!description && pid) {
          const product = await productsApi.getById(pid);
          description = (product?.name || product?.sku || '').trim();
        }
        description = description || '—';
        const code =
          orderItem?.sku ||
          (d?.sku ?? d?.Sku ?? d?.product?.sku ?? d?.Product?.Sku ?? pid) ||
          '—';
        if ((price === 0 || amount === 0) && pid) {
          const latestPrice =
            orderItem?.price && orderItem.price > 0
              ? orderItem.price
              : await histpricesApi.getLatest(pid).then((p) => p?.price ?? 0);
          price = latestPrice;
          amount = qty * price;
        }
        return { qty, code, description, price, amount };
      })
    );

    // Total: factura (incl. totalUsd/TotalUsd si el backend guarda el precio en dólares)
    const total = Number(
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
    const totalFromDetails = items.reduce((s, i) => s + i.amount, 0);
    const subtotalFromInvoice = Number(
      invoice?.subtotal ??
        invoice?.Subtotal ??
        invoice?.SubTotal ??
        invoice?.totalBeforeTax ??
        invoice?.TotalBeforeTax ??
        0
    );
    const subtotal = subtotalFromInvoice > 0 ? subtotalFromInvoice : totalFromDetails;
    const date =
      invoice?.date ??
      invoice?.Date ??
      invoice?.createdAt ??
      invoice?.CreatedAt ??
      order?.date ??
      new Date().toISOString();
    const invNumber =
      invoice?.invoiceNumber ??
      invoice?.InvoiceNumber ??
      invoice?.invoiceId ??
      invoice?.InvoiceId ??
      invId;

    const pod = getPodFromInvoice(invoice);
    return {
      invoiceNumber: String(invNumber),
      date:
        typeof date === 'string'
          ? date
          : date instanceof Date
          ? date.toISOString()
          : new Date().toISOString(),
      total: total > 0 ? total : totalFromDetails,
      subtotal: subtotal > 0 ? subtotal : totalFromDetails,
      storeId: invoice?.storeId ?? invoice?.StoreId ?? order?.storeId,
      items,
      pod: pod || undefined,
    };
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
   * Registra un VisitLog para un vendedor en una tienda.
   */
  async createVisitLog(params: {
    storeId: string;
    salespersonId: string;
    visitDate?: string;
  }): Promise<string | number | null> {
    const visitDate =
      (params.visitDate || new Date().toISOString().slice(0, 10)) as string;
    const body = {
      storeId: params.storeId,
      StoreId: params.storeId,
      salespersonId: params.salespersonId,
      SalespersonId: params.salespersonId,
      visitDate,
      VisitDate: visitDate,
    };

    const res = await safePost<any>('/visit-logs/visit-logs', body);
    if (res == null) return null;

    let root: any = res;
    if (typeof res === 'object' && res !== null) {
      const data =
        (res as any).data ??
        (res as any).value ??
        (res as any).visitLog ??
        (res as any).VisitLog;
      if (data && typeof data === 'object') {
        root = data;
      }
    }

    let id: string | number | null = null;
    if (typeof root === 'string' || typeof root === 'number') {
      id = root;
    } else if (typeof root === 'object' && root !== null) {
      id =
        root.id ??
        root.Id ??
        root.visitLogId ??
        root.VisitLogId ??
        null;
    }

    return id != null && id !== false ? id : null;
  },

  /**
   * Actualiza el estado del pedido a facturado/entregado (como en la PWA).
   * PUT /orders/order/{id}/status con body { orderId, isInvoiced: true }
   */
  async updateOrderStatus(orderId: string | number, isInvoiced: boolean = true): Promise<boolean> {
    const idStr = String(orderId).trim();
    const body = {
      orderId: idStr,
      OrderId: idStr,
      isInvoiced,
      IsInvoiced: isInvoiced,
    };
    const res = await safePut<any>(`/orders/order/${encodeURIComponent(idStr)}/status`, body);
    return res !== null;
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
    const id = String(orderId).trim();
    const existingOrder = await safeGet<any>(`/orders/orders/${encodeURIComponent(id)}`);
    let salespersonId = input.salespersonId;
    if (!salespersonId && existingOrder) {
      salespersonId =
        existingOrder.salespersonId ??
        existingOrder.SalespersonId ??
        existingOrder.userId ??
        existingOrder.UserId;
      if (salespersonId != null) salespersonId = String(salespersonId);
    }
    const headerBody: Record<string, unknown> = {
      storeId: input.storeId,
      StoreId: input.storeId,
      status: 'pending',
      Status: 'pending',
      subtotal: input.subtotal,
      Subtotal: input.subtotal,
      tax: input.tax ?? 0,
      Tax: input.tax ?? 0,
      total: input.total,
      Total: input.total,
    };
    if (salespersonId) {
      headerBody.salespersonId = salespersonId;
      headerBody.SalespersonId = salespersonId;
    }
    const putOrderRes = await safePut<any>(`/orders/order/${encodeURIComponent(id)}`, headerBody);
    if (putOrderRes === null) return false;

    const existingDetails = await ordersApi.getOrderDetailsByOrderIdRaw(id);
    const byProductId = new Map<string, { id: string; detail: any }>();
    existingDetails.forEach((d: any) => {
      const pid = String(d?.productId ?? d?.ProductId ?? '').trim();
      const detailId = d?.id ?? d?.Id ?? d?.orderDetailId ?? d?.OrderDetailId;
      if (pid && detailId != null) byProductId.set(pid, { id: String(detailId), detail: d });
    });

    const newProductIds = new Set(input.items.map((i) => String(i.productId)));
    for (const item of input.items) {
      const pid = String(item.productId).trim();
      const detailBody = {
        orderId: id,
        OrderId: id,
        productId: item.productId,
        ProductId: item.productId,
        quantity: item.quantity,
        Quantity: item.quantity,
        unitPrice: item.price,
        UnitPrice: item.price,
        subtotal: item.quantity * item.price,
        Subtotal: item.quantity * item.price,
      };
      const existing = byProductId.get(pid);
      if (existing) {
        const putRes = await safePut<any>(
          `/orderdetails/orderdetails/${encodeURIComponent(existing.id)}`,
          detailBody
        );
        if (putRes === null) return false;
      } else {
        await safePost<any>('/orderdetails/orderdetails', detailBody);
      }
    }
    for (const [pid, { id: detailId, detail }] of byProductId) {
      if (!newProductIds.has(pid)) {
        const productId = detail?.productId ?? detail?.ProductId ?? pid;
        const zeroBody = {
          orderId: id,
          OrderId: id,
          productId,
          ProductId: productId,
          quantity: 0,
          Quantity: 0,
          unitPrice: 0,
          UnitPrice: 0,
          subtotal: 0,
          Subtotal: 0,
        };
        const putRes = await safePut<any>(
          `/orderdetails/orderdetails/${encodeURIComponent(detailId)}`,
          zeroBody
        );
        if (putRes === null) return false;
      }
    }

    let invoiceId: string | number | null = null;
    if (existingOrder) {
      const fromOrder =
        existingOrder.invoiceId ??
        existingOrder.InvoiceId ??
        existingOrder.invoice?.id ??
        existingOrder.invoice?.Id ??
        (Array.isArray(existingOrder.invoices) ? existingOrder.invoices[0]?.id : null) ??
        (Array.isArray(existingOrder.Invoices) ? existingOrder.Invoices[0]?.id : null);
      if (fromOrder != null) invoiceId = String(fromOrder);
    }
    if (invoiceId == null) invoiceId = await ordersApi.getInvoiceIdForOrder(id);
    if (invoiceId == null && optionalInvoiceId != null && optionalInvoiceId !== '')
      invoiceId = String(optionalInvoiceId);

    if (invoiceId != null) {
      const invIdStr = String(invoiceId).trim();
      const rawInv = await getInvoiceById(invIdStr) ?? await ordersApi.getInvoiceForOrder(id);
      const existingInv = rawInv?.data ?? rawInv?.invoice ?? rawInv?.value ?? rawInv;
      const invBody: Record<string, unknown> = {
        id: invIdStr,
        Id: invIdStr,
        orderId: id,
        OrderId: id,
        storeId: input.storeId,
        StoreId: input.storeId,
        total: Number(input.total),
        Total: Number(input.total),
        subtotal: Number(input.subtotal),
        Subtotal: Number(input.subtotal),
        tax: Number(input.tax ?? 0),
        Tax: Number(input.tax ?? 0),
      };
      if (existingInv && typeof existingInv === 'object') {
        for (const [k, v] of Object.entries(existingInv)) {
          if (v === null || v === undefined) continue;
          if (typeof v === 'object' && !Array.isArray(v)) continue;
          if (Array.isArray(v)) continue;
          if (invBody[k] === undefined) invBody[k] = v;
        }
      }
      const putInvRes = await safePut<any>(`/invoice/invoices/${encodeURIComponent(invIdStr)}`, invBody);
      if (putInvRes === null) return false;

      const invDetailsList = await ordersApi.getInvoiceDetailsByInvoiceId(invIdStr);
      const invByProduct = new Map<string, { id: string; detail: any }>();
      invDetailsList.forEach((d: any) => {
        const dPid = String(d?.productId ?? d?.ProductId ?? '').trim();
        const did =
          d?.id ?? d?.Id ?? d?.invoiceDetailId ?? d?.InvoiceDetailId;
        if (dPid && did != null) invByProduct.set(dPid, { id: String(did), detail: d });
      });

      for (const item of input.items) {
        const pid = String(item.productId).trim();
        const lineSubtotal = item.quantity * item.price;
        const existing = invByProduct.get(pid);
        if (existing) {
          const detailBody = {
            id: existing.id,
            Id: existing.id,
            invoiceId: invIdStr,
            InvoiceId: invIdStr,
            productId: item.productId,
            ProductId: item.productId,
            quantity: Number(item.quantity),
            Quantity: Number(item.quantity),
            subtotal: Number(lineSubtotal),
            Subtotal: Number(lineSubtotal),
          };
          const putDetailRes = await safePut<any>(
            `/invoicedetails/invoicedetails/${encodeURIComponent(existing.id)}`,
            detailBody
          );
          if (putDetailRes === null) return false;
        } else {
          const postBody = {
            invoiceId: invIdStr,
            InvoiceId: invIdStr,
            productId: item.productId,
            ProductId: item.productId,
            quantity: Number(item.quantity),
            Quantity: Number(item.quantity),
            subtotal: Number(lineSubtotal),
            Subtotal: Number(lineSubtotal),
          };
          const postRes = await safePost<any>('/invoicedetails/invoicedetails', postBody);
          if (postRes === null) return false;
        }
      }
      for (const [pid, { id: detailId, detail }] of invByProduct) {
        if (!newProductIds.has(pid)) {
          const zeroBody = {
            id: detailId,
            Id: detailId,
            invoiceId: invIdStr,
            InvoiceId: invIdStr,
            productId: detail?.productId ?? detail?.ProductId ?? pid,
            ProductId: detail?.productId ?? detail?.ProductId ?? pid,
            quantity: 0,
            Quantity: 0,
            subtotal: 0,
            Subtotal: 0,
          };
          const putZeroRes = await safePut<any>(
            `/invoicedetails/invoicedetails/${encodeURIComponent(detailId)}`,
            zeroBody
          );
          if (putZeroRes === null) return false;
        }
      }
    }
    return true;
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
   * Sube el POD a la factura. PATCH /invoice/invoices/{id}/pod (mismo que PWA).
   */
  async uploadPODForInvoice(params: {
    invoiceId: number | string;
    fileName: string;
    contentType?: string;
    notes?: string;
    imageDataUrl?: string | null;
  }): Promise<boolean> {
    const id = String(params.invoiceId).trim();
    const name = (params.fileName || 'POD.png').trim();
    const podPath = name.startsWith('imagenes/') ? name : `imagenes/${name}`;
    let podBase64: string | undefined;
    if (params.imageDataUrl && typeof params.imageDataUrl === 'string' && params.imageDataUrl.startsWith('data:')) {
      const base64 = params.imageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');
      if (base64.length > 0) podBase64 = base64;
    }
    const body: Record<string, unknown> = { id, pod: podPath };
    if (podBase64) body.podBase64 = podBase64;
    const res = await safePatch<any>(`/invoice/invoices/${encodeURIComponent(id)}/pod`, body);
    return res !== null && res !== undefined;
  },

  /**
   * Obtiene todas las facturas con sus detalles para reportes de ventas (admin).
   * Usa GET /invoice/invoices y GET /invoicedetails/invoicedetails/invoice/{id}.
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
            const latest = await histpricesApi.getLatest(pid);
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


