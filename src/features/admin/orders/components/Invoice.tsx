'use client';

import { useLanguage } from '@/shared/hooks/useLanguage';

/**
 * Factura idéntica a la PWA: colores y espaciado con valores fijos (hex + px)
 * para que no dependa del tema del Admin y se vea igual que en la PWA.
 */
export interface InvoiceItem {
  qty: number;
  code: string;
  description: string;
  price: number;
  amount: number;
}

export interface InvoiceProps {
  invoiceNumber: string;
  date: string;
  vendorName: string;
  storeName: string;
  storeAddress: string;
  items: InvoiceItem[];
  comments?: string;
}

// Paleta Tailwind slate por defecto (hex) para que coincida exactamente con la PWA
const s = {
  white: '#ffffff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
} as const;

export function Invoice({
  invoiceNumber,
  date,
  vendorName,
  storeName,
  storeAddress,
  items,
  comments,
}: InvoiceProps) {
  const { translate } = useLanguage();
  const totalPcs = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const addressOnly = (storeAddress || '').replace(/,?\s*[0-9a-f-]{36}\s*$/i, '').replace(/,?\s*\d+\s*$/, '').trim();

  return (
    <>
      <style>{`
        #invoice-print tbody tr:hover { background-color: rgba(248, 250, 252, 0.5); }
        @media print { #invoice-print { box-shadow: none !important; } }
      `}</style>
    <div
      id="invoice-print"
      style={{
        backgroundColor: s.white,
        color: s.slate800,
        maxWidth: '100%',
        width: '100%',
        margin: 0,
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
      className="print:shadow-none"
    >
      <div style={{ padding: '2.5rem 2.5rem 3.5rem 2.5rem', maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto' }} className="md:!px-12 md:!py-14">
        <div
          style={{
            borderBottomWidth: 2,
            borderBottomStyle: 'solid',
            borderBottomColor: s.slate800,
            paddingBottom: '2rem',
            marginBottom: '2.5rem',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between" style={{ gap: '9rem' }}>
            <div>
              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: s.slate500,
                  letterSpacing: '0.2em',
                  marginBottom: '0.25rem',
                  textTransform: 'uppercase',
                }}
              >
                Eternal Cosmetics
              </p>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: s.slate900,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.25,
                }}
              >
                ETERNAL COSMETICS, LLC
              </h1>
              <p style={{ fontSize: '0.875rem', color: s.slate600, marginTop: '0.5rem' }}>7NW 84TH ST, MIAMI, FL 33166</p>
              <p style={{ fontSize: '0.875rem', color: s.slate600 }}>TEL: (305) 12345678</p>
            </div>
            <div style={{ textAlign: 'right' }} className="sm:text-right">
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: s.slate900,
                  color: s.white,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  borderRadius: '2px',
                }}
              >
                {translate('invoiceLabel')}
              </div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: s.slate900, marginTop: '0.75rem' }}>{invoiceNumber || '—'}</p>
              <p style={{ fontSize: '0.875rem', color: s.slate600 }}>{translate('dateLabel')}: {date}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2" style={{ gap: '8.5rem', marginBottom: '3.5rem' }}>
          <div>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: s.slate500,
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}
            >
              {translate('clientStore')}
            </p>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: s.slate900 }}>{storeName || '—'}</p>
            <p style={{ fontSize: '0.875rem', color: s.slate600, marginTop: '0.25rem', lineHeight: 1.625 }}>{addressOnly || '—'}</p>
          </div>
          <div>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: s.slate500,
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}
            >
              {translate('sellerLabel')}
            </p>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: s.slate900 }}>{vendorName || '—'}</p>
          </div>
        </div>

        <div style={{ overflow: 'hidden', border: `1px solid ${s.slate200}`, marginBottom: '2.5rem' }}>
          <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: s.slate800, color: s.white }}>
                <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'center', width: '3.5rem' }}>{translate('qtyCol')}</th>
                <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'left' }}>{translate('descriptionCol')}</th>
                <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'right', width: '6rem' }}>{translate('unitPriceCol')}</th>
                <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'right', width: '7rem' }}>{translate('amountCol')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={index}
                  style={{
                    borderBottom: index < items.length - 1 ? `1px solid ${s.slate100}` : undefined,
                  }}
                >
                  <td style={{ padding: '1rem 2rem', textAlign: 'center', color: s.slate700 }}>{item.qty}</td>
                  <td style={{ padding: '1rem 2rem', color: s.slate900 }}>{item.description || '—'}</td>
                  <td style={{ padding: '1rem 2rem', textAlign: 'right', color: s.slate700 }}>${Number(item.price).toFixed(2)}</td>
                  <td style={{ padding: '1rem 2rem', textAlign: 'right', fontWeight: 500, color: s.slate900 }}>${Number(item.amount).toFixed(2)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem 1rem', textAlign: 'center', color: s.slate400, fontSize: '0.875rem' }}>{translate('noItems')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <div
            style={{
              width: '16rem',
              borderTopWidth: 2,
              borderTopStyle: 'solid',
              borderTopColor: s.slate200,
              paddingTop: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              <span style={{ color: s.slate600 }}>{translate('totalUnitsLabel')}</span>
              <span style={{ fontWeight: 500, color: s.slate800 }}>{totalPcs}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: s.slate900,
                marginTop: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: `1px solid ${s.slate100}`,
              }}
            >
              <span>{translate('totalLabel')}</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {comments && (
          <div
            style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: `1px solid ${s.slate200}`,
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: s.slate500,
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}
            >
              {translate('observations')}
            </p>
            <p style={{ fontSize: '0.875rem', color: s.slate700 }}>{comments}</p>
          </div>
        )}

        <div
          style={{
            marginTop: '2.5rem',
            paddingTop: '1rem',
            borderTop: `1px solid ${s.slate100}`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '10px',
              color: s.slate400,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Documento generado por PWA Vendedores · Eternal Cosmetics, LLC
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
