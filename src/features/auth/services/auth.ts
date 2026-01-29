import { User, LoginCredentials, RegisterData, PasswordResetData, PasswordResetConfirmData, AuthSession, ApiResponse } from '../types';
import { getFromLocalStorage, setToLocalStorage, getUserByEmail } from '@/shared/services/database';
import { apiClient, API_CONFIG } from '@/shared/config/api';
import { loginService } from '@/shared/services/apiService';
import { setLoggedUser } from '@/shared/utils/auth';

export class AuthService {
  private static instance: AuthService;
  private currentSession: AuthSession | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    return getUserByEmail(email);
  }

  private async addSession(session: AuthSession): Promise<void> {
    const sessions: AuthSession[] = getFromLocalStorage('app-sessions') || [];
    const newSessions = sessions.filter(s => s.userId !== session.userId);
    
    // Asegurar que la fecha se guarde correctamente
    const sessionToSave = {
      ...session,
      expiresAt: session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt)
    };
    
    newSessions.push(sessionToSave);
    setToLocalStorage('app-sessions', newSessions);
  }

  private async clearSessions(): Promise<void> {
    setToLocalStorage('app-sessions', []);
  }

  private async getLastSession(): Promise<AuthSession | null> {
    const sessions: AuthSession[] = getFromLocalStorage('app-sessions') || [];
    
    if (sessions.length === 0) {
      return null;
    }
    
    const lastSession = sessions[sessions.length - 1];
    
    // Convertir la fecha de string a Date object si es necesario
    if (lastSession && typeof lastSession.expiresAt === 'string') {
      lastSession.expiresAt = new Date(lastSession.expiresAt);
    }
    
    return lastSession;
  }

  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthSession>> {
    try {
      if (!credentials.email || !credentials.password) {
        return {
          success: false,
          message: 'Email y contraseña son requeridos'
        };
      }

      const response = await loginService.login({
        email: credentials.email,
        password: credentials.password
      });

      const userId = response.id || response.email;
      const user: User = {
        id: userId,
        email: response.email,
        firstName: response.name,
        lastName: response.lastName,
        role: response.role === 'user' ? 'user' : 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const users: User[] = getFromLocalStorage('app-users') || [];
      const idx = users.findIndex(u => u.id === user.id);
      if (idx >= 0) users[idx] = user;
      else users.push(user);
      setToLocalStorage('app-users', users);

      setLoggedUser(response);
      apiClient.setAuthToken(response.token);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const session: AuthSession = {
        token: response.token,
        userId: user.id,
        expiresAt
      };
      await this.addSession(session);
      this.currentSession = session;

      return {
        success: true,
        data: session,
        message: 'Inicio de sesión exitoso'
      };
    } catch (err: any) {
      const message =
        err?.response?.message ||
        err?.message ||
        'Contraseña o correo incorrectos. Verifica tus datos e intenta de nuevo.';
      return {
        success: false,
        message
      };
    }
  }

  async register(data: RegisterData): Promise<ApiResponse<User>> {
    try {
      const existingUser = await this.findUserByEmail(data.email);
      
      if (existingUser) {
        return {
          success: false,
          message: 'El correo electrónico ya está registrado'
        };
      }

      const newUser: User = {
        id: Date.now().toString(),
        email: data.email,
        password: data.password, // Guardar contraseña (en producción debería estar hasheada)
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const users: User[] = getFromLocalStorage('app-users') || [];
      users.push(newUser);
      setToLocalStorage('app-users', users);

      return {
        success: true,
        data: newUser,
        message: 'Usuario registrado exitosamente'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error interno del servidor'
      };
    }
  }

  async logout(): Promise<void> {
    try {
      // Limpiar token del cliente API
      apiClient.clearAuthToken();
      
      await this.clearSessions();
      this.currentSession = null;
    } catch (error) {
    }
  }

  /** Solicitar enlace de recuperación (API envía el correo con el link) */
  async resetPassword(data: PasswordResetData): Promise<ApiResponse> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, { email: data.email });
      return {
        success: true,
        message: 'Si el correo existe, recibirás un enlace de restablecimiento'
      };
    } catch (err: any) {
      const message = err?.data?.message ?? err?.message ?? 'Error al enviar el enlace. Intenta de nuevo.';
      return { success: false, message };
    }
  }

  /** Confirmar nueva contraseña desde el link del correo (token y email en la URL) */
  async confirmResetPassword(data: PasswordResetConfirmData): Promise<ApiResponse> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: data.token,
        email: data.email,
        newPassword: data.newPassword
      });
      return {
        success: true,
        message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.'
      };
    } catch (err: any) {
      const message = err?.data?.message ?? err?.message ?? 'El enlace pudo haber expirado. Solicita uno nuevo.';
      return { success: false, message };
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      if (this.currentSession) {
        // Verificar también la sesión en memoria
        const expiresAt = new Date(this.currentSession.expiresAt);
        if (new Date() > expiresAt) {
          await this.clearSessions();
          this.currentSession = null;
          apiClient.clearAuthToken();
          return null;
        }
        // Restaurar token en el cliente API
        apiClient.setAuthToken(this.currentSession.token);
        return this.currentSession;
      }

      const session = await this.getLastSession();
      
      if (!session) {
        return null;
      }

      // Asegurar que expiresAt es un objeto Date
      const expiresAt = new Date(session.expiresAt);
      session.expiresAt = expiresAt;

      // Verificar si la sesión ha expirado
      if (new Date() > expiresAt) {
        await this.clearSessions();
        apiClient.clearAuthToken();
        return null;
      }

      this.currentSession = session;
      // Restaurar token en el cliente API
      apiClient.setAuthToken(session.token);
      return session;
    } catch (error) {
      return null;
    }
  }

  async validateSession(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return session !== null;
  }

  async refreshSession(): Promise<void> {
    if (this.currentSession && this.currentSession.token) {
      const newExpiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
      this.currentSession.expiresAt = newExpiresAt;
      
      const sessions: AuthSession[] = getFromLocalStorage('app-sessions') || [];
      const updatedSessions = sessions.map(s => {
        if (s.userId === this.currentSession!.userId) {
          return { 
            ...s, 
            expiresAt: newExpiresAt 
          };
        }
        // Asegurar que las fechas existentes también sean objetos Date
        return {
          ...s,
          expiresAt: s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt)
        };
      });
      setToLocalStorage('app-sessions', updatedSessions);
    }
  }
}

export const authService = AuthService.getInstance();