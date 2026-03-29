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

/**
 * POST/PUT producto: mismo shape que la API.
 * { name, code, brandId, familyId, isActive, imageFileName }
 */
export interface ProductWritePayload {
  name: string;
  code: string;
  brandId: string;
  familyId: string;
  isActive: boolean;
  /** Vacío si no hay imagen. */
  imageFileName: string;
}

function expandProductBody(b: ProductWritePayload): Record<string, unknown> {
  return {
    name: b.name,
    Name: b.name,
    code: b.code,
    Code: b.code,
    brandId: b.brandId,
    BrandId: b.brandId,
    familyId: b.familyId,
    FamilyId: b.familyId,
    isActive: b.isActive,
    IsActive: b.isActive,
    imageFileName: b.imageFileName,
    ImageFileName: b.imageFileName,
  };
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

/** Crea un producto (POST con name, code, brandId, familyId, isActive, imageFileName). */
export async function createProduct(data: ProductWritePayload): Promise<Product> {
  const body = expandProductBody({
    name: (data.name ?? '').trim(),
    code: String(data.code ?? '').trim(),
    brandId: String(data.brandId ?? '').trim(),
    familyId: String(data.familyId ?? '').trim(),
    isActive: data.isActive ?? true,
    imageFileName: String(data.imageFileName ?? '').trim(),
  });
  const res = await apiClient.post<any>(E.CREATE, body);
  if (res && (res.id || res.name)) return toProduct(res);
  const list = await fetchProducts();
  const created = list.find((p) => p.name === body.name);
  if (created) return created;
  return toProduct({ id: String(res?.id ?? res?.Id ?? ''), ...body });
}

/** Actualiza un producto (PUT con el mismo cuerpo que create; el id va en la URL). */
export async function updateProduct(id: string, data: ProductWritePayload): Promise<Product> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const body = expandProductBody({
    name: (data.name ?? '').trim(),
    code: String(data.code ?? '').trim(),
    brandId: String(data.brandId ?? '').trim(),
    familyId: String(data.familyId ?? '').trim(),
    isActive: data.isActive ?? true,
    imageFileName: String(data.imageFileName ?? '').trim(),
  });
  const res = await apiClient.put<any>(endpoint, body);
  if (typeof res === 'string' || res === null || res === undefined) {
    const fetched = await fetchProductById(id);
    if (fetched) return fetched;
  }
  return toProduct(res ?? { id, ...body });
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
