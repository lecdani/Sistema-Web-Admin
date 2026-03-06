import { apiClient, getBackendAssetUrl } from '@/shared/config/api';
import { API_CONFIG } from '@/shared/config/api';

export interface UploadImageResponse {
  fileName: string;
}

/**
 * Sube un archivo de imagen al servidor (S3).
 * POST /images/upload → 200 y { fileName }. Ese fileName se envía al crear/editar producto.
 * GET /images/url/{fileName} lo resuelve el backend; getProducts ya devuelve el link en cada producto.
 */
export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.postFormData<UploadImageResponse>(API_CONFIG.ENDPOINTS.IMAGES.UPLOAD, formData);
  let raw: any = res && typeof res === 'object' ? res : {};
  if (typeof res === 'string') {
    try {
      raw = res.trim().startsWith('{') ? JSON.parse(res) : {};
    } catch {
      raw = { fileName: res.trim() };
    }
  }
  const fileName = [
    raw?.fileName,
    raw?.FileName,
    raw?.file_name,
    raw?.fileNames?.[0],
    raw?.data?.fileName,
    raw?.data?.FileName,
    typeof res === 'string' && !raw?.fileName && !raw?.FileName ? String(res).trim() : ''
  ].find(v => v != null && String(v).trim() !== '');
  const value = fileName ? String(fileName).trim() : '';
  if (!value) {
    throw new Error('El servidor no devolvió fileName');
  }
  return { fileName: value };
}

/**
 * Obtiene la URL de visualización de una imagen subida (por fileName).
 * Usar para POD u otros módulos que guarden solo el fileName.
 * Si la API devuelve la URL, la usa; si no, devuelve la ruta del endpoint para que el backend la resuelva.
 */
export async function getImageUrl(fileName: string): Promise<string> {
  if (!fileName?.trim()) return '';
  const endpoint = API_CONFIG.ENDPOINTS.IMAGES.URL.replace('{fileName}', encodeURIComponent(fileName.trim()));
  try {
    const res = await apiClient.get<any>(endpoint);
    const url = typeof res === 'string' ? res : (res?.url ?? res?.Url ?? res?.imageUrl ?? '');
    return url ? String(url).trim() : getBackendAssetUrl(endpoint);
  } catch {
    return getBackendAssetUrl(endpoint);
  }
}
