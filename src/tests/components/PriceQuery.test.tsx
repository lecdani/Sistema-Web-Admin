import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductManagement } from '@/features/admin/products/ProductManagement';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';

// Mock de las dependencias
jest.mock('../../features/auth/hooks/useAuth');
jest.mock('../../shared/services/database');
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetFromLocalStorage = getFromLocalStorage as jest.MockedFunction<typeof getFromLocalStorage>;
const mockSetToLocalStorage = setToLocalStorage as jest.MockedFunction<typeof setToLocalStorage>;

describe('Price Query Functionality', () => {
  const mockUser = {
    id: '1',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin' as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockProducts = [
    {
      id: 'prod-1',
      sku: 'TEST-001',
      name: 'Producto Test',
      category: 'Electrónicos',
      description: 'Producto de prueba',
      currentPrice: 150.00,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15')
    }
  ];

  const mockPriceHistory = [
    {
      id: 'price-1',
      productId: 'prod-1',
      price: 100.00,
      effectiveDate: new Date('2024-01-01'),
      reason: 'Precio inicial',
      createdBy: '1',
      createdAt: new Date('2024-01-01')
    },
    {
      id: 'price-2',
      productId: 'prod-1',
      price: 120.00,
      effectiveDate: new Date('2024-01-10'),
      reason: 'Ajuste por inflación',
      createdBy: '1',
      createdAt: new Date('2024-01-10')
    },
    {
      id: 'price-3',
      productId: 'prod-1',
      price: 150.00,
      effectiveDate: new Date('2024-01-15'),
      reason: 'Actualización de mercado',
      createdBy: '1',
      createdAt: new Date('2024-01-15')
    }
  ];

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn()
    });

    mockGetFromLocalStorage.mockImplementation((key: string) => {
      if (key === 'app-products') return mockProducts;
      if (key === 'app-price-histories') return mockPriceHistory;
      if (key === 'app-distributions') return [];
      return [];
    });

    mockSetToLocalStorage.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should render price query button with tooltip', async () => {
    render(<ProductManagement onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
    });

    // Buscar el botón de consulta por fecha (ícono Clock)
    const clockButtons = screen.getAllByRole('button');
    const priceQueryButton = clockButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-clock')
    );

    expect(priceQueryButton).toBeInTheDocument();
  });

  test('should show price query dialog when clock button is clicked', async () => {
    render(<ProductManagement onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
    });

    // Hacer clic en el botón de consulta por fecha
    const clockButtons = screen.getAllByRole('button');
    const priceQueryButton = clockButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-clock')
    );

    fireEvent.click(priceQueryButton!);

    await waitFor(() => {
      expect(screen.getByText('Consultar Precio por Fecha')).toBeInTheDocument();
      expect(screen.getByText('Consulta el precio de "Producto Test" en una fecha específica')).toBeInTheDocument();
    });
  });

  test('should require date input before querying', async () => {
    render(<ProductManagement onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
    });

    // Abrir el dialog de consulta
    const clockButtons = screen.getAllByRole('button');
    const priceQueryButton = clockButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-clock')
    );
    fireEvent.click(priceQueryButton!);

    await waitFor(() => {
      expect(screen.getByText('Consultar Precio por Fecha')).toBeInTheDocument();
    });

    // El botón de consultar debe estar deshabilitado inicialmente
    const consultarButton = screen.getByRole('button', { name: /consultar/i });
    expect(consultarButton).toBeDisabled();
  });

  test('should enable consult button when date is selected', async () => {
    render(<ProductManagement onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
    });

    // Abrir el dialog de consulta
    const clockButtons = screen.getAllByRole('button');
    const priceQueryButton = clockButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-clock')
    );
    fireEvent.click(priceQueryButton!);

    await waitFor(() => {
      expect(screen.getByText('Consultar Precio por Fecha')).toBeInTheDocument();
    });

    // Seleccionar una fecha
    const dateInput = screen.getByLabelText(/fecha de consulta/i);
    fireEvent.change(dateInput, { target: { value: '2024-01-12' } });

    // El botón debe habilitarse
    const consultarButton = screen.getByRole('button', { name: /consultar/i });
    expect(consultarButton).not.toBeDisabled();
  });

  test('should display correct price for selected date', async () => {
    render(<ProductManagement onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
    });

    // Abrir el dialog de consulta
    const clockButtons = screen.getAllByRole('button');
    const priceQueryButton = clockButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-clock')
    );
    fireEvent.click(priceQueryButton!);

    await waitFor(() => {
      expect(screen.getByText('Consultar Precio por Fecha')).toBeInTheDocument();
    });

    // Seleccionar fecha del 12 de enero (entre el segundo y tercer precio)
    const dateInput = screen.getByLabelText(/fecha de consulta/i);
    fireEvent.change(dateInput, { target: { value: '2024-01-12' } });

    // Hacer clic en consultar
    const consultarButton = screen.getByRole('button', { name: /consultar/i });
    fireEvent.click(consultarButton);

    await waitFor(() => {
      // Debe mostrar el precio de 120.00 que estaba vigente el 10 de enero
      expect(screen.getByText('$120,00')).toBeInTheDocument();
      expect(screen.getByText('Ajuste por inflación')).toBeInTheDocument();
    });
  });

  test('should display earliest price for date before first price', async () => {
    render(<ProductManagement onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Producto Test')).toBeInTheDocument();
    });

    // Abrir el dialog de consulta
    const clockButtons = screen.getAllByRole('button');
    const priceQueryButton = clockButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-clock')
    );
    fireEvent.click(priceQueryButton!);

    await waitFor(() => {
      expect(screen.getByText('Consultar Precio por Fecha')).toBeInTheDocument();
    });

    // Seleccionar fecha del 5 de enero (después del primer precio)
    const dateInput = screen.getByLabelText(/fecha de consulta/i);
    fireEvent.change(dateInput, { target: { value: '2024-01-05' } });

    // Hacer clic en consultar
    const consultarButton = screen.getByRole('button', { name: /consultar/i });
    fireEvent.click(consultarButton);

    await waitFor(() => {
      // Debe mostrar el precio inicial de 100.00
      expect(screen.getByText('$100,00')).toBeInTheDocument();
      expect(screen.getByText('Precio inicial')).toBeInTheDocument();
    });
  });
});