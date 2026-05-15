import { User, ApiResponse, type AuthSession } from '@/shared/types';
import type { LoginCredentials as ApiLoginCredentials } from '@/shared/types/api';

export type { AuthSession };

export interface LoginCredentials extends ApiLoginCredentials {
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface PasswordResetData {
  email: string;
}

/** Errores de validación por campo (formularios auth). */
export type ValidationErrors = Partial<Record<'email' | 'password' | 'confirmPassword' | 'firstName' | 'lastName', string>>;

export interface PasswordResetConfirmData {
  token: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type { User, ApiResponse };
