import type { Workbook, Font, FillPattern } from 'exceljs';
import { ordersApi, computeOrderInvoiceShortfall, type AdminOrderSummary } from '@/shared/services/orders-api';

export function getOrderLifecycleFromStatus(status: string | undefined): 'initial' | 'invoiced' | 'cancelled' {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'cancelled' || s === 'canceled' || s === 'cancelado' || s === '3') return 'cancelled';
  if (
    s === 'invoiced' ||
    s === 'delivered' ||
    s === '2' ||
    s === 'completed' ||
    s === 'confirmed' ||
    s === 'confirmado'
  ) {
    return 'invoiced';
  }
  return 'initial';
}

export interface ShortageDetailRow {
  invoiceNumber: string;
  orderId: string;
  /** ID de tienda del pedido (para resolver nombre en UI si falta en el resumen). */
  storeId?: string;
  storeName: string;
  sku: string;
  productName: string;
  ordered: number;
  delivered: number;
  diff: number;
  orderDateIso: string;
}

export interface ShortageAnalyticsResult {
  analyzed: number;
  ordersWithShort: number;
  totalShortUnits: number;
  totalShortLines: number;
  /** Top productos por unidades faltantes */
  topProducts: Array<{ sku: string; name: string; units: number; orderCount: number }>;
  /** Top tiendas por unidades faltantes */
  topStores: Array<{
    storeId: string;
    name: string;
    units: number;
    shortLines: number;
    orderCount: number;
  }>;
  /** Unidades faltantes agrupadas por mes (fecha del pedido) */
  shortUnitsByMonth: Array<{ monthKey: string; label: string; units: number }>;
  detailSample: ShortageDetailRow[];
}

type ProductAgg = { sku: string; name: string; units: number; orderIds: Set<string> };
type StoreAgg = { storeId: string; name: string; units: number; shortLines: number; orderIds: Set<string> };

/**
 * Compara pedido inicial vs líneas de factura (misma lógica que el detalle del pedido).
 * Solo pedidos facturados con factura usable.
 */
export async function computeShortageAnalytics(
  invoicedSummaries: AdminOrderSummary[]
): Promise<ShortageAnalyticsResult> {
  const byProduct = new Map<string, ProductAgg>();
  const byStore = new Map<string, StoreAgg>();
  const detailRows: ShortageDetailRow[] = [];
  const monthAcc = new Map<string, number>();

  let analyzed = 0;
  let ordersWithShort = 0;
  let totalShortUnits = 0;
  let totalShortLines = 0;

  for (const o of invoicedSummaries) {
    try {
      const full = await ordersApi.getOrderById(o.id);
      if (!full?.items?.length) continue;
      const inv = await ordersApi.getInvoiceDisplayForOrder(o.id, o.invoiceId ?? full.invoiceId, full);
      if (!inv?.items?.length) continue;
      analyzed++;
      const shorts = computeOrderInvoiceShortfall(full.items as any[], inv.items);
      if (!shorts.length) continue;

      ordersWithShort++;
      totalShortLines += shorts.length;
      const monthKey = new Date(o.date).toISOString().slice(0, 7);

      const rawStoreId =
        o.storeId != null && String(o.storeId).trim() !== '' ? String(o.storeId).trim() : '';
      const storeKey = rawStoreId || '—';
      const storeName = (o.storeName && String(o.storeName).trim()) || storeKey;
      if (!byStore.has(storeKey)) {
        byStore.set(storeKey, {
          storeId: rawStoreId,
          name: storeName,
          units: 0,
          shortLines: 0,
          orderIds: new Set(),
        });
      }
      const sAgg = byStore.get(storeKey)!;
      sAgg.orderIds.add(o.id);

      let orderShortSum = 0;
      for (const rowS of shorts) {
        const diff = Number.isFinite(rowS.difference)
          ? rowS.difference
          : rowS.orderedQty - rowS.deliveredQty;
        totalShortUnits += diff;
        orderShortSum += diff;
        sAgg.units += diff;
        sAgg.shortLines += 1;

        const pk =
          String(rowS.productId || '').trim() ||
          `sku:${rowS.sku || ''}:name:${rowS.productName || ''}`;
        if (!byProduct.has(pk)) {
          byProduct.set(pk, { sku: rowS.sku || '', name: rowS.productName || '', units: 0, orderIds: new Set() });
        }
        const pAgg = byProduct.get(pk)!;
        pAgg.units += diff;
        pAgg.orderIds.add(o.id);
        if (!pAgg.sku && rowS.sku) pAgg.sku = rowS.sku;
        if (!pAgg.name && rowS.productName) pAgg.name = rowS.productName || '';

        detailRows.push({
          invoiceNumber: String((inv as any)?.invoiceNumber ?? (inv as any)?.InvoiceNumber ?? o.invoiceId ?? ''),
          orderId: o.id,
          storeId: rawStoreId || undefined,
          storeName,
          sku: (rowS.sku || '').trim() || '—',
          productName: (rowS.productName || '').trim() || '—',
          ordered: rowS.orderedQty,
          delivered: rowS.deliveredQty,
          diff,
          orderDateIso: o.date,
        });
      }
      monthAcc.set(monthKey, (monthAcc.get(monthKey) ?? 0) + orderShortSum);
    } catch (err) {
      console.warn('[computeShortageAnalytics]', o.id, err);
    }
  }

  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.units - a.units)
    .slice(0, 50)
    .map((v) => ({
      sku: v.sku || '—',
      name: v.name || '—',
      units: v.units,
      orderCount: v.orderIds.size,
    }));

  const topStores = [...byStore.values()]
    .filter((v) => v.units > 0 || v.shortLines > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, 50)
    .map((v) => ({
      storeId: v.storeId,
      name: v.name,
      units: v.units,
      shortLines: v.shortLines,
      orderCount: v.orderIds.size,
    }));

  const shortUnitsByMonth = [...monthAcc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, units]) => ({
      monthKey,
      label: monthKey,
      units,
    }));

  const detailSample = [...detailRows].sort(
    (a, b) => new Date(b.orderDateIso).getTime() - new Date(a.orderDateIso).getTime()
  );

  return {
    analyzed,
    ordersWithShort,
    totalShortUnits,
    totalShortLines,
    topProducts,
    topStores,
    shortUnitsByMonth,
    detailSample,
  };
}

type TranslateFn = (key: string) => string;

/**
 * Añade hojas "Pedidos" (pipeline) y "Faltantes" al libro de Reportes de Ventas.
 */
export async function appendReportOrdersAndShortageSheets(
  wb: Workbook,
  params: {
    summaries: AdminOrderSummary[];
    translate: TranslateFn;
    locale: string;
    sectionFont: Partial<Font>;
    headerFill: FillPattern;
    headerFont: Partial<Font>;
  }
): Promise<void> {
  const { summaries, translate, locale, sectionFont, headerFill, headerFont } = params;

  const initial = summaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'initial');
  const invoiced = summaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'invoiced');
  const cancelled = summaries.filter((o) => getOrderLifecycleFromStatus(o.status) === 'cancelled');
  const pendingValue = initial.reduce((s, o) => s + (Number(o.total) > 0 ? Number(o.total) : Number(o.subtotal) || 0), 0);

  const wsP = wb.addWorksheet(locale.startsWith('es') ? 'Pedidos' : 'Orders', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  let row = 1;
  wsP.getCell(row, 1).value = translate('reportsOrdersSheetTitle');
  wsP.getCell(row, 1).font = { bold: true, size: 14 };
  row += 2;

  wsP.getCell(row, 1).value = translate('reportsOrdersPipelineSection');
  wsP.getCell(row, 1).font = sectionFont;
  row += 1;
  const kpiRows: [string, string | number][] = [
    [translate('reportsPendingOrdersCount'), initial.length],
    [translate('reportsPendingOrdersValue'), pendingValue],
    [translate('reportsInvoicedOrdersCount'), invoiced.length],
    [translate('reportsCancelledOrdersCount'), cancelled.length],
    [translate('reportsOrdersTotalInScope'), summaries.length],
  ];
  for (const [label, val] of kpiRows) {
    wsP.getCell(row, 1).value = label;
    wsP.getCell(row, 2).value = val;
    row += 1;
  }
  row += 1;

  wsP.getCell(row, 1).value = translate('reportsPendingOrdersListSection');
  wsP.getCell(row, 1).font = sectionFont;
  row += 1;
  const pendHeaders = [
    translate('invoiceNumberCol'),
    'ID',
    translate('storeHeader'),
    translate('date'),
    translate('subtotal'),
    translate('ordersTotalColumn'),
  ];
  pendHeaders.forEach((val, c) => {
    const cell = wsP.getCell(row, c + 1);
    cell.value = val;
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  row += 1;
  const sortedInitial = [...initial].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  for (const o of sortedInitial.slice(0, 500)) {
    wsP.getCell(row, 1).value = String((o as any).invoiceId ?? '');
    wsP.getCell(row, 2).value = o.id;
    wsP.getCell(row, 3).value = o.storeName || o.storeId;
    wsP.getCell(row, 4).value = new Date(o.date).toLocaleDateString(locale);
    wsP.getCell(row, 5).value = Number((o.subtotal || 0).toFixed(2));
    wsP.getCell(row, 6).value = Number((o.total || 0).toFixed(2));
    row += 1;
  }
  wsP.columns = [{ width: 16 }, { width: 28 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }];

  const analytics = await computeShortageAnalytics(invoiced);

  const ws2 = wb.addWorksheet(locale.startsWith('es') ? 'Faltantes' : 'Shortages', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  let r2 = 1;
  ws2.getCell(r2, 1).value = translate('ordersShortageSheet');
  ws2.getCell(r2, 1).font = { bold: true, size: 14 };
  r2 += 2;

  ws2.getCell(r2, 1).value = translate('ordersShortageKpiTitle');
  ws2.getCell(r2, 1).font = sectionFont;
  r2 += 1;
  ws2.getCell(r2, 1).value = translate('ordersShortageInvoicedAnalyzed');
  ws2.getCell(r2, 2).value = analytics.analyzed;
  r2 += 1;
  ws2.getCell(r2, 1).value = translate('ordersShortageOrdersWithGap');
  ws2.getCell(r2, 2).value = analytics.ordersWithShort;
  r2 += 1;
  ws2.getCell(r2, 1).value = translate('ordersShortageTotalUnitsShort');
  ws2.getCell(r2, 2).value = analytics.totalShortUnits;
  r2 += 1;
  ws2.getCell(r2, 1).value = translate('ordersShortageTotalLines');
  ws2.getCell(r2, 2).value = analytics.totalShortLines;
  r2 += 2;

  ws2.getCell(r2, 1).value = translate('ordersShortageTopProducts');
  ws2.getCell(r2, 1).font = sectionFont;
  r2 += 1;
  const headersP = [
    translate('discrepancyColSku'),
    translate('discrepancyColProduct'),
    translate('ordersShortageTotalUnitsShort'),
    translate('ordersShortageAffectedOrders'),
  ];
  headersP.forEach((val, c) => {
    const cell = ws2.getCell(r2, c + 1);
    cell.value = val;
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  r2 += 1;
  for (const v of analytics.topProducts.slice(0, 80)) {
    ws2.getCell(r2, 1).value = v.sku || '—';
    ws2.getCell(r2, 2).value = v.name || '—';
    ws2.getCell(r2, 3).value = v.units;
    ws2.getCell(r2, 4).value = v.orderCount;
    r2 += 1;
  }
  r2 += 1;

  ws2.getCell(r2, 1).value = translate('ordersShortageByStore');
  ws2.getCell(r2, 1).font = sectionFont;
  r2 += 1;
  const headersS = [
    translate('storeHeader'),
    translate('ordersShortageTotalUnitsShort'),
    translate('ordersShortageTotalLines'),
    translate('ordersShortageAffectedOrders'),
  ];
  headersS.forEach((val, c) => {
    const cell = ws2.getCell(r2, c + 1);
    cell.value = val;
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  r2 += 1;
  for (const v of analytics.topStores) {
    ws2.getCell(r2, 1).value = v.name;
    ws2.getCell(r2, 2).value = v.units;
    ws2.getCell(r2, 3).value = v.shortLines;
    ws2.getCell(r2, 4).value = v.orderCount;
    r2 += 1;
  }
  r2 += 1;

  ws2.getCell(r2, 1).value = translate('ordersShortageDetailTitle');
  ws2.getCell(r2, 1).font = sectionFont;
  r2 += 1;
  const headersD = [
    translate('ordersShortagePo'),
    'ID',
    translate('storeHeader'),
    translate('discrepancyColSku'),
    translate('discrepancyColProduct'),
    translate('discrepancyColOrdered'),
    translate('discrepancyColDelivered'),
    translate('discrepancyColDiff'),
  ];
  headersD.forEach((val, c) => {
    const cell = ws2.getCell(r2, c + 1);
    cell.value = val;
    cell.fill = headerFill;
    cell.font = headerFont;
  });
  r2 += 1;
  for (const d of analytics.detailSample) {
    ws2.getCell(r2, 1).value = d.po;
    ws2.getCell(r2, 2).value = d.orderId;
    ws2.getCell(r2, 3).value = d.storeName;
    ws2.getCell(r2, 4).value = d.sku;
    ws2.getCell(r2, 5).value = d.productName;
    ws2.getCell(r2, 6).value = d.ordered;
    ws2.getCell(r2, 7).value = d.delivered;
    ws2.getCell(r2, 8).value = d.diff;
    r2 += 1;
  }

  ws2.columns = [
    { width: 14 },
    { width: 28 },
    { width: 22 },
    { width: 14 },
    { width: 36 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ];
}
