import { useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, RegisterData, PasswordResetData, PasswordResetConfirmData, AuthSession, ApiResponse } from '../types';
import { authService } from '../services/auth';
import { getFromLocalStorage } from '@/shared/services/database';
import { getLoggedUser, removeLoggedUser } from '@/shared/utils/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/** Convierte el usuario de la API (LoggedOrderItAppUser) al formato User de la app */
function loggedUserToUser(logged: { email: string; name: string; lastName: string; token: string; role?: string; id?: string }): User {
  return {
    id: logged.id || logged.email,
    email: logged.email,
    firstName: logged.name,
    lastName: logged.lastName,
    role: (logged.role === 'user' ? 'user' : 'admin') as 'admin' | 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Verificar sesión actual al montar el componente
  useEffect(() => {
    const checkSession = async () => {
      try {
        // 1) Prioridad: usuario logueado por la API (LoggedOrderItAppUser)
        const loggedUser = getLoggedUser();
        if (loggedUser) {
          const user = loggedUserToUser(loggedUser);
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          return;
        }

        // 2) Fallback: sesión antigua (app-sessions + app-users)
        const users: User[] = getFromLocalStorage('app-users') || [];
        if (users.length === 0) {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
          return;
        }
        
        const session = await authService.getCurrentSession();
        if (session) {
          const user = users.find(u => u.id === session.userId) || null;
          if (user) {
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            await authService.logout();
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });
          }
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Error al verificar la sesión'
        });
      }
    };

    checkSession();
  }, []);

  // Función de login
  const login = useCallback(async (credentials: LoginCredentials): Promise<ApiResponse<AuthSession>> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await authService.login(credentials);
      
      if (result.success && result.data) {
        // Obtener datos del usuario
        const users: User[] = getFromLocalStorage('app-users') || [];
        const user = users.find(u => u.id === result.data!.userId) || null;
        
        if (user) {
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Usuario no encontrado'
          });
        }
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: result.message || 'Error en el login'
        }));
      }
      
      return result;
    } catch (error) {
      const errorMessage = 'Error interno del servidor';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }, []);

  // Función de registro
  const register = useCallback(async (data: RegisterData): Promise<ApiResponse<User>> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await authService.register(data);
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: result.success ? null : result.message || 'Error en el registro'
      }));
      
      return result;
    } catch (error) {
      const errorMessage = 'Error interno del servidor';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }, []);

  // Función de logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      removeLoggedUser();
      await authService.logout();
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    } catch (error) {
    }
  }, []);

  // Función de reset password (solicitar enlace al correo)
  const resetPassword = useCallback(async (data: PasswordResetData): Promise<ApiResponse> => {
    try {
      return await authService.resetPassword(data);
    } catch (error) {
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }, []);

  // Confirmar nueva contraseña (desde el link del correo)
  const confirmResetPassword = useCallback(async (data: PasswordResetConfirmData): Promise<ApiResponse> => {
    try {
      return await authService.confirmResetPassword(data);
    } catch (error) {
      return {
        success: false,
        message: 'Error al restablecer la contraseña'
      };
    }
  }, []);

  // Función para refrescar la sesión
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await authService.refreshSession();
    } catch (error) {
    }
  }, []);

  return {
    ...authState,
    login,
    register,
    logout,
    resetPassword,
    confirmResetPassword,
    refreshSession
  };
}