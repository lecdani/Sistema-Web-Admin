'use client';

import React from 'react';
import { Invoice, Order } from '@/shared/types';
import { useLanguage } from '@/shared/hooks/useLanguage';

interface InvoicePreviewProps {
  invoice: Invoice;
  order: Order;
  companyName?: string;
}

export function InvoicePreview({ invoice, order, companyName = "TU EMPRESA" }: InvoicePreviewProps) {
  const { translate, locale } = useLanguage();
  const [viewMode, setViewMode] = React.useState<'product' | 'family'>('product');
  const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString(locale) : 'N/A';
  const familyRows = React.useMemo(() => {
    const byFamily = new Map<string, { skuSet: Set<string>; familyName: string; qty: number; amount: number }>();
    (order.items || []).forEach((item) => {
      const familyName = String((item as any).category || '').trim() || translate('invoiceNoFamily');
      const key = familyName.toLowerCase();
      if (!byFamily.has(key)) {
        byFamily.set(key, { skuSet: new Set<string>(), familyName, qty: 0, amount: 0 });
      }
      const row = byFamily.get(key)!;
      const sku = String((item as any).sku || item.productId || '').trim();
      if (sku) row.skuSet.add(sku);
      const qty = Number(item.quantity || 0);
      const amount = Number(item.subtotal || qty * Number(item.unitPrice || 0) || 0);
      row.qty += qty;
      row.amount += amount;
    });
    return [...byFamily.values()].map((row) => ({
      sku: row.skuSet.size <= 1 ? [...row.skuSet][0] || '—' : translate('invoiceSkuMultiple'),
      familyName: row.familyName,
      qty: row.qty,
      amount: row.amount,
    }));
  }, [order.items, translate]);
  
  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center gap-2 print:hidden">
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            viewMode === 'product' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
          }`}
          onClick={() => setViewMode('product')}
        >
          {translate('invoiceTabProducts')}
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            viewMode === 'family' ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'
          }`}
          onClick={() => setViewMode('family')}
        >
          {translate('invoiceTabFamilies')}
        </button>
      </div>

      <div className="bg-white p-8 border-2 border-gray-300 rounded-lg shadow-lg" id="invoice-print-area">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-wider">{companyName}</h1>
            <p className="text-sm mt-2">1904 N Main St, Miami, FL 23145</p>
            <p className="text-sm">Phone: (305) 555-9265</p>
          </div>
          
          <div className="text-right">
            <div className="bg-black text-white px-4 py-1 mb-2 inline-block">
              <span className="text-lg font-bold">∞</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-2 border-black p-3">
              <div className="text-left font-semibold">INVOICE #:</div>
              <div className="text-right">{invoice.invoiceNumber || 'N/A'}</div>
              
              <div className="text-left font-semibold">DATE:</div>
              <div className="text-right">{issueDate}</div>
              
              <div className="text-left font-semibold">VENDOR №:</div>
              <div className="text-right">{order.salespersonId?.slice(0, 8) || 'N/A'}</div>
              
              <div className="text-left font-semibold">2F/3№</div>
              <div className="text-right">-</div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Information */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold text-sm mb-1">STORE:</p>
          <p className="text-sm">{order.storeName || 'N/A'}</p>
        </div>
        
        <div>
          <p className="font-bold text-sm mb-1">ADDRESS:</p>
          <p className="text-sm">{translate('infoNotAvailable')}</p>
        </div>
      </div>

      {/* Products / Family Table */}
      <div className="mb-6">
        <table className="w-full border-2 border-black">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              {viewMode === 'product' ? (
                <>
                  <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">QTY</th>
                  <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">CODE</th>
                  <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">DESCRIPTION</th>
                  <th className="border-r-2 border-black px-3 py-2 text-right text-sm font-bold">PRICE</th>
                  <th className="px-3 py-2 text-right text-sm font-bold">AMOUNT</th>
                </>
              ) : (
                <>
                  <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">SKU</th>
                  <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">{translate('family_col') || 'Family'}</th>
                  <th className="border-r-2 border-black px-3 py-2 text-right text-sm font-bold">QTY</th>
                  <th className="px-3 py-2 text-right text-sm font-bold">AMOUNT</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {viewMode === 'product'
              ? order.items.map((item) => (
                  <tr key={item.id} className="border-b border-black">
                    <td className="border-r-2 border-black px-3 py-2 text-sm">{item.quantity || 0}</td>
                    <td className="border-r-2 border-black px-3 py-2 text-sm">{item.productId.slice(0, 10)}</td>
                    <td className="border-r-2 border-black px-3 py-2 text-sm">{item.productName || 'N/A'}</td>
                    <td className="border-r-2 border-black px-3 py-2 text-right text-sm">${(item.unitPrice || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-sm font-medium">${(item.subtotal || 0).toFixed(2)}</td>
                  </tr>
                ))
              : familyRows.map((row, index) => (
                  <tr key={`f-${index}`} className="border-b border-black">
                    <td className="border-r-2 border-black px-3 py-2 text-sm">{row.sku || '—'}</td>
                    <td className="border-r-2 border-black px-3 py-2 text-sm">{row.familyName || translate('invoiceNoFamily')}</td>
                    <td className="border-r-2 border-black px-3 py-2 text-right text-sm">{row.qty}</td>
                    <td className="px-3 py-2 text-right text-sm font-medium">${row.amount.toFixed(2)}</td>
                  </tr>
                ))}
            
            {/* Empty rows to maintain layout */}
            {viewMode === 'product' &&
              Array.from({ length: Math.max(0, 8 - order.items.length) }).map((_, index) => (
                <tr key={`empty-${index}`} className="border-b border-black">
                  <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                  <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                  <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                  <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                  <td className="px-3 py-3 text-sm">&nbsp;</td>
                </tr>
              ))}

            {/* Total Row */}
            {viewMode === 'product' ? (
              <tr className="bg-gray-100 border-t-2 border-black">
                <td colSpan={2} className="border-r-2 border-black px-3 py-3 text-sm font-bold">TOTAL PCS</td>
                <td className="border-r-2 border-black px-3 py-3 text-sm font-bold">
                  {order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)} {translate('quantityUnits').toLowerCase()}
                </td>
                <td className="border-r-2 border-black px-3 py-3 text-right text-sm font-bold">TOTAL</td>
                <td className="px-3 py-3 text-right text-lg font-bold">${(invoice.totalAmount || 0).toFixed(2)}</td>
              </tr>
            ) : (
              <tr className="bg-gray-100 border-t-2 border-black">
                <td colSpan={2} className="border-r-2 border-black px-3 py-3 text-sm font-bold">TOTAL PCS</td>
                <td className="border-r-2 border-black px-3 py-3 text-right text-sm font-bold">
                  {familyRows.reduce((sum, row) => sum + row.qty, 0)}
                </td>
                <td className="px-3 py-3 text-right text-lg font-bold">
                  ${familyRows.reduce((sum, row) => sum + row.amount, 0).toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Comments */}
      <div className="border-2 border-black p-3 mb-4">
        <p className="font-bold text-sm mb-2">COMMENTS:</p>
        <p className="text-sm min-h-[60px]">{invoice.notes || order.notes || translate('noComments')}</p>
      </div>

      {/* Footer Information */}
      <div className="text-xs text-gray-600 text-center mt-6">
        <p>IVA: ${(invoice.taxAmount || 0).toFixed(2)} | Subtotal: ${(order.subtotal || 0).toFixed(2)}</p>
        <p className="mt-2">{translate('orderCreatedAtLabel')}: {new Date(order.createdAt).toLocaleString(locale)}</p>
      </div>
      </div>
    </div>
  );
}
