/**
 * Factura A4 (admin): HTML aislado en iframe oculto + `print()` (sin `window.open` para no abrir pestañas).
 * Chrome: fecha/URL en el pie se controlan con «Encabezados y pies» en el diálogo de impresión.
 * Ticket térmico: `window.print()` en la vista actual.
 */

const SKIP_COMPUTED_PROPS = new Set([
  'cursor',
  'caret-color',
  'pointer-events',
  'user-select',
  'scroll-behavior',
  'animation',
  'animation-delay',
  'animation-direction',
  'animation-duration',
  'animation-fill-mode',
  'animation-iteration-count',
  'animation-name',
  'animation-play-state',
  'animation-timing-function',
  'transition',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
  'will-change',
  'content',
  'resize',
  'anchor-name',
  /* Evitan desplazamientos raros al copiar estilos desde el modal */
  'transform',
  'filter',
  'perspective',
  'translate',
]);

const SKIP_LAYOUT_SNAPSHOT = new Set([
  'margin-left',
  'margin-right',
  'margin-inline-start',
  'margin-inline-end',
  'inset',
  'left',
  'right',
]);

function shouldSkipProp(prop: string): boolean {
  if (!prop) return true;
  if (prop.startsWith('--')) return true;
  if (SKIP_COMPUTED_PROPS.has(prop)) return true;
  /* Evita desplazar la factura al imprimir en iframe (copiado desde el modal). */
  if (SKIP_LAYOUT_SNAPSHOT.has(prop)) return true;
  return false;
}

/** Copia estilos computados del árbol `src` al clon paralelo `dst` (misma forma). */
function snapshotComputedStylesDeep(src: Element, dst: Element): void {
  if (src instanceof HTMLElement && dst instanceof HTMLElement) {
    const cs = window.getComputedStyle(src);
    const existing = (dst.getAttribute('style') || '').trim();
    const parts: string[] = [];
    if (existing) parts.push(existing.endsWith(';') ? existing : `${existing};`);

    for (let i = 0; i < cs.length; i++) {
      const prop = cs.item(i);
      if (!prop || shouldSkipProp(prop)) continue;
      let val: string;
      try {
        val = cs.getPropertyValue(prop);
      } catch {
        continue;
      }
      if (val === '' || val == null) continue;
      if (val.includes('var(')) continue;
      parts.push(`${prop}:${val};`);
    }
    dst.setAttribute('style', parts.join(''));
  }

  const sn = src.children.length;
  const dn = dst.children.length;
  for (let i = 0; i < sn && i < dn; i++) {
    snapshotComputedStylesDeep(src.children[i], dst.children[i]);
  }
}

function stripAllClasses(root: Element): void {
  root.removeAttribute('class');
  root.querySelectorAll('*').forEach((el) => el.removeAttribute('class'));
}

/**
 * Quita del árbol propiedades de caja copiadas del modal (anchos/márgenes/posición) que desplazan
 * la factura a la derecha en el iframe de impresión.
 */
function stripLayoutPropsFromInlineStyles(root: HTMLElement): void {
  const reject = new Set([
    'width',
    'max-width',
    'min-width',
    'margin',
    'margin-left',
    'margin-right',
    'margin-top',
    'margin-bottom',
    'margin-inline',
    'margin-inline-start',
    'margin-inline-end',
    'margin-block',
    'margin-block-start',
    'margin-block-end',
    'inset',
    'left',
    'right',
    'top',
    'bottom',
    'position',
    'transform',
    'flex',
    'flex-grow',
    'flex-shrink',
    'flex-basis',
    'align-self',
    'justify-self',
  ]);
  const walk = (el: Element) => {
    if (el instanceof HTMLElement && el.hasAttribute('style')) {
      const raw = el.getAttribute('style') || '';
      const kept = raw
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .filter((pair) => {
          const key = pair.split(':')[0]?.trim().toLowerCase();
          return key && !reject.has(key);
        });
      const next = kept.join('; ');
      if (next) el.setAttribute('style', next);
      else el.removeAttribute('style');
    }
    Array.from(el.children).forEach(walk);
  };
  walk(root);
}

/** El snapshot copia márgenes/anchos del modal; al quitar estilos inline la hoja se centra con el CSS embebido. */
function sanitizeInvoiceCloneForPrint(root: HTMLElement): void {
  root.removeAttribute('style');
  const inner = root.querySelector('.invoice-inner');
  if (inner instanceof HTMLElement) inner.removeAttribute('style');
}

function buildIsolatedPrintDocument(bodyInnerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Factura</title>
<meta name="robots" content="noindex,nofollow"/>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    width: 100% !important;
    display: block !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  /* Márgenes de página equilibrados (el centrado lo hace la caja interior). */
  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    html, body { height: auto !important; overflow: visible !important; }
  }
  /* Misma idea que el listado de catálogo: banda centrada en toda la hoja. */
  .admin-print-invoice-sheet {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    padding: 0 2mm !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    box-sizing: border-box !important;
  }
  /* Colores como en pantalla (slate / cabecera tabla) */
  #invoice-print, #invoice-print * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  #invoice-print h1 {
    color: #0f172a !important;
  }
  #invoice-print .invoice-inner > div:first-child p:first-of-type,
  #invoice-print .invoice-inner > div:nth-child(2) p:first-of-type {
    color: #64748b !important;
  }
  #invoice-print table thead tr th {
    background-color: #1e293b !important;
    color: #ffffff !important;
  }
  /* Raíz: ocupa el ancho útil del contenedor centrado */
  #invoice-print {
    position: relative !important;
    left: auto !important;
    top: 0 !important;
    right: auto !important;
    transform: none !important;
    width: 100% !important;
    max-width: 190mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    page-break-inside: auto;
    box-sizing: border-box !important;
    flex: 0 1 auto !important;
  }
  /* Bloque interior centrado en la hoja A4 */
  #invoice-print .invoice-inner {
    max-width: 100% !important;
    width: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
    padding: 8mm 6mm 10mm !important;
    transform: none !important;
    box-sizing: border-box !important;
  }
  /*
   * Encabezado: en el modal suele ganar flex-column; forzamos fila para alinear
   * datos de empresa (izq.) y bloque factura + nº + fecha (der.).
   */
  #invoice-print .invoice-inner > div:first-child > div:first-child {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    gap: 2rem !important;
    width: 100% !important;
  }
  #invoice-print .invoice-inner > div:first-child > div:first-child > div:first-child {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    max-width: 62% !important;
  }
  #invoice-print .invoice-inner > div:first-child > div:first-child > div:last-child {
    flex: 0 0 auto !important;
    max-width: 38% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
    justify-content: flex-start !important;
    text-align: right !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-right: 0 !important;
    padding-left: 0.5rem !important;
  }
  #invoice-print .invoice-inner > div:first-child > div:first-child > div:last-child p {
    text-align: right !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  #invoice-print .invoice-inner > div:first-child > div:first-child > div:last-child > div:first-child {
    width: auto !important;
    max-width: 100% !important;
  }
  /* Tienda / vendedor: dos columnas estables */
  #invoice-print .invoice-inner > div:nth-child(2) {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    column-gap: 2.5rem !important;
    row-gap: 0.5rem !important;
    align-items: start !important;
    width: 100% !important;
  }
  #invoice-print table {
    width: 100% !important;
    border-collapse: collapse !important;
    break-inside: auto;
    page-break-inside: auto;
  }
  #invoice-print thead { display: table-header-group !important; }
  #invoice-print tbody tr { break-inside: avoid; page-break-inside: avoid; }
  #invoice-print .invoice-table-wrap { overflow: visible !important; }
</style>
</head>
<body style="margin:0;padding:0;background:#fff;width:100%;box-sizing:border-box;">
<div class="admin-print-invoice-sheet">
${bodyInnerHtml}
</div>
</body>
</html>`;
}

export function printAdminInvoiceNormalFromDom(): void {
  if (typeof window === 'undefined') return;

  const node = document.getElementById('invoice-print');
  if (!node) {
    window.print();
    return;
  }

  if (node.classList.contains('ticket-print')) {
    window.print();
    return;
  }

  const clone = node.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');

  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText =
    'position:fixed;left:-32000px;top:0;width:210mm;max-width:100%;visibility:hidden;pointer-events:none;z-index:-1;';
  ghost.appendChild(clone);
  document.body.appendChild(ghost);

  const run = () => {
    try {
      snapshotComputedStylesDeep(node, clone);
      stripLayoutPropsFromInlineStyles(clone);
      stripAllClasses(clone);
      sanitizeInvoiceCloneForPrint(clone);
      clone.setAttribute('id', 'invoice-print');

      const html = buildIsolatedPrintDocument(clone.outerHTML);
      document.body.removeChild(ghost);

      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'print-invoice');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText =
        'position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;opacity:0;pointer-events:none;z-index:2147483646;';

      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win) {
        document.body.removeChild(iframe);
        window.print();
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      const printAndCleanup = () => {
        try {
          win.focus();
          win.print();
        } finally {
          window.setTimeout(() => {
            try {
              if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            } catch {
              /* ignore */
            }
          }, 800);
        }
      };

      window.setTimeout(printAndCleanup, 80);
    } catch {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      window.print();
    }
  };

  window.requestAnimationFrame(() => window.requestAnimationFrame(run));
}
