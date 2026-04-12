import type { PlanogramPresentationSummaryRow } from '@/shared/utils/planogram-presentation-summary';

/** Columna «Familias»: código familia — nombre — vol unidad (igual que PWA). */
export function PresentationSummaryCell({
  row,
  compact,
}: {
  row: PlanogramPresentationSummaryRow;
  compact?: boolean;
}) {
  const code = (row.familyCode || '').trim();
  const name = (row.presentationName || row.familyName || '').trim();
  const vol =
    row.volume != null && Number.isFinite(Number(row.volume)) ? String(row.volume) : '';
  const unit = (row.unit || '').trim();
  const volUnit = [vol, unit].filter(Boolean).join(' ');

  const head = code && name ? `${code} - ${name}` : code || name || '—';
  const line = volUnit ? `${head} · ${volUnit}` : head;

  const textSize = compact ? 'text-xs' : 'text-sm';

  if (!code && !name && !volUnit) {
    return <div className={`${textSize} text-slate-400`}>—</div>;
  }

  return (
    <div className={`min-w-0 ${compact ? 'py-0.5' : 'py-1'}`}>
      <p className={`${textSize} text-slate-900 break-words`} title={line}>
        {head}
        {volUnit ? (
          <>
            {' '}
            <span className="text-slate-600 font-normal">· {volUnit}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
