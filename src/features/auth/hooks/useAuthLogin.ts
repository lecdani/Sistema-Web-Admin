'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginResponse, LoginCredentials } from '@/shared/types/api';
import { setLoggedUser } from '@/shared/utils/auth';
import { loginService } from '@/shared/services/apiService';
import { apiClient } from '@/shared/config/api';
import { fetchUserById, fetchUsers } from '@/shared/services/users-api';

/** Verifica en la API (BD) que el usuario sea admin y esté activo. Rol desde BD = fuente de verdad (si lo editaron a vendedor, se niega). */
async function checkUserActiveFromApi(loginUser: any): Promise<{ allowed: boolean; error?: string }> {
  const token = loginUser?.token ?? loginUser?.Token;
  if (!token || typeof token !== 'string') return { allowed: false, error: 'Sesión no válida.' };
  apiClient.setAuthToken(token);
  try {
    let userId: string | undefined = loginUser?.id ?? loginUser?.Id;
    if (!userId && loginUser?.email) {
      const list = await fetchUsers();
      const byEmail = list.find((u) => (u.email || '').toLowerCase() === (loginUser.email || '').toLowerCase());
      userId = byEmail?.id;
    }
    if (!userId) {
      return { allowed: false, error: 'No se pudo verificar el estado de la cuenta.' };
    }
    const fullUser = await fetchUserById(userId);
    if (!fullUser) {
      return { allowed: false, error: 'No se pudo verificar el estado de la cuenta.' };
    }
    if (fullUser.role !== 'admin') {
      return { allowed: false, error: 'No posee cuenta de administrador.' };
    }
    if (fullUser.isActive === false) {
      return { allowed: false, error: 'Su cuenta de administrador está inactiva. Contacte al administrador del sistema.' };
    }
    return { allowed: true };
  } finally {
    apiClient.clearAuthToken();
  }
}

/**
 * Hook de login (feature auth).
 * Usa loginService, guarda usuario en localStorage y redirige a /dashboard.
 */
export function useAuthLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      // Validación básica
      if (!credentials.email || !credentials.password) {
        throw new Error('Email y contraseña son requeridos');
      }

      // Ejecutar la petición usando el servicio
      const user = await loginService.login({
        email: credentials.email,
        password: credentials.password,
      });

      // Verificar rol y estado activo desde la API (GET /users) — BD = fuente de verdad (si editaron admin→vendedor, se niega)
      const activeCheck = await checkUserActiveFromApi(user);
      if (!activeCheck.allowed) {
        setLoading(false);
        setError(activeCheck.error ?? 'No posee cuenta de administrador.');
        return { success: false, error: activeCheck.error ?? 'No posee cuenta de administrador.' };
      }

      apiClient.setAuthToken(user?.token ?? user?.Token ?? '');

      // Obtener usuario completo (phone, avatar) para guardarlo en sesión y que se muestre en Perfil
      let userId: string | undefined = user?.id ?? user?.Id;
      if (!userId && user?.email) {
        const list = await fetchUsers();
        const byEmail = list.find((u) => (u.email || '').toLowerCase() === (user.email || '').toLowerCase());
        userId = byEmail?.id;
      }
      let fullUser: Awaited<ReturnType<typeof fetchUserById>> = null;
      if (userId) fullUser = await fetchUserById(userId);

      // Guardar el usuario en localStorage (incluir phone y avatar para Perfil y useAuth)
      const userToStore = {
        ...user,
        role: 'admin',
        Role: 'Admin',
        isActive: true,
        IsActive: true,
        phone: fullUser?.phone ?? (user as any).phone,
        avatar: fullUser?.avatar ?? (user as any).avatar,
      };
      setLoggedUser(userToStore);

      // Redirigir al dashboard
      router.push('/dashboard');

      setLoading(false);
      return {
        success: true,
        data: user,
      };
    } catch (err: any) {
      setLoading(false);
      
      // Extraer el mensaje de error de diferentes formas posibles
      let errorMessage = 'Error al iniciar sesión';
      if (err?.response) {
        if (err.response.status === 400 || err.response.status === 401) {
          errorMessage = err.response.data?.message || err.response.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.';
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.message) {
          errorMessage = err.response.message;
        } else {
          errorMessage = `Error del servidor (${err.response.status})`;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [router]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    login,
    loading,
    error,
    clearError,
  };
}
