import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { User } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.USERS;

function toUser(raw: any): User {
    return {
        id: String(raw.id ?? raw.Id ?? ''),
        email: String(raw.email ?? raw.Email ?? ''),
        firstName: String(raw.name ?? raw.Name ?? raw.firstName ?? raw.FirstName ?? ''),
        lastName: String(raw.lastName ?? raw.LastName ?? ''),
        phone: String(raw.phone ?? raw.Phone ?? ''),
        role: (String(raw.rol ?? raw.Rol ?? raw.role ?? raw.Role ?? 'user').toLowerCase()) as 'admin' | 'user',
        cityId: raw.cityId ?? raw.CityId ?? undefined,
        isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (raw.IsActive ?? true),
        createdAt: raw.createdAt ? new Date(raw.createdAt) : raw.CreatedAt ? new Date(raw.CreatedAt) : new Date(),
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.UpdatedAt ? new Date(raw.UpdatedAt) : new Date(),
        lastLoginAt: raw.lastLoginAt ? new Date(raw.lastLoginAt) : raw.LastLoginAt ? new Date(raw.LastLoginAt) : undefined,
        avatar: raw.avatar ?? raw.Avatar ?? undefined
    };
}

function toPayload(data: Partial<User> & { password?: string }) {
    const payload: any = {
        email: data.email?.trim(),
        name: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        phone: data.phone?.trim(),
        rol: data.role,
        isActive: data.isActive
    };

    if (data.password) {
        payload.password = data.password;
    }

    return payload;
}

/** Lista todos los usuarios */
export async function fetchUsers(): Promise<User[]> {
    const res = await apiClient.get<any>(E.GET_ALL);
    const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
    return (list as any[]).map(toUser);
}

/** Obtiene un usuario por id */
export async function fetchUserById(id: string): Promise<User | null> {
    const endpoint = E.GET_BY_ID.replace('{id}', encodeURIComponent(id));
    try {
        const res = await apiClient.get<any>(endpoint);
        return res ? toUser(res) : null;
    } catch {
        return null;
    }
}

/** Crea un usuario */
export async function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> & { password?: string }): Promise<User> {
    const res = await apiClient.post<any>(E.CREATE, toPayload(data));

    if (typeof res === 'string') {
        const fetched = await fetchUserById(res);
        if (fetched) return fetched;

        // Fallback
        return {
            id: res,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        } as User;
    }

    return toUser(res);
}

/** Actualiza un usuario */
export async function updateUser(id: string, data: Partial<User> & { password?: string }): Promise<User> {
    const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
    const payload = { id, ...toPayload(data) };

    const res = await apiClient.put<any>(endpoint, payload);

    if (typeof res === 'string' || res === null || res === undefined) {
        const fetched = await fetchUserById(id);
        if (fetched) return fetched;

        return {
            id,
            ...data,
            updatedAt: new Date()
        } as User;
    }

    return toUser(res);
}

/** Desactiva un usuario */
export async function deactivateUser(id: string): Promise<void> {
    const endpoint = E.DEACTIVATE.replace('{id}', encodeURIComponent(id));
    await apiClient.put(endpoint, { id });
}

export const usersApi = {
    fetchAll: fetchUsers,
    getById: fetchUserById,
    create: createUser,
    update: updateUser,
    deactivate: deactivateUser
};
