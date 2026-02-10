import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Product } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.PRODUCTS;

function toProduct(raw: any, currentPrice?: number): Product {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    sku: String(raw.sku ?? raw.Sku ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    category: String(raw.category ?? raw.Category ?? ''),
    description: raw.description ?? raw.Description ?? undefined,
    currentPrice: currentPrice ?? Number(raw.currentPrice ?? raw.CurrentPrice ?? 0),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

export interface ProductPayload {
  name: string;
  category: string;
  sku: string;
  isActive: boolean;
}

/** Lista todos los productos */
export async function fetchProducts(): Promise<Product[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map((raw: any) => toProduct(raw));
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

/** Obtiene productos por categoría */
export async function fetchProductsByCategory(category: string): Promise<Product[]> {
  const endpoint = E.GET_BY_CATEGORY.replace('{category}', encodeURIComponent(category));
  const res = await apiClient.get<any>(endpoint);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map((raw: any) => toProduct(raw));
}

/** Crea un producto */
export async function createProduct(data: ProductPayload): Promise<Product> {
  const payload = {
    name: (data.name ?? '').trim(),
    category: (data.category ?? '').trim(),
    sku: (data.sku ?? '').trim(),
    isActive: data.isActive ?? true
  };
  const res = await apiClient.post<any>(E.CREATE, payload);
  if (res && (res.id || res.name)) return toProduct(res);
  const list = await fetchProducts();
  const created = list.find(p => p.sku === payload.sku);
  if (created) return created;
  return toProduct({ id: (res?.id ?? '').toString(), ...payload });
}

/** Actualiza un producto */
export async function updateProduct(id: string, data: Partial<ProductPayload>): Promise<Product> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload: any = { name: data.name?.trim(), category: data.category?.trim(), sku: data.sku?.trim(), isActive: data.isActive };
  const res = await apiClient.put<any>(endpoint, { id, ...payload });
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
  getByCategory: fetchProductsByCategory,
  create: createProduct,
  update: updateProduct,
  delete: deleteProduct
};
