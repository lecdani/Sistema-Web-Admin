import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Category } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.CATEGORIES;

function toCategory(raw: any): Category {
  // Asegurar un id no vacío para evitar keys `` duplicadas en React
  let idValue =
    raw?.id ??
    raw?.Id ??
    raw?.name ??
    raw?.Name ??
    null;

  if (idValue == null || String(idValue).trim() === '') {
    idValue = `temp-${Math.random().toString(36).slice(2, 10)}`;
  }

  return {
    id: String(idValue),
    name: String(raw.name ?? raw.Name ?? '').trim() || 'Categoría',
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
    createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
  };
}

/** Lista todas las categorías */
export async function fetchCategories(): Promise<Category[]> {
  const res = await apiClient.get<any>(E.LIST);
  const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
  return (list as any[]).map(toCategory);
}

/** Obtiene una categoría por id */
export async function fetchCategoryById(id: string): Promise<Category | null> {
  const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
  try {
    const res = await apiClient.get<any>(endpoint);
    return res ? toCategory(res) : null;
  } catch {
    return null;
  }
}

/** Crea una categoría */
export async function createCategory(data: { name: string }): Promise<Category> {
  const payload = { name: (data.name ?? '').trim() || 'Categoría', Name: (data.name ?? '').trim() || 'Categoría' };
  const res = await apiClient.post<any>(E.CREATE, payload);

  // Igual que en marcas: si el backend no devuelve el nombre, usamos el que el usuario escribió
  if (res) {
    const raw = { ...res };
    if (!raw.name && !raw.Name) {
      raw.name = payload.name;
      raw.Name = payload.Name;
    }
    return toCategory(raw);
  }

  // Si el backend no devuelve nada, crear una categoría temporal con id único
  return toCategory({ id: `temp-${Math.random().toString(36).slice(2, 10)}`, ...payload });
}

/** Actualiza una categoría */
export async function updateCategory(id: string, data: { name: string }): Promise<Category> {
  const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
  const payload = { id, name: (data.name ?? '').trim(), Name: (data.name ?? '').trim() };
  const res = await apiClient.put<any>(endpoint, payload);
  if (res) {
    const raw = { ...res };
    if (!raw.name && !raw.Name) {
      raw.name = payload.name;
      raw.Name = payload.Name;
    }
    return toCategory(raw);
  }
  const fetched = await fetchCategoryById(id);
  return fetched ?? toCategory({ id, name: data.name, isActive: true, createdAt: new Date(), updatedAt: new Date() });
}

/** Activa/desactiva una categoría (mismo endpoint toggle) */
export async function toggleCategoryActive(id: string): Promise<void> {
  const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
  await apiClient.put(endpoint, { id });
}

export const categoriesApi = {
  fetchAll: fetchCategories,
  getById: fetchCategoryById,
  create: createCategory,
  update: updateCategory,
  toggleActive: toggleCategoryActive
};
