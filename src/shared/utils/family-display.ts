/** Etiqueta de familia para pedidos/facturas: código → nombre corto → volumen (+ unidad). */

export function sameFamilyId(a: string | undefined, b: string | undefined): boolean {
  const aa = String(a || '').trim();
  const bb = String(b || '').trim();
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  const an = Number(aa);
  const bn = Number(bb);
  if (Number.isNaN(an) || Number.isNaN(bn)) return false;
  return an === bn;
}

export function familyVolumeLabel(volume?: number, unit?: string): string {
  if (volume == null || !Number.isFinite(Number(volume))) return '';
  const u = String(unit || '').trim();
  return u ? `${volume} ${u}` : String(volume);
}

export function formatFamilyOrderLabel(meta: {
  code?: string;
  familyCode?: string;
  shortName?: string;
  name?: string;
  volume?: number;
  unit?: string;
}): string {
  const code = String(meta.code || meta.familyCode || '').trim();
  const short = String(meta.shortName || '').trim();
  const vol = familyVolumeLabel(meta.volume, meta.unit);
  const line = [code, short, vol].filter(Boolean).join(' · ');
  if (line) return line;
  return String(meta.name || '').trim();
}
