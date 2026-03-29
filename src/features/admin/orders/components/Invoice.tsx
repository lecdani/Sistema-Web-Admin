'use client';

import { useMemo, type ReactNode } from 'react';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { familyVolumeLabel } from '@/shared/utils/family-display';

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
  familyName?: string;
  familyCode?: string;
  familySku?: string;
  /** Nombre corto de familia (PWA: mismo criterio que FamilySummaryCell — junto a código). */
  familyShortName?: string;
  familyVolume?: number;
  familyUnit?: string;
}

export interface InvoiceProps {
  invoiceNumber: string;
  date: string;
  vendorName: string;
  /** Código de ruta de ventas (resaltado); el nombre del vendedor va entre paréntesis. */
  vendorRouteCode?: string;
  vendorPersonName?: string;
  storeName: string;
  storeAddress: string;
  items: InvoiceItem[];
  comments?: string;
  viewMode?: 'product' | 'family';
  printLayout?: 'normal' | 'ticket';
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
  vendorRouteCode,
  vendorPersonName,
  storeName,
  storeAddress,
  items,
  comments,
  viewMode = 'product',
  printLayout = 'normal',
}: InvoiceProps) {
  const { translate } = useLanguage();
  const productRows = useMemo(() => {
    // Agrupar por SKU/descripcion/precio para evitar duplicados en "Por producto".
    const byKey = new Map<string, InvoiceItem & { qty: number; amount: number }>();
    items.forEach((it) => {
      const code = String(it.code || '').trim();
      const desc = String(it.description || '').trim();
      const price = Number(it.price) || 0;
      const key = `${code}||${desc}||${price}`;
      if (!byKey.has(key)) {
        byKey.set(key, { ...it, qty: 0, amount: 0 });
      }
      const row = byKey.get(key)!;
      row.qty += Number(it.qty) || 0;
      row.amount += Number(it.amount) || 0;
    });
    return [...byKey.values()].filter((x) => x.qty !== 0 || x.amount !== 0);
  }, [items]);
  const totalPcs = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const addressOnly = (storeAddress || '').replace(/,?\s*[0-9a-f-]{36}\s*$/i, '').replace(/,?\s*\d+\s*$/, '').trim();

  const familyRowsGroupedBySku = useMemo(() => {
    const bySku = new Map<
      string,
      {
        sku: string;
        code: string;
        familyShortName: string;
        familyName: string;
        familyVolume?: number;
        familyUnit?: string;
        qty: number;
        amount: number;
      }
    >();
    items.forEach((it) => {
      const sku = String(it.familySku || '').trim();
      const code = String(it.familyCode || '').trim();
      const familyShortName = String(it.familyShortName || '').trim();
      const familyName = String(it.familyName || '').trim() || translate('invoiceNoFamily');
      const fv =
        it.familyVolume != null && Number.isFinite(Number(it.familyVolume))
          ? Number(it.familyVolume)
          : undefined;
      const fu = String(it.familyUnit || '').trim() || undefined;
      const key = (sku || code || familyName).toLowerCase();
      if (!bySku.has(key)) {
        bySku.set(key, {
          sku: sku || '—',
          code,
          familyShortName,
          familyName,
          familyVolume: fv,
          familyUnit: fu,
          qty: 0,
          amount: 0,
        });
      }
      const row = bySku.get(key)!;
      if ((!row.sku || row.sku === '—') && sku) row.sku = sku;
      if (!row.code && code) row.code = code;
      if (!row.familyShortName && familyShortName) row.familyShortName = familyShortName;
      if (!row.familyName && familyName) row.familyName = familyName;
      if (row.familyVolume == null && fv != null) row.familyVolume = fv;
      if (!row.familyUnit && fu) row.familyUnit = fu;
      row.qty += Number(it.qty) || 0;
      row.amount += Number(it.amount) || 0;
    });
    return [...bySku.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount);
  }, [items, translate]);

  if (printLayout === 'ticket') {
    const rows =
      viewMode === 'family'
        ? familyRowsGroupedBySku.map((r) => {
            const vol = familyVolumeLabel(r.familyVolume, r.familyUnit);
            const desc =
              [r.code, r.familyShortName, vol].filter(Boolean).join(' · ') ||
              r.familyName ||
              translate('invoiceNoFamily');
            return {
              left: `${r.sku || '—'} — ${desc}`.trim(),
              qty: r.qty,
              amount: r.amount,
            };
          })
        : productRows.map((it) => ({
            left: `${it.code || '—'} ${it.description || ''}`.trim(),
            qty: Number(it.qty) || 0,
            amount: Number(it.amount) || 0,
          }));

    const ticketUnits = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const ticketTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const ticketStore = String(storeName || '').trim() || '—';
    const ticketVendor = vendorRouteCode?.trim()
      ? `${vendorRouteCode.trim()}${(vendorPersonName || vendorName)?.trim() ? ` (${(vendorPersonName || vendorName).trim()})` : ''}`
      : String((vendorPersonName || vendorName || '').trim() || '—') || '—';
    const ticketAddress = String(addressOnly || '').trim();

    return (
      <>
        <style>{`
          @media print {
            #invoice-print.ticket-print {
              width: 58mm !important;
              max-width: 58mm !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: 0 !important;
            }
          }
        `}</style>
        <div id="invoice-print" className="ticket-print bg-white text-black" style={{ fontFamily: 'monospace', fontSize: 11, padding: 6 }}>
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontWeight: 700 }}>ETERNAL COSMETICS</div>
            <div>{invoiceNumber || '—'}</div>
            <div>{date}</div>
          </div>
          <div style={{ marginBottom: 4 }}>
            <div><strong>TDA:</strong> {ticketStore}</div>
            <div><strong>VND:</strong> {ticketVendor}</div>
            {ticketAddress ? <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{ticketAddress}</div> : null}
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>{viewMode === 'family' ? 'SKU/FAM' : 'SKU/ITEM'}</span>
            <span>CNT  IMP</span>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
          {rows.map((r, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.left}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>x{r.qty}</span>
                <span>${Number(r.amount).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{translate('totalUnitsLabel')}</span>
            <strong>{ticketUnits}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>{translate('totalLabel')}</span>
            <span>${ticketTotal.toFixed(2)}</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        #invoice-print tbody tr:hover { background-color: rgba(248, 250, 252, 0.5); }
        @media print {
          #invoice-print {
            box-shadow: none !important;
            max-width: none !important;
            overflow: visible !important;
            page-break-inside: auto;
          }
          #invoice-print .invoice-inner {
            max-width: none !important;
            padding: 1rem 1.5rem 2rem !important;
          }
          #invoice-print .invoice-table-wrap {
            overflow: visible !important;
          }
        }
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
      <div
        className="invoice-inner md:!px-12 md:!py-14"
        style={{ padding: '2.5rem 2.5rem 3.5rem 2.5rem', maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto' }}
      >
        <div
          style={{
            borderBottomWidth: 2,
            borderBottomStyle: 'solid',
            borderBottomColor: s.slate800,
            paddingBottom: '2rem',
            marginBottom: '2.5rem',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between" style={{ gap: '2rem' }}>
            <div style={{ flexShrink: 0 }}>
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
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                paddingRight: '1rem',
                marginLeft: 'auto',
              }}
              className="sm:text-right"
            >
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
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: s.slate900 }}>
              {vendorRouteCode?.trim() ? (
                <>
                  <span style={{ fontWeight: 800, letterSpacing: '0.06em', color: s.slate900 }}>
                    {vendorRouteCode.trim()}
                  </span>
                  {(vendorPersonName || vendorName)?.trim() ? (
                    <span style={{ fontWeight: 600, color: s.slate600 }}>
                      {' '}
                      ({(vendorPersonName || vendorName).trim()})
                    </span>
                  ) : null}
                </>
              ) : (
                (vendorPersonName || vendorName || '—').trim() || '—'
              )}
            </p>
          </div>
        </div>

        <div
          className="invoice-table-wrap"
          style={{ overflow: 'hidden', border: `1px solid ${s.slate200}`, marginBottom: '2.5rem' }}
        >
          <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead>
              {viewMode === 'product' ? (
                <tr style={{ backgroundColor: s.slate800, color: s.white }}>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'center', width: '3.5rem' }}>{translate('qtyCol')}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'left', width: '6rem' }}>{translate('skuCol') || 'SKU'}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'left' }}>{translate('descriptionCol')}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'right', width: '6rem' }}>{translate('unitPriceCol')}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'right', width: '7rem' }}>{translate('amountCol')}</th>
                </tr>
              ) : (
                <tr style={{ backgroundColor: s.slate800, color: s.white }}>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'left', width: '6rem' }}>{translate('skuCol') || 'SKU'}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'left' }}>{translate('descriptionCol')}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'right', width: '6rem' }}>{translate('qtyCol')}</th>
                  <th style={{ padding: '1rem 2rem', fontWeight: 600, textAlign: 'right', width: '7rem' }}>{translate('amountCol')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {viewMode === 'product'
                ? productRows.map((item, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: index < productRows.length - 1 ? `1px solid ${s.slate100}` : undefined,
                      }}
                    >
                      <td style={{ padding: '1rem 2rem', textAlign: 'center', color: s.slate700 }}>{item.qty}</td>
                      <td style={{ padding: '1rem 2rem', color: s.slate700 }}>{item.code || '—'}</td>
                      <td style={{ padding: '1rem 2rem', color: s.slate900 }}>{item.description || '—'}</td>
                      <td style={{ padding: '1rem 2rem', textAlign: 'right', color: s.slate700 }}>${Number(item.price).toFixed(2)}</td>
                      <td style={{ padding: '1rem 2rem', textAlign: 'right', fontWeight: 500, color: s.slate900 }}>${Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))
                : familyRowsGroupedBySku.map((item, index) => {
                    const volText = familyVolumeLabel(item.familyVolume, item.familyUnit);
                    const familyParts: ReactNode[] = [];
                    if (item.code) {
                      familyParts.push(
                        <span key="fc" style={{ fontWeight: 700, color: s.slate900 }}>
                          {item.code}
                        </span>
                      );
                    }
                    if (item.familyShortName) {
                      familyParts.push(
                        <span key="fs" style={{ color: s.slate800 }}>
                          {item.familyShortName}
                        </span>
                      );
                    }
                    if (volText) {
                      familyParts.push(
                        <span key="fv" style={{ color: s.slate600 }}>
                          {volText}
                        </span>
                      );
                    }
                    const familyLine =
                      familyParts.length > 0 ? (
                        <span style={{ fontSize: '0.875rem' }}>
                          {familyParts.flatMap((node, i) =>
                            i === 0 ? [node] : [<span key={`fd-${i}`} style={{ color: s.slate400, margin: '0 0.35rem' }}>·</span>, node]
                          )}
                        </span>
                      ) : null;
                    return (
                      <tr
                        key={`f-${index}`}
                        style={{
                          borderBottom:
                            index < familyRowsGroupedBySku.length - 1 ? `1px solid ${s.slate100}` : undefined,
                        }}
                      >
                        <td style={{ padding: '1rem 2rem', color: s.slate700 }}>{item.sku || '—'}</td>
                        <td style={{ padding: '1rem 2rem', color: s.slate900 }}>
                          {familyLine ?? <span>{item.familyName || translate('invoiceNoFamily')}</span>}
                        </td>
                        <td style={{ padding: '1rem 2rem', textAlign: 'right', color: s.slate700 }}>{item.qty}</td>
                        <td style={{ padding: '1rem 2rem', textAlign: 'right', fontWeight: 500, color: s.slate900 }}>
                          ${Number(item.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
              {(viewMode === 'product' ? productRows.length === 0 : familyRowsGroupedBySku.length === 0) && (
                <tr>
                  <td colSpan={viewMode === 'product' ? 5 : 4} style={{ padding: '2rem 1rem', textAlign: 'center', color: s.slate400, fontSize: '0.875rem' }}>{translate('noItems')}</td>
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
