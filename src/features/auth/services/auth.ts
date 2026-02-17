import { User, LoginCredentials, RegisterData, PasswordResetData, PasswordResetConfirmData, AuthSession, ApiResponse } from '../types';
import { getFromLocalStorage, setToLocalStorage, getUserByEmail } from '@/shared/services/database';
import { apiClient, API_CONFIG } from '@/shared/config/api';
import { loginService } from '@/shared/services/apiService';
import { setLoggedUser } from '@/shared/utils/auth';
import { fetchUserById, fetchUsers } from '@/shared/services/users-api';

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

      // Verificar rol y estado activo desde GET /users (BD = fuente de verdad; si editaron admin→vendedor, se niega)
      const token = (response as any).token;
      let fullUser: User | null = null;
      if (token) apiClient.setAuthToken(token);
      try {
        let userId: string | undefined = (response as any).id ?? (response as any).Id ?? (response as any).email;
        if (!userId && (response as any).email) {
          const list = await fetchUsers();
          const byEmail = list.find((u) => (u.email || '').toLowerCase() === ((response as any).email || '').toLowerCase());
          userId = byEmail?.id;
        }
        if (!userId) {
          if (token) apiClient.clearAuthToken();
          return { success: false, message: 'No se pudo verificar el estado de la cuenta.' };
        }
        fullUser = await fetchUserById(userId);
        if (!fullUser) {
          if (token) apiClient.clearAuthToken();
          return { success: false, message: 'No se pudo verificar el estado de la cuenta.' };
        }
        if (fullUser.role !== 'admin') {
          if (token) apiClient.clearAuthToken();
          return { success: false, message: 'No posee cuenta de administrador.' };
        }
        if (fullUser.isActive === false) {
          if (token) apiClient.clearAuthToken();
          return { success: false, message: 'Su cuenta de administrador está inactiva. Contacte al administrador del sistema.' };
        }
      } finally {
        if (token) apiClient.clearAuthToken();
      }

      const userId = response.id || response.email;
      const user: User = {
        id: userId,
        email: response.email,
        firstName: response.name,
        lastName: response.lastName,
        phone: fullUser?.phone ?? (response as any).phone ?? '',
        avatar: fullUser?.avatar ?? (response as any).avatar,
        role: 'admin',
        isActive: true,
        createdAt: fullUser?.createdAt ?? new Date(),
        updatedAt: fullUser?.updatedAt ?? new Date()
      };

      const users: User[] = getFromLocalStorage('app-users') || [];
      const idx = users.findIndex(u => u.id === user.id);
      if (idx >= 0) users[idx] = user;
      else users.push(user);
      setToLocalStorage('app-users', users);

      setLoggedUser({
        ...response,
        role: 'admin',
        Role: 'Admin',
        isActive: true,
        IsActive: true,
        phone: fullUser?.phone ?? (response as any).phone,
        avatar: fullUser?.avatar ?? (response as any).avatar
      });
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

  /** Registro de usuario vía API POST /auth/register (email, password, name, lastName, rol, phone) */
  async register(data: RegisterData): Promise<ApiResponse<User>> {
    try {
      const payload = {
        email: data.email.trim(),
        password: data.password,
        name: data.firstName.trim(),
        lastName: data.lastName.trim(),
        // En el registro público, los usuarios son Vendedores por defecto
        rol: 'Vendedor',
        phone: (data as any).phone ?? ''
      };

      const res = await apiClient.post<any>(API_CONFIG.ENDPOINTS.AUTH.REGISTER, payload);

      const raw = res?.data ?? res;
      const newUser: User = {
        id: raw?.id ?? raw?.userId ?? Date.now().toString(),
        email: raw?.email ?? data.email,
        firstName: raw?.firstName ?? raw?.name ?? data.firstName,
        lastName: raw?.lastName ?? data.lastName,
        role: (raw?.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        isActive: raw?.isActive ?? true,
        createdAt: raw?.createdAt ? new Date(raw.createdAt) : new Date(),
        updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : new Date()
      };

      const users: User[] = getFromLocalStorage('app-users') || [];
      const idx = users.findIndex(u => u.id === newUser.id || u.email === newUser.email);
      if (idx >= 0) users[idx] = newUser;
      else users.push(newUser);
      setToLocalStorage('app-users', users);

      return {
        success: true,
        data: newUser,
        message: res?.message ?? 'Usuario registrado exitosamente'
      };
    } catch (err: any) {
      const message =
        err?.data?.message ??
        err?.data?.errors?.join?.(' ') ??
        err?.message ??
        'Error al registrar. Verifica los datos e intenta de nuevo.';
      return {
        success: false,
        message
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
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: data.email,
        AppType: 'Admin'
      });
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