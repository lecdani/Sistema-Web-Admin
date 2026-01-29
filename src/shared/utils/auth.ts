/**
 * Utilidades para manejar la autenticación en localStorage
 * Adaptado según el ejemplo del usuario - guarda el usuario completo
 */

import { LoginResponse } from '@/shared/types/api';

const LOGGED_USER_KEY = 'LoggedOrderItAppUser';

/**
 * Obtiene el usuario autenticado del localStorage
 */
export function getLoggedUser(): LoginResponse | null {
  if (typeof window === 'undefined') return null;
  
  const userStr = localStorage.getItem(LOGGED_USER_KEY);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr) as LoginResponse;
  } catch {
    return null;
  }
}

/**
 * Guarda el usuario autenticado en localStorage (similar al ejemplo)
 * Guarda el objeto completo que viene del servidor
 */
export function setLoggedUser(user: LoginResponse): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOGGED_USER_KEY, JSON.stringify(user));
}

/**
 * Elimina el usuario autenticado del localStorage
 */
export function removeLoggedUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOGGED_USER_KEY);
}

/**
 * Obtiene el token de autenticación del usuario guardado
 */
export function getAuthToken(): string | null {
  const user = getLoggedUser();
  return user?.token || null;
}

/**
 * Verifica si el usuario está autenticado
 */
export function isAuthenticated(): boolean {
  return getLoggedUser() !== null;
}

/**
 * Limpia toda la información de autenticación
 */
export function clearAuth(): void {
  removeLoggedUser();
}
