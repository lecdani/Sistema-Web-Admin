import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { User } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.USERS;

function toUser(raw: any): User {
    const rawRole = String(raw.rol ?? raw.Rol ?? raw.role ?? raw.Role ?? 'user').toLowerCase();
    const role: 'admin' | 'user' = rawRole.startsWith('admin') ? 'admin' : 'user'; // cualquier otro (Vendedor, etc.) se trata como usuario normal

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        email: String(raw.email ?? raw.Email ?? ''),
        firstName: String(raw.name ?? raw.Name ?? raw.firstName ?? raw.FirstName ?? ''),
        lastName: String(raw.lastName ?? raw.LastName ?? ''),
        phone: String(raw.phone ?? raw.Phone ?? ''),
        role,
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
        rol: data.role ? toApiRol(data.role) : undefined,
        isActive: data.isActive
    };

    if (data.password) {
        payload.password = data.password;
        payload.newPassword = data.password;
        payload.NewPassword = data.password;
        payload.Password = data.password;
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

/** Valor de rol que espera la API Identity (PascalCase: Admin, Vendedor) */
function toApiRol(role: string | undefined): string {
    const r = (role ?? 'user').toLowerCase();
    return r === 'admin' ? 'Admin' : 'Vendedor';
}

/** Crea un usuario vía POST /auth/register (email, password, name, lastName, rol, phone) */
export async function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> & { password?: string }): Promise<User> {
    const registerEndpoint = API_CONFIG.ENDPOINTS.AUTH.REGISTER;
    const payload = {
        email: (data.email ?? '').trim(),
        password: data.password ?? '',
        name: (data.firstName ?? '').trim(),
        lastName: (data.lastName ?? '').trim(),
        rol: toApiRol(data.role),
        phone: (data.phone ?? '').trim()
    };

    const res = await apiClient.post<any>(registerEndpoint, payload);

    // La API puede devolver el usuario o solo éxito; si hay id, mapear; si no, buscar en lista por email
    if (res && (res.id || res.email)) {
        return toUser(res);
    }
    const list = await fetchUsers();
    const created = list.find(u => u.email.toLowerCase() === (data.email ?? '').toLowerCase());
    if (created) return created;

    return {
        id: (res?.id ?? res?.userId ?? '').toString(),
        email: data.email ?? '',
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        phone: data.phone ?? '',
        role: (data.role ?? 'user') as 'admin' | 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    } as User;
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

/** Obtiene el perfil del usuario autenticado (GET /users/profile) */
export async function getProfile(): Promise<User | null> {
    try {
        const res = await apiClient.get<any>(E.GET_PROFILE);
        return res ? toUser(res) : null;
    } catch {
        return null;
    }
}

/** Actualiza el perfil del usuario autenticado (PUT /users/profile) */
export async function updateProfile(data: Partial<User> & { address?: string }): Promise<User> {
    const payload: any = {
        name: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        email: data.email?.trim(),
        phone: data.phone?.trim(),
        avatar: data.avatar
    };
    if ((data as any).address != null) payload.address = (data as any).address;
    const res = await apiClient.put<any>(E.UPDATE_PROFILE, payload);
    if (res) return toUser(res);
    const fetched = await getProfile();
    if (fetched) return fetched;
    return {
        id: '',
        email: data.email ?? '',
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
    } as User;
}

/** Cambia la contraseña (POST /auth/change-password). Misma lógica que en login/reset. */
export async function changePassword(params: {
    email: string;
    currentPassword: string;
    newPassword: string;
}): Promise<void> {
    const endpoint = API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD;
    const body = {
        email: params.email.trim(),
        currentPassword: params.currentPassword,
        newPassword: params.newPassword,
        Email: params.email.trim(),
        CurrentPassword: params.currentPassword,
        NewPassword: params.newPassword
    };
    await apiClient.post(endpoint, body);
}

/** Cambia la contraseña de un usuario por email (admin). Usa change-password con currentPassword vacío. */
export async function changePasswordByEmail(email: string, newPassword: string): Promise<void> {
    return changePassword({ email, currentPassword: '', newPassword });
}

export const usersApi = {
    fetchAll: fetchUsers,
    getById: fetchUserById,
    create: createUser,
    update: updateUser,
    deactivate: deactivateUser,
    getProfile,
    updateProfile,
    changePassword,
    changePasswordByEmail
};
