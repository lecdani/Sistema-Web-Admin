import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Product } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.PRODUCTS;

function toProduct(raw: any, currentPrice?: number): Product {
  const imageVal = raw.image ?? raw.Image ?? raw.imageUrl ?? raw.ImageUrl;
  const imageFileNameVal = raw.imageFileName ?? raw.ImageFileName;
  // .NET suele devolver FamilyId; la UI usa categoryId para resolver el nombre en el listado.
  const familyOrCategoryRaw =
    raw.familyId ??
    raw.FamilyId ??
    raw.categoryId ??
    raw.CategoryId ??
    undefined;
  const familyOrCategoryId =
    familyOrCategoryRaw != null && String(familyOrCategoryRaw).trim() !== ''
      ? String(familyOrCategoryRaw).trim()
      : undefined;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    code: String(raw.code ?? raw.Code ?? '').trim() || undefined,
    category: String(raw.category ?? raw.Category ?? raw.categoryName ?? raw.CategoryName ?? raw.familyName ?? raw.FamilyName ?? ''),
    sku: String(raw.sku ?? raw.Sku ?? raw.familySku ?? raw.FamilySku ?? ''),
    brandId: raw.brandId ?? raw.BrandId ?? undefined,
    familyId: familyOrCategoryId,
    categoryId: familyOrCategoryId,
    description: raw.description ?? raw.Description ?? undefined,
    image: imageVal != null && imageVal !== '' ? String(imageVal) : undefined,
    imageFileName: imageFileNameVal != null && imageFileNameVal !== '' ? String(imageFileNameVal) : undefined,
    currentPrice: currentPrice ?? Number(raw.currentPrice ?? raw.CurrentPrice ?? 0),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

export interface ProductPayload {
  name: string;
  code?: string;
  category?: string;
  sku?: string;
  isActive: boolean;
  brandId?: string;
  familyId?: string;
  categoryId?: string;
  /** Opcional. Nombre del archivo en S3 devuelto por POST /images/upload (confirmación de que el archivo existe en AWS S3). */
  imageFileName?: string;
}

/** Lista todos los productos. Si el backend devuelve error (ej. 500), devuelve [] para no romper la app. */
export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await apiClient.get<any>(E.LIST);
    const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
    return (list as any[]).map((raw: any) => toProduct(raw));
  } catch (err: any) {
    console.warn('[products-api] Error al listar productos:', err?.data?.message ?? err?.message);
    return [];
  }
}

/** Obtiene un producto por id */
export async function fetchProductById(id: string): Promise<Product | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toProduct(res) : null;
  } catch {
    return null;
  }
}

/** Obtiene productos por marca */
export async function fetchProductsByBrand(brandId: string): Promise<Product[]> {
  const endpoint = E.GET_BY_BRAND.replace('{brandId}', encodeURIComponent(brandId));
  const res = await apiClient.get<any>(endpoint);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map((raw: any) => toProduct(raw));
}

/** Crea un producto. imageFileNameOverride: si se pasa, se envía siempre al backend (evita pérdida por estado). */
export async function createProduct(
  data: ProductPayload,
  imageFileNameOverride?: string | null
): Promise<Product> {
  const payload: any = {
    name: (data.name ?? '').trim(),
    isActive: data.isActive ?? true
  };
  const productCode = (data.code ?? '').trim();
  if (productCode) {
    payload.code = productCode;
    payload.Code = productCode;
  }
  if (data.brandId) payload.brandId = data.brandId;
  const familyId = data.familyId ?? data.categoryId;
  if (familyId) {
    payload.familyId = familyId;
    payload.FamilyId = familyId;
  }
  const fileName = (imageFileNameOverride != null && imageFileNameOverride !== '')
    ? String(imageFileNameOverride).trim()
    : (data.imageFileName != null && data.imageFileName !== '')
      ? String(data.imageFileName).trim()
      : '';
  if (fileName) {
    payload.imageFileName = fileName;
    payload.ImageFileName = fileName;
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log('[products-api] createProduct payload:', JSON.stringify(payload));
  }
  const res = await apiClient.post<any>(E.CREATE, payload);
  if (res && (res.id || res.name)) return toProduct(res);
  const list = await fetchProducts();
  const created = list.find(p => p.name === payload.name);
  if (created) return created;
  return toProduct({ id: (res?.id ?? '').toString(), ...payload });
}

/** Actualiza un producto */
export async function updateProduct(id: string, data: Partial<ProductPayload>): Promise<Product> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload: any = { id, name: data.name?.trim(), isActive: data.isActive };
  if (data.code !== undefined) {
    const productCode = String(data.code ?? '').trim();
    payload.code = productCode;
    payload.Code = productCode;
  }
  if (data.brandId != null) payload.brandId = data.brandId;
  const familyId = data.familyId ?? data.categoryId;
  if (familyId != null) {
    payload.familyId = familyId;
    payload.FamilyId = familyId;
  }
  if (data.imageFileName !== undefined) {
    payload.imageFileName = data.imageFileName;
    payload.ImageFileName = data.imageFileName;
  }
  const res = await apiClient.put<any>(endpoint, payload);
  if (typeof res === 'string' || res === null || res === undefined) {
    const fetched = await fetchProductById(id);
    if (fetched) return fetched;
  }
  return toProduct(res ?? { id, ...payload });
}

/** Elimina un producto */
export async function deleteProduct(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(id));
  await apiClient.delete(endpoint);
}

export const productsApi = {
  fetchAll: fetchProducts,
  getById: fetchProductById,
  getByBrand: fetchProductsByBrand,
  // Alias legacy temporal
  getByCategory: fetchProductsByBrand,
  create: createProduct,
  update: updateProduct,
  delete: deleteProduct
};
