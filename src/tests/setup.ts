import '@testing-library/jest-dom';

// Mock del localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock de console.log para tests más limpios
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock de window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    ...window.location,
    reload: jest.fn(),
  },
  writable: true,
});

// Mock de ResizeObserver (requerido para algunos componentes UI)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock básico de IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock para matchMedia (usado en componentes responsive)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock de HTMLElement.scrollIntoView
HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock de DOMRect para elementos que necesitan getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Mock de atob y btoa para los tests de autenticación
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));

// Configurar datos de prueba para localStorage antes de cada test
beforeEach(() => {
  // Limpiar mocks
  jest.clearAllMocks();
  localStorageMock.clear.mockClear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();

  // Configurar datos de usuarios de prueba - SOLO admin y user (vendedor)
  const mockUsers = [
    {
      id: '1',
      email: 'admin@empresa.com',
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: 'admin',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      email: 'vendedor@empresa.com',
      firstName: 'Vendedor',
      lastName: 'Prueba',
      role: 'user',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Mock de getItem para devolver usuarios cuando se solicite
  localStorageMock.getItem.mockImplementation((key) => {
    switch (key) {
      case 'app-users':
        return JSON.stringify(mockUsers);
      case 'app-sessions':
        return JSON.stringify([]);
      case 'app-settings':
        return JSON.stringify({
          id: 'app-settings',
          language: 'es',
          theme: 'light',
          notifications: true
        });
      default:
        return null;
    }
  });
});

// Configuración global para tests que requieren tiempo
jest.setTimeout(10000);

// Configuración para suprimir warnings específicos durante tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Helper para tests de navegación por roles - SOLO admin y user
export const mockUserRoles = {
  admin: {
    id: '1',
    email: 'admin@empresa.com',
    firstName: 'Administrador',
    lastName: 'Sistema',
    role: 'admin' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  user: {
    id: '2',
    email: 'vendedor@empresa.com',
    firstName: 'Vendedor',
    lastName: 'Prueba',
    role: 'user' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

// Helper para simular autenticación exitosa - SOLO admin y user
export const mockAuthState = (role: 'admin' | 'user') => ({
  user: mockUserRoles[role],
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: jest.fn().mockResolvedValue({ success: true, message: 'Login exitoso' }),
  register: jest.fn(),
  logout: jest.fn(),
  resetPassword: jest.fn(),
  clearError: jest.fn()
});