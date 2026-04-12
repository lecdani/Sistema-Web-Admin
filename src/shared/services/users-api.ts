import { apiClient, API_CONFIG } from '@/shared/config/api';
import type { User } from '@/shared/types';

const E = API_CONFIG.ENDPOINTS.USERS;

function pickGuidish(v: unknown): string | undefined {
    if (v == null) return undefined;
    if (typeof v === 'string') {
        const t = v.trim();
        return t || undefined;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const inner = o.id ?? o.Id ?? o.value ?? o.Value;
        return pickGuidish(inner);
    }
    return undefined;
}

/** Extrae el id de ruta de ventas desde distintas formas típicas de la API .NET / JSON. */
function extractSalesRouteId(raw: any): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const flat = [
        raw.routeId,
        raw.RouteId,
        raw.routeID,
        raw.RouteID,
        raw.salesRouteId,
        raw.SalesRouteId,
        raw.salesRouteID,
        raw.SalesRouteID,
        raw.sales_route_id,
        raw.Sales_Route_Id,
        raw.assignedRouteId,
        raw.AssignedRouteId,
        raw.assigned_route_id,
    ];
    for (const x of flat) {
        const id = pickGuidish(x);
        if (id) return id;
    }
    const navs = [
        raw.route,
        raw.Route,
        raw.salesRoute,
        raw.SalesRoute,
        raw.userRoute,
        raw.UserRoute,
        raw.assignedRoute,
        raw.AssignedRoute,
    ];
    for (const n of navs) {
        const id = pickGuidish(n);
        if (id) return id;
    }
    return undefined;
}

function extractSalesRouteName(raw: any): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const direct = raw.salesRouteName ?? raw.SalesRouteName ?? raw.routeName ?? raw.RouteName;
    const s = typeof direct === 'string' ? direct.trim() : '';
    if (s) return s;
    const navs = [raw.salesRoute, raw.SalesRoute, raw.route, raw.Route, raw.assignedRoute, raw.AssignedRoute];
    for (const n of navs) {
        if (n && typeof n === 'object') {
            const name = String((n as any).name ?? (n as any).Name ?? '').trim();
            if (name) return name;
        }
    }
    return undefined;
}

function toUser(raw: any): User {
    const rawRole = String(raw.rol ?? raw.Rol ?? raw.role ?? raw.Role ?? 'user').toLowerCase();
    const role: 'admin' | 'user' = rawRole.startsWith('admin') ? 'admin' : 'user'; // cualquier otro (Vendedor, etc.) se trata como usuario normal

    const identityUserId =
        pickGuidish(
            raw.identityUserId ??
                raw.IdentityUserId ??
                raw.identity_user_id ??
                raw.Identity_User_Id ??
                raw.userId ??
                raw.UserId
        ) ?? undefined;

    return {
        id: String(raw.id ?? raw.Id ?? ''),
        identityUserId,
        email: String(raw.email ?? raw.Email ?? ''),
        firstName: String(raw.name ?? raw.Name ?? raw.firstName ?? raw.FirstName ?? ''),
        lastName: String(raw.lastName ?? raw.LastName ?? ''),
        phone: String(raw.phone ?? raw.Phone ?? ''),
        role,
        cityId: raw.cityId ?? raw.CityId ?? undefined,
        baseCityId:
          raw.baseCityId ??
          raw.BaseCityId ??
          raw.baseCityID ??
          raw.BaseCityID ??
          raw.base_city_id ??
          raw.BASE_CITY_ID ??
          raw?.baseCity?.id ??
          raw?.BaseCity?.id ??
          raw?.baseCity?.Id ??
          raw?.BaseCity?.Id ??
          undefined,
        baseCity: (() => {
          const bc = raw?.baseCity ?? raw?.BaseCity ?? null;
          if (!bc || typeof bc !== 'object') return undefined;
          const id = String((bc as any).id ?? (bc as any).Id ?? '').trim();
          const name = String((bc as any).name ?? (bc as any).Name ?? '').trim();
          const prefix = String((bc as any).prefix ?? (bc as any).Prefix ?? '').trim();
          if (!id && !name && !prefix) return undefined;
          return { id, name, prefix: prefix || undefined };
        })(),
        sellerCode: raw.sellerCode ?? raw.SellerCode ?? raw.seller_code ?? raw.SELLER_CODE ?? undefined,
        salesRouteId: extractSalesRouteId(raw),
        salesRouteName: extractSalesRouteName(raw),
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
        isActive: data.isActive,
    };

    if ((data as any).salesRouteId !== undefined) {
        const sr = String((data as any).salesRouteId ?? '').trim();
        payload.routeId = sr || null;
        payload.RouteId = sr || null;
        payload.salesRouteId = sr || null;
        payload.SalesRouteId = sr || null;
    }

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
    const list = Array.isArray(res)
        ? res
        : res?.data ?? res?.items ?? res?.value ?? res?.users ?? res?.Users ?? [];
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
        phone: (data.phone ?? '').trim(),
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

/** Actualiza un usuario (la contraseña no va en el PUT; usar `adminUpdateUserPassword` con el userId que devuelve el GET). */
export async function updateUser(id: string, data: Partial<User> & { password?: string }): Promise<User> {
    const { password: _omitPassword, ...rest } = data;
    const endpoint = E.UPDATE.replace('{id}', encodeURIComponent(id));
    const payload = { id, ...toPayload(rest) };

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

/** Asegura que el usuario refleje la ruta recién asignada aunque el GET no devuelva routeId. */
function userWithAssignedRoute(user: User, routeId: string | null): User {
    const rid = routeId && String(routeId).trim() ? String(routeId).trim() : null;
    return {
        ...user,
        salesRouteId: rid ?? undefined,
        salesRouteName: undefined,
    };
}

/**
 * Primera asignación, reasignación o quitar ruta: mismo PUT /users/users/{id}/assign-route
 * (mismo cuerpo y flujo; el id va en la URL y, por compatibilidad DTO, también en el JSON).
 */
export async function assignUserRoute(userId: string, routeId: string | null): Promise<User> {
    const uid = String(userId || '').trim();
    const rid = routeId && String(routeId).trim() ? String(routeId).trim() : null;
    const endpoint = E.ASSIGN_ROUTE.replace('{id}', encodeURIComponent(uid));
    const body = {
        userId: uid,
        UserId: uid,
        routeId: rid,
        RouteId: rid,
        salesRouteId: rid,
        SalesRouteId: rid,
    };
    const res = await apiClient.put<any>(endpoint, body);

    const looksLikeUser =
        res &&
        typeof res === 'object' &&
        (pickGuidish(res.id ?? res.Id) || String(res.email ?? res.Email ?? '').trim());

    if (looksLikeUser) {
        return userWithAssignedRoute(toUser(res), rid);
    }

    const fetched = await fetchUserById(uid);
    if (fetched) return userWithAssignedRoute(fetched, rid);
    throw new Error('assign-route: could not load user after assign');
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

/** Admin: POST /auth/admin/update-user-password — cuerpo `{ userId, newPassword }`. */
export async function adminUpdateUserPassword(userId: string, newPassword: string): Promise<void> {
    const uid = String(userId ?? '').trim();
    const pw = String(newPassword ?? '');
    const endpoint = API_CONFIG.ENDPOINTS.AUTH.UPDATE_USER_PASSWORD;
    await apiClient.post(endpoint, {
        userId: uid,
        newPassword: pw,
    });
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
    assignRoute: assignUserRoute,
    deactivate: deactivateUser,
    getProfile,
    updateProfile,
    changePassword,
    changePasswordByEmail,
    adminUpdateUserPassword
};
