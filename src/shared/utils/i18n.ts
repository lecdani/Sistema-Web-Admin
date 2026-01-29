import { Language } from '../types';

export const translations = {
  es: {
    // Navegación y general
    welcome: 'Bienvenido',
    login: 'Iniciar Sesión',
    logout: 'Cerrar Sesión',
    register: 'Registrarse',
    forgotPassword: 'Olvidé mi contraseña',
    resetPassword: 'Restablecer contraseña',
    backToLogin: 'Volver al inicio de sesión',
    continue: 'Continuar',
    cancel: 'Cancelar',
    save: 'Guardar',
    edit: 'Editar',
    delete: 'Eliminar',
    search: 'Buscar',
    loading: 'Cargando...',
    
    // Formularios
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    firstName: 'Nombre',
    lastName: 'Apellido',
    rememberMe: 'Recordarme',
    
    // Mensajes
    loginSuccess: 'Inicio de sesión exitoso',
    loginError: 'Credenciales incorrectas',
    logoutSuccess: 'Sesión cerrada correctamente',
    passwordResetSent: 'Se ha enviado un enlace de restablecimiento a su correo',
    passwordResetSuccess: 'Contraseña restablecida correctamente',
    registrationSuccess: 'Registro completado exitosamente',
    
    // Validaciones
    emailRequired: 'El correo electrónico es obligatorio',
    emailInvalid: 'Ingrese un correo electrónico válido',
    passwordRequired: 'La contraseña es obligatoria',
    passwordMinLength: 'La contraseña debe tener al menos 8 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
    firstNameRequired: 'El nombre es obligatorio',
    lastNameRequired: 'El apellido es obligatorio',
    
    // Portal administrativo
    dashboard: 'Panel de Control',
    users: 'Usuarios',
    settings: 'Configuración',
    profile: 'Perfil',
    statistics: 'Estadísticas',
    systemHealth: 'Estado del Sistema',
    totalUsers: 'Total de Usuarios',
    activeUsers: 'Usuarios Activos',
    totalSessions: 'Sesiones Totales',
    recentActivity: 'Actividad Reciente',
    userManagement: 'Gestión de Usuarios',
    storeManagement: 'Gestión de Tiendas',
    invoiceManagement: 'Gestión de Facturas',
    orderManagement: 'Gestión de Pedidos',
    podManagement: 'Gestión de PODs',
    cityManagement: 'Gestión de Ciudades',
    productManagement: 'Gestión de Productos',
    planogramManagement: 'Gestión de Planogramas',
    
    // Estados del sistema
    healthy: 'Saludable',
    warning: 'Advertencia',
    critical: 'Crítico',
    
    // Empresa
    companyName: 'Tu Empresa',
    companyTagline: 'Transformando el futuro de los negocios digitales',
    companyDescription: 'Plataforma integral para la gestión empresarial',
    advancedSecurity: 'Seguridad empresarial avanzada',
    anyDeviceAccess: 'Acceso desde cualquier dispositivo',
    support247: 'Soporte 24/7 especializado',
    
    // Roles
    admin: 'Administrador',
    user: 'Usuario',
    moderator: 'Moderador',
    
    // Idiomas
    language: 'Idioma',
    spanish: 'Español',
    english: 'English'
  },
  en: {
    // Navigation and general
    welcome: 'Welcome',
    login: 'Sign In',
    logout: 'Sign Out',
    register: 'Sign Up',
    forgotPassword: 'Forgot password',
    resetPassword: 'Reset password',
    backToLogin: 'Back to sign in',
    continue: 'Continue',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search',
    loading: 'Loading...',
    
    // Forms
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
    firstName: 'First name',
    lastName: 'Last name',
    rememberMe: 'Remember me',
    
    // Messages
    loginSuccess: 'Successfully signed in',
    loginError: 'Invalid credentials',
    logoutSuccess: 'Successfully signed out',
    passwordResetSent: 'A reset link has been sent to your email',
    passwordResetSuccess: 'Password reset successfully',
    registrationSuccess: 'Registration completed successfully',
    
    // Validations
    emailRequired: 'Email address is required',
    emailInvalid: 'Please enter a valid email address',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    
    // Admin portal
    dashboard: 'Dashboard',
    users: 'Users',
    settings: 'Settings',
    profile: 'Profile',
    statistics: 'Statistics',
    systemHealth: 'System Health',
    totalUsers: 'Total Users',
    activeUsers: 'Active Users',
    totalSessions: 'Total Sessions',
    recentActivity: 'Recent Activity',
    userManagement: 'User Management',
    storeManagement: 'Store Management',
    invoiceManagement: 'Invoice Management',
    orderManagement: 'Order Management',
    podManagement: 'POD Management',
    cityManagement: 'City Management',
    productManagement: 'Product Management',
    planogramManagement: 'Planogram Management',
    
    // System states
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    
    // Company
    companyName: 'Your Company',
    companyTagline: 'Transforming the future of digital business',
    companyDescription: 'Comprehensive platform for business management',
    advancedSecurity: 'Advanced enterprise security',
    anyDeviceAccess: 'Access from any device',
    support247: 'Specialized 24/7 support',
    
    // Roles
    admin: 'Administrator',
    user: 'User',
    moderator: 'Moderator',
    
    // Languages
    language: 'Language',
    spanish: 'Español',
    english: 'English'
  }
};

export const getTranslation = (key: string, language: Language): string => {
  const keys = key.split('.');
  let translation: any = translations[language];
  
  for (const k of keys) {
    translation = translation?.[k];
  }
  
  return translation || key;
};

export const t = (key: string, language: Language): string => {
  return getTranslation(key, language);
};