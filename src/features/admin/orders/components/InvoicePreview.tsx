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
  const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString(locale) : 'N/A';
  
  return (
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

      {/* Products Table */}
      <div className="mb-6">
        <table className="w-full border-2 border-black">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">QTY</th>
              <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">CODE</th>
              <th className="border-r-2 border-black px-3 py-2 text-left text-sm font-bold">DESCRIPTION</th>
              <th className="border-r-2 border-black px-3 py-2 text-right text-sm font-bold">PRICE</th>
              <th className="px-3 py-2 text-right text-sm font-bold">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id} className="border-b border-black">
                <td className="border-r-2 border-black px-3 py-2 text-sm">{item.quantity || 0}</td>
                <td className="border-r-2 border-black px-3 py-2 text-sm">{item.productId.slice(0, 10)}</td>
                <td className="border-r-2 border-black px-3 py-2 text-sm">{item.productName || 'N/A'}</td>
                <td className="border-r-2 border-black px-3 py-2 text-right text-sm">${(item.unitPrice || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-sm font-medium">${(item.subtotal || 0).toFixed(2)}</td>
              </tr>
            ))}
            
            {/* Empty rows to maintain layout */}
            {Array.from({ length: Math.max(0, 8 - order.items.length) }).map((_, index) => (
              <tr key={`empty-${index}`} className="border-b border-black">
                <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                <td className="border-r-2 border-black px-3 py-3 text-sm">&nbsp;</td>
                <td className="px-3 py-3 text-sm">&nbsp;</td>
              </tr>
            ))}

            {/* Total Row */}
            <tr className="bg-gray-100 border-t-2 border-black">
              <td colSpan={2} className="border-r-2 border-black px-3 py-3 text-sm font-bold">TOTAL PCS</td>
              <td className="border-r-2 border-black px-3 py-3 text-sm font-bold">
                {order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)} {translate('quantityUnits').toLowerCase()}
              </td>
              <td className="border-r-2 border-black px-3 py-3 text-right text-sm font-bold">TOTAL</td>
              <td className="px-3 py-3 text-right text-lg font-bold">${(invoice.totalAmount || 0).toFixed(2)}</td>
            </tr>
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
  );
}
