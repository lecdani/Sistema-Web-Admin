import { getBackendAssetUrl } from '@/shared/config/api';

const ABS_HTTP = /^https?:\/\//i;

/** Corrige URLs mal serializadas tipo "https:/dominio/..." */
function fixProtocol(value: string): string {
  if (!value) return '';
  if (/^https?:\/(?!\/)/i.test(value)) return value.replace(/^https?:\//i, (m) => `${m}/`);
  return value;
}

/**
 * URL final para `<img src>` (proxy o absoluta).
 * Si `image` es solo un nombre de archivo, se asume GET `images/url/{file}` en el API.
 */
export function resolveProductImageAssetUrl(
  image?: string | null,
  imageFileName?: string | null
): string {
  const img = String(image ?? '').trim();
  if (img) {
    const n = fixProtocol(img);
    if (ABS_HTTP.test(n)) return n;
    if (n.startsWith('/api/') || n.startsWith('api/')) return n.startsWith('/') ? n : `/${n}`;
    const path =
      n.includes('/') || n.toLowerCase().startsWith('images/')
        ? n.replace(/^\/+/, '')
        : `images/url/${n}`;
    return getBackendAssetUrl(path);
  }

  const fn = String(imageFileName ?? '').trim();
  if (fn) {
    const n = fixProtocol(fn);
    if (ABS_HTTP.test(n)) return n;
    if (n.startsWith('/api/') || n.startsWith('api/')) return n.startsWith('/') ? n : `/${n}`;
    return getBackendAssetUrl(`images/url/${encodeURIComponent(fn)}`);
  }
  return '';
}

/** Misma resolución leyendo campos típicos de API (PascalCase incl.). */
export function resolveRawProductImageAssetUrl(raw: Record<string, unknown> | null | undefined): string {
  if (!raw) return '';
  const imagePath = String(raw.image ?? raw.Image ?? raw.imageUrl ?? raw.ImageUrl ?? '').trim();
  const fileName = String(raw.imageFileName ?? raw.ImageFileName ?? '').trim();
  return resolveProductImageAssetUrl(imagePath || undefined, fileName || undefined);
}
