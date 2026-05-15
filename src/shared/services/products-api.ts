import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Product, ProductFamilyEmbed, ProductPresentationEmbed } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.PRODUCTS;

function parsePresentationFromRaw(raw: any): ProductPresentationEmbed | undefined {
  const pres = raw?.presentation ?? raw?.Presentation;
  if (!pres || typeof pres !== 'object') return undefined;
  const famRaw = pres.family ?? pres.Family;
  let family: ProductFamilyEmbed | undefined;
  if (famRaw && typeof famRaw === 'object') {
    const b = famRaw.brand ?? famRaw.Brand;
    const cls = famRaw.class ?? famRaw.Class;
    family = {
      id:
        famRaw.id != null || famRaw.Id != null
          ? String(famRaw.id ?? famRaw.Id ?? '').trim() || undefined
          : undefined,
      name: famRaw.name != null || famRaw.Name != null ? String(famRaw.name ?? famRaw.Name ?? '').trim() : undefined,
      familyCode:
        famRaw.familyCode != null || famRaw.FamilyCode != null
          ? String(famRaw.familyCode ?? famRaw.FamilyCode ?? '').trim()
          : undefined,
      code:
        famRaw.code != null || famRaw.Code != null ? String(famRaw.code ?? famRaw.Code ?? '').trim() : undefined,
      brandId:
        famRaw.brandId ??
        famRaw.BrandId ??
        (b && (b.id ?? b.Id) != null ? String(b.id ?? b.Id).trim() : undefined),
      classId:
        famRaw.classId ??
        famRaw.ClassId ??
        (cls && (cls.id ?? cls.Id) != null ? String(cls.id ?? cls.Id).trim() : undefined),
    };
    if (
      !family.id &&
      !family.name &&
      !family.familyCode &&
      !family.code &&
      !family.brandId &&
      !family.classId
    ) {
      family = undefined;
    }
  }
  const vol = pres.volume ?? pres.Volume;
  const volN = vol != null && vol !== '' ? Number(vol) : NaN;
  const id = pres.id != null || pres.Id != null ? String(pres.id ?? pres.Id ?? '').trim() || undefined : undefined;
  const sku = pres.sku != null || pres.Sku != null ? String(pres.sku ?? pres.Sku ?? '').trim() : undefined;
  const genericCode =
    pres.genericCode != null || pres.GenericCode != null
      ? String(pres.genericCode ?? pres.GenericCode ?? '').trim()
      : undefined;
  const unit = pres.unit != null || pres.Unit != null ? String(pres.unit ?? pres.Unit ?? '').trim() : undefined;
  const volume = Number.isFinite(volN) ? volN : undefined;
  const presName =
    pres.name != null || pres.Name != null
      ? String(pres.name ?? pres.Name ?? '').trim() || undefined
      : undefined;
  const genericLabel =
    pres.genericLabel != null || pres.GenericLabel != null
      ? String(pres.genericLabel ?? pres.GenericLabel ?? '').trim() || undefined
      : undefined;
  const presentationDisplayName = presName || genericLabel;
  if (!id && !sku && !genericCode && volume === undefined && !unit && !family && !presentationDisplayName)
    return undefined;
  return { id, name: presentationDisplayName, sku, genericCode, volume, unit, family };
}

function toProduct(raw: any, currentPrice?: number): Product {
  const imageVal = raw.image ?? raw.Image ?? raw.imageUrl ?? raw.ImageUrl;
  const imageFileNameVal = raw.imageFileName ?? raw.ImageFileName;
  const presentation = parsePresentationFromRaw(raw);
  // .NET suele devolver FamilyId; la UI usa categoryId para resolver el nombre en el listado.
  const familyOrCategoryRaw =
    raw.familyId ??
    raw.FamilyId ??
    raw.categoryId ??
    raw.CategoryId ??
    presentation?.family?.id ??
    undefined;
  const familyOrCategoryId =
    familyOrCategoryRaw != null && String(familyOrCategoryRaw).trim() !== ''
      ? String(familyOrCategoryRaw).trim()
      : undefined;
  const presentationIdRaw = raw.presentationId ?? raw.PresentationId ?? presentation?.id ?? undefined;
  const presentationId =
    presentationIdRaw != null && String(presentationIdRaw).trim() !== ''
      ? String(presentationIdRaw).trim()
      : undefined;
  const categoryLabel =
    raw.category ??
    raw.Category ??
    raw.categoryName ??
    raw.CategoryName ??
    raw.familyName ??
    raw.FamilyName ??
    presentation?.family?.name ??
    '';
  const brandFromNested = presentation?.family?.brandId ?? raw.brandId ?? raw.BrandId ?? undefined;
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    name: String(raw.name ?? raw.Name ?? ''),
    shortName: String(raw.shortName ?? raw.ShortName ?? '').trim() || undefined,
    code: String(raw.code ?? raw.Code ?? '').trim() || undefined,
    category: String(categoryLabel ?? ''),
    // SKU ahora pertenece a Product, no a Presentation.
    sku: String(raw.sku ?? raw.Sku ?? ''),
    genericCode: String(raw.genericCode ?? raw.GenericCode ?? presentation?.genericCode ?? '').trim() || undefined,
    brandId:
      brandFromNested != null && String(brandFromNested).trim() !== ''
        ? String(brandFromNested).trim()
        : undefined,
    familyId: familyOrCategoryId,
    categoryId: familyOrCategoryId,
    presentationId,
    presentation,
    description: raw.description ?? raw.Description ?? undefined,
    image: imageVal != null && imageVal !== '' ? String(imageVal) : undefined,
    imageFileName: imageFileNameVal != null && imageFileNameVal !== '' ? String(imageFileNameVal) : undefined,
    currentPrice: currentPrice ?? Number(raw.currentPrice ?? raw.CurrentPrice ?? 0),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

/** POST /products y PUT /products/{id}: mismos campos que expone el API (camelCase). */
export interface ProductUpsertPayload {
  name: string;
  code: string;
  isActive: boolean;
  imageFileName: string;
  shortName: string;
  presentationId: string;
  sku: string;
}

/** Alias por compatibilidad con código que importaba `ProductUpdatePayload`. */
export type ProductUpdatePayload = ProductUpsertPayload;

/** Extrae un array de la respuesta típica .NET / wrappers (`data`, `value`, `products`, etc.). */
function unwrapProductListPayload(res: unknown): any[] {
  if (Array.isArray(res)) return res as any[];
  if (!res || typeof res !== 'object') return [];
  const o = res as Record<string, unknown>;
  const candidates = [
    o.data,
    o.Data,
    o.items,
    o.Items,
    o.value,
    o.Value,
    o.products,
    o.Products,
    o.results,
    o.Results,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as any[];
  }
  return [];
}

/** Lista todos los productos. Si el backend devuelve error (ej. 500), devuelve [] para no romper la app. */
export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await apiClient.get<any>(E.LIST);
    const list = unwrapProductListPayload(res);
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
  const list = unwrapProductListPayload(res);
  return (list as any[]).map((raw: any) => toProduct(raw));
}

/** Crea un producto (POST solo con el contrato del API). */
export async function createProduct(data: ProductUpsertPayload): Promise<Product> {
  const body = {
    name: String(data.name ?? '').trim(),
    code: String(data.code ?? '').trim(),
    isActive: data.isActive ?? true,
    imageFileName: String(data.imageFileName ?? '').trim(),
    shortName: String(data.shortName ?? '').trim() || String(data.name ?? '').trim(),
    presentationId: String(data.presentationId ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
  };
  const res = await apiClient.post<any>(E.CREATE, body);
  if (res && (res.id || res.Id || res.name || res.Name)) return toProduct(res);
  const list = await fetchProducts();
  const codeLc = body.code.toLowerCase();
  const pres = body.presentationId;
  const created =
    list.find(
      (p) =>
        String(p.code ?? '')
          .trim()
          .toLowerCase() === codeLc &&
        String(p.presentationId ?? '')
          .trim() === pres
    ) ?? list.find((p) => p.name === body.name && String(p.code ?? '').trim().toLowerCase() === codeLc);
  if (created) return created;
  return toProduct({ id: String(res?.id ?? res?.Id ?? ''), ...res, ...body });
}

/** Actualiza un producto: PUT solo con los campos que expone el API. */
export async function updateProduct(id: string, data: ProductUpdatePayload): Promise<Product> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const idStr = String(id).trim();
  const body = {
    id: idStr,
    name: String(data.name ?? '').trim(),
    code: String(data.code ?? '').trim(),
    isActive: data.isActive ?? true,
    imageFileName: String(data.imageFileName ?? '').trim(),
    shortName: String(data.shortName ?? '').trim() || String(data.name ?? '').trim(),
    presentationId: String(data.presentationId ?? '').trim(),
    sku: String(data.sku ?? '').trim(),
  };
  const res = await apiClient.put<any>(endpoint, body);
  if (typeof res === 'string' || res === null || res === undefined) {
    const fetched = await fetchProductById(idStr);
    if (fetched) return fetched;
  }
  return toProduct(res ?? body);
}

/** Elimina un producto */
export async function deleteProduct(id: string): Promise<void> {
  const endpoint = E.DELETE.replace('{id}', encodeURIComponent(id));
  await apiClient.delete(endpoint);
}

/** Desactiva un producto (baja lógica). */
export async function deactivateProduct(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.patch(endpoint, {});
}

export const productsApi = {
  fetchAll: fetchProducts,
  getById: fetchProductById,
  getByBrand: fetchProductsByBrand,
  // Alias legacy temporal
  getByCategory: fetchProductsByBrand,
  create: createProduct,
  update: updateProduct,
  delete: deleteProduct,
  deactivate: deactivateProduct
};
