import React, { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { useLanguage } from '@/shared/hooks/useLanguage';
import type { Product } from '@/shared/types';
import type { OrderForUI } from '@/shared/services/orders-api';
import { productsApi } from '@/shared/services/products-api';
import { getProductShortDisplayName } from '@/shared/utils/planogram-grid-display';
import {
  collectPresentationRowsFromOrderLines,
  sumAmountForPresentation,
  sumQtyForPresentation,
} from '@/shared/utils/planogram-presentation-summary';
import { PresentationSummaryCell } from '@/shared/components/PresentationSummaryCell';

interface OrderCatalogListViewProps {
  order: OrderForUI;
}

type MergedLine = {
  productId: string;
  quantity: number;
  productName: string;
  unitPrice: number;
  lineSku: string;
};

export function OrderCatalogListView({ order }: OrderCatalogListViewProps) {
  const { translate } = useLanguage();
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const products = await productsApi.fetchAll();
        if (!mounted) return;
        const map = new Map<string, Product>();
        products.forEach((p: any) => {
          const idStr = String(p.id);
          map.set(idStr, p);
          const n = Number(idStr);
          if (!Number.isNaN(n)) map.set(String(n), p);
        });
        setProductMap(map);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const mergedLines = useMemo(() => {
    const items = Array.isArray(order.items) ? order.items : [];
    const qtyByPid = new Map<string, MergedLine>();
    for (const raw of items) {
      const it = raw as any;
      const pid = String(it.productId ?? it.ProductId ?? '').trim();
      if (!pid) continue;
      const q = Number(it.quantity ?? it.toOrder ?? 0) || 0;
      if (q <= 0) continue;
      const name = String(it.productName ?? '').trim();
      const price = Number(it.unitPrice ?? it.price ?? 0) || 0;
      const rowSku = String(it.sku ?? it.Sku ?? '').trim();
      const prev = qtyByPid.get(pid);
      if (prev) {
        qtyByPid.set(pid, {
          productId: pid,
          quantity: prev.quantity + q,
          productName: prev.productName || name,
          unitPrice: prev.unitPrice || price,
          lineSku: prev.lineSku || rowSku,
        });
      } else {
        qtyByPid.set(pid, {
          productId: pid,
          quantity: q,
          productName: name,
          unitPrice: price,
          lineSku: rowSku,
        });
      }
    }
    return [...qtyByPid.values()];
  }, [order.items]);

  const presentationBlock = useMemo(() => {
    const rows = collectPresentationRowsFromOrderLines(mergedLines as any[], productMap);
    return rows
      .map((row) => ({
        row,
        pcs: sumQtyForPresentation(mergedLines as any[], productMap, row.presentationId),
        amount: sumAmountForPresentation(mergedLines as any[], productMap, row.presentationId),
      }))
      .filter((x) => x.pcs > 0);
  }, [mergedLines, productMap]);

  const productRows = useMemo(() => {
    return [...mergedLines]
      .map((line) => {
        const p =
          productMap.get(line.productId) ||
          productMap.get(String(Number(line.productId))) ||
          undefined;
        const category = String(p?.category ?? '').trim();
        const sortFamily = category || String((p as any)?.familyId ?? (p as any)?.categoryId ?? '');
        const name = p ? getProductShortDisplayName(p) : line.productName || '—';
        const dbSku = String(p?.sku ?? '').trim();
        const displaySku = dbSku || line.lineSku || '—';
        const unitForRow =
          line.unitPrice > 0 ? line.unitPrice : Number((p as any)?.currentPrice ?? (p as any)?.price ?? 0) || 0;
        return {
          productId: line.productId,
          quantity: line.quantity,
          displayName: name,
          displaySku,
          sortFamily,
          sortName: name,
          unitForRow,
        };
      })
      .sort((a, b) => {
        const fa = a.sortFamily.localeCompare(b.sortFamily, undefined, { sensitivity: 'base' });
        if (fa !== 0) return fa;
        return a.sortName.localeCompare(b.sortName, undefined, { sensitivity: 'base' });
      });
  }, [mergedLines, productMap]);

  const grandSubtotal = productRows.reduce((s, r) => s + r.quantity * r.unitForRow, 0);

  if (mergedLines.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        {translate('catalogListEmpty')}
      </p>
    );
  }

  return (
    <>
      <div className="print:hidden flex flex-wrap gap-2 mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTimeout(() => window.print(), 200)}
        >
          <Printer className="h-4 w-4 mr-2" />
          {translate('printCatalogList')}
        </Button>
      </div>

      <div id="admin-catalog-order-list-print-root" className="space-y-6 print:space-y-4">
        <p className="text-sm text-gray-600 print:text-xs">{translate('catalogListHint')}</p>

        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white print:shadow-none">
          <h3 className="bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 border-b border-slate-200 print:text-xs">
            {translate('catalogListByProduct')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px] print:text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-left border-b border-slate-200">
                  <th className="py-2 px-4 font-semibold w-28">{translate('skuCol')}</th>
                  <th className="py-2 px-4 font-semibold">{translate('discrepancyColProduct')}</th>
                  <th className="py-2 px-4 font-semibold w-28 text-right">{translate('discrepancyColOrdered')}</th>
                  <th className="py-2 px-4 font-semibold w-28 text-right">{translate('unitPriceCol')}</th>
                  <th className="py-2 px-4 font-semibold w-32 text-right">{translate('subtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((r) => (
                  <tr key={r.productId} className="border-t border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-mono text-xs">{r.displaySku}</td>
                    <td className="py-2 px-4 text-slate-900">{r.displayName}</td>
                    <td className="py-2 px-4 text-right tabular-nums">{r.quantity}</td>
                    <td className="py-2 px-4 text-right tabular-nums">${r.unitForRow.toFixed(2)}</td>
                    <td className="py-2 px-4 text-right tabular-nums font-medium">
                      ${(r.quantity * r.unitForRow).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-slate-200 bg-slate-50/80 px-4 py-3 print:bg-transparent">
            <div className="text-right">
              <span className="text-xs text-slate-600 block">{translate('subtotal')}</span>
              <span className="text-lg font-bold text-green-700 print:text-base">${grandSubtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white print:shadow-none">
          <h3 className="bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 border-b border-slate-200 print:text-xs">
            {translate('catalogListByFamily')}
          </h3>
          {presentationBlock.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">{translate('familySummaryNoRows')}</p>
          ) : (
            <table className="w-full text-sm print:text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-left border-b border-slate-200">
                  <th className="py-2 px-4 font-semibold">{translate('familyCol')}</th>
                  <th className="py-2 px-4 font-semibold w-24 text-right">{translate('pcsCol')}</th>
                  <th className="py-2 px-4 font-semibold w-32 text-right">{translate('subtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {presentationBlock.map(({ row, pcs, amount }) => (
                  <tr key={row.presentationId} className="border-t border-slate-100">
                    <td className="py-2 px-4 text-slate-900 align-top">
                      <PresentationSummaryCell row={row} />
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-slate-800">{pcs}</td>
                    <td className="py-2 px-4 text-right font-medium text-slate-800 tabular-nums">
                      ${amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
