'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginResponse, LoginCredentials } from '@/shared/types/api';
import { setLoggedUser } from '@/shared/utils/auth';
import { loginService } from '@/shared/services/apiService';

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

      // Guardar el usuario completo en localStorage
      // El objeto user contiene: token, email, name, lastName
      setLoggedUser(user);

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
