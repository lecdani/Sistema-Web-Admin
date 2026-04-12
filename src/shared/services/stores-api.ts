import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { Store } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.STORES;

function toStore(raw: any): Store {
    const hasPlanRaw =
        raw.hasPlanogram ??
        raw.HasPlanogram ??
        raw.has_planogram ??
        raw.HAS_PLANOGRAM;

    const hasPlanogram =
        typeof hasPlanRaw === 'boolean'
            ? hasPlanRaw
            : typeof hasPlanRaw === 'number'
                ? hasPlanRaw === 1
                : typeof hasPlanRaw === 'string'
                    ? ['true', '1', 'yes', 'y', 'si', 'sí'].includes(hasPlanRaw.trim().toLowerCase())
                    : false;

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        storeNumber: String(raw.storeNumber ?? raw.StoreNumber ?? '').trim() || undefined,
        zoneNumber: String(raw.zoneNumber ?? raw.ZoneNumber ?? '').trim() || undefined,
        zipCode: String(raw.zipCode ?? raw.ZipCode ?? '').trim() || undefined,
        name: String(raw.name ?? raw.Name ?? ''),
        street: String(raw.street ?? raw.Street ?? '').trim() || undefined,
        address: String(raw.address ?? raw.Address ?? raw.street ?? raw.Street ?? '').trim(),
        cityId: String(raw.cityId ?? raw.CityId ?? ''),
        districtId: String(raw.districtId ?? raw.DistrictId ?? '').trim() || undefined,
        hasPlanogram,
        isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
        createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date()
    };
}

function toPayload(data: Partial<Store>) {
    return {
        storeNumber: data.storeNumber?.trim(),
        StoreNumber: data.storeNumber?.trim(),
        zoneNumber: data.zoneNumber?.trim(),
        ZoneNumber: data.zoneNumber?.trim(),
        zipCode: data.zipCode?.trim(),
        ZipCode: data.zipCode?.trim(),
        name: data.name?.trim(),
        street: (data.street ?? data.address)?.trim(),
        Street: (data.street ?? data.address)?.trim(),
        cityId: data.cityId,
        CityId: data.cityId,
        districtId: data.districtId,
        DistrictId: data.districtId,
        hasPlanogram: data.hasPlanogram ?? false,
        HasPlanogram: data.hasPlanogram ?? false,
        isActive: data.isActive
    };
}

/** Lista todas las tiendas */
export async function fetchStores(): Promise<Store[]> {
    const res = await apiClient.get<any>(E.LIST);
    const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
    return (list as any[]).map(toStore);
}

/** Obtiene una tienda por id */
export async function fetchStoreById(id: string): Promise<Store | null> {
    const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
    try {
        const res = await apiClient.get<any>(endpoint);
        return res ? toStore(res) : null;
    } catch {
        return null;
    }
}

/** Crea una tienda */
export async function createStore(data: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> {
    const res = await apiClient.post<any>(E.CREATE, toPayload(data));

    if (typeof res === 'string') {
        const fetched = await fetchStoreById(res);
        if (fetched) return fetched;

        // Fallback simple
        return {
            id: res,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    return toStore(res);
}

/** Actualiza una tienda */
export async function updateStore(id: string, data: Partial<Store>): Promise<Store> {
    const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
    const payload = { id, ...toPayload(data) };

    const res = await apiClient.put<any>(endpoint, payload);

    if (typeof res === 'string' || res === null || res === undefined) {
        const fetched = await fetchStoreById(id);
        if (fetched) return fetched;
        // Fallback conservando datos previos
        return {
            id,
            name: data.name || '',
            address: data.address || '',
            cityId: data.cityId || '',
            districtId: data.districtId || '',
            isActive: data.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data
        } as Store;
    }

    return toStore(res);
}

/** Desactiva una tienda */
export async function deactivateStore(id: string): Promise<void> {
    const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
    await apiClient.put(endpoint, { id });
}

/** Obtiene tiendas por ciudad */
export async function fetchStoresByCity(cityId: string): Promise<Store[]> {
    const endpoint = E.GET_BY_CITY.replace('{cityId}', encodeURIComponent(cityId));
    try {
        const res = await apiClient.get<any>(endpoint);
        const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
        return (list as any[]).map(toStore);
    } catch {
        return [];
    }
}

/** Obtiene tiendas por distrito */
export async function fetchStoresByDistrict(districtId: string): Promise<Store[]> {
    const endpoint = E.GET_BY_DISTRICT.replace('{districtId}', encodeURIComponent(districtId));
    try {
        const res = await apiClient.get<any>(endpoint);
        const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
        return (list as any[]).map(toStore);
    } catch {
        return [];
    }
}

export const storesApi = {
    fetchAll: fetchStores,
    getById: fetchStoreById,
    create: createStore,
    update: updateStore,
    deactivate: deactivateStore,
    getByCity: fetchStoresByCity,
    getByDistrict: fetchStoresByDistrict
};
