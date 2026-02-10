/**
 * Tipos para las respuestas de la API
 */

// Respuesta del login según el formato de la API .NET
export interface LoginResponse {
  token: string;
  email: string;
  name: string;
  lastName: string;
  role?: string; // Admin, Vendedor, etc.
  isActive?: boolean;
  id?: string;
}

// Datos del usuario autenticado
export interface AuthUser {
  email: string;
  name: string;
  lastName: string;
  token: string;
}

// Credenciales para el login
export interface LoginCredentials {
  email: string;
  password: string;
}
