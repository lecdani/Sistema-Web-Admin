import { User, ApiResponse } from '@/shared/types';
import type { LoginCredentials as ApiLoginCredentials } from '@/shared/types/api';

export interface AuthSession {
  token: string;
  userId: string;
  expiresAt: Date;
}

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

export interface PasswordResetConfirmData {
  token: string;
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
