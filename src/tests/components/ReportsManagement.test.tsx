import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportsManagement } from '@/features/admin/reports/ReportsManagement';

// Mock del hook useLanguage
jest.mock('../../shared/hooks/useLanguage', () => ({
  useLanguage: () => ({
    translate: (key: string) => key,
    currentLanguage: 'es'
  })
}));

// Mock del servicio de base de datos
jest.mock('../../shared/services/database', () => ({
  getFromLocalStorage: jest.fn((key: string) => {
    const mockData = {
      'app-products': [
        { id: 'prod1', name: 'Producto 1', category: 'Electrónicos' },
        { id: 'prod2', name: 'Producto 2', category: 'Hogar' }
      ],
      'app-stores': [
        { id: 'store1', name: 'Tienda Madrid', cityId: 'city1' },
        { id: 'store2', name: 'Tienda Barcelona', cityId: 'city2' }
      ],
      'app-cities': [
        { id: 'city1', name: 'Madrid' },
        { id: 'city2', name: 'Barcelona' }
      ],
      'app-bill-headers': [
        {
          billHeaderSerial: 'BILL-001',
          storeId: 'store1',
          total: 1000,
          createdAt: '2024-01-15'
        }
      ],
      'app-bill-details': [
        {
          billDetailId: 'BD-001',
          billHeaderId: 'BILL-001',
          productId: 'prod1',
          quantity: 5,
          unitPrice: 200,
          subtotal: 1000
        }
      ],
      'app-order-headers': [],
      'app-order-details': []
    };
    return mockData[key as keyof typeof mockData] || [];
  })
}));

describe('ReportsManagement', () => {
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders reports management page', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Reportes de Ventas')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Análisis detallado del desempeño comercial')).toBeInTheDocument();
  });

  test('displays back button and calls onBack when clicked', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      const backButton = screen.getByText('Volver al Dashboard');
      expect(backButton).toBeInTheDocument();
      
      fireEvent.click(backButton);
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  test('shows filter controls', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Filtros de Reporte')).toBeInTheDocument();
    });
    
    expect(screen.getByLabelText('Fecha Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha Hasta')).toBeInTheDocument();
    expect(screen.getByText('Todos los productos')).toBeInTheDocument();
    expect(screen.getByText('Todas las tiendas')).toBeInTheDocument();
    expect(screen.getByText('Todas las ciudades')).toBeInTheDocument();
  });

  test('displays sales metrics cards', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ventas Totales')).toBeInTheDocument();
      expect(screen.getByText('Cantidad Vendida')).toBeInTheDocument();
      expect(screen.getByText('Ticket Promedio')).toBeInTheDocument();
      expect(screen.getByText('Transacciones')).toBeInTheDocument();
    });
  });

  test('shows export buttons', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Exportar PDF')).toBeInTheDocument();
      expect(screen.getByText('Exportar Excel')).toBeInTheDocument();
    });
  });

  test('displays report tabs', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Resumen')).toBeInTheDocument();
      expect(screen.getByText('Productos')).toBeInTheDocument();
      expect(screen.getByText('Tiendas')).toBeInTheDocument();
      expect(screen.getByText('Tendencias')).toBeInTheDocument();
    });
  });

  test('opens custom report dialog', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      const customReportButton = screen.getByText('Reporte Personalizado');
      fireEvent.click(customReportButton);
    });
    
    expect(screen.getByText('Crear Reporte Personalizado')).toBeInTheDocument();
    expect(screen.getByText('Configura un reporte con métricas específicas según tus necesidades')).toBeInTheDocument();
  });

  test('can clear filters', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      const clearButton = screen.getByText('Limpiar');
      expect(clearButton).toBeInTheDocument();
      
      fireEvent.click(clearButton);
      // Verificar que los filtros se limpiaron
    });
  });

  test('can refresh data', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      const refreshButton = screen.getByText('Actualizar');
      expect(refreshButton).toBeInTheDocument();
      
      fireEvent.click(refreshButton);
      // Verificar que los datos se recargaron
    });
  });

  test('tab navigation works correctly', async () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      const productsTab = screen.getByText('Productos');
      fireEvent.click(productsTab);
      
      expect(screen.getByText('Análisis por Productos')).toBeInTheDocument();
    });

    const storesTab = screen.getByText('Tiendas');
    fireEvent.click(storesTab);
    
    expect(screen.getByText('Análisis por Tiendas')).toBeInTheDocument();

    const trendsTab = screen.getByText('Tendencias');
    fireEvent.click(trendsTab);
    
    expect(screen.getByText('Tendencias de Ventas')).toBeInTheDocument();
  });

  test('displays loading state initially', () => {
    render(<ReportsManagement onBack={mockOnBack} />);
    
    expect(screen.getByText('Cargando datos de reportes...')).toBeInTheDocument();
  });

  test('export functions are triggered correctly', async () => {
    // Mock para URL.createObjectURL
    const mockCreateObjectURL = jest.fn(() => 'mock-url');
    const mockRevokeObjectURL = jest.fn();
    
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: mockCreateObjectURL,
    });
    
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: mockRevokeObjectURL,
    });

    // Mock para createElement
    const mockElement = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    
    const mockCreateElement = jest.fn(() => mockElement);
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();
    
    Object.defineProperty(document, 'createElement', {
      value: mockCreateElement,
    });
    
    Object.defineProperty(document.body, 'appendChild', {
      value: mockAppendChild,
    });
    
    Object.defineProperty(document.body, 'removeChild', {
      value: mockRemoveChild,
    });

    render(<ReportsManagement onBack={mockOnBack} />);
    
    await waitFor(() => {
      const pdfButton = screen.getByText('Exportar PDF');
      fireEvent.click(pdfButton);
      
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockElement.click).toHaveBeenCalled();
    });

    await waitFor(() => {
      const excelButton = screen.getByText('Exportar Excel');
      fireEvent.click(excelButton);
      
      expect(mockElement.click).toHaveBeenCalledTimes(2);
    });
  });
});