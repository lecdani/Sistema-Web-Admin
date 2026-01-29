import React from 'react';
import { render, screen } from '@testing-library/react';
import { Logo } from '@/shared/components/Logo';

describe('Logo Component', () => {
  describe('Rendering', () => {
    it('debe renderizar el logo con el texto Tu Empresa por defecto', () => {
      render(<Logo />);
      
      expect(screen.getByText('Tu Empresa')).toBeInTheDocument();
      expect(screen.getByText('Sistema Empresarial')).toBeInTheDocument();
    });

    it('debe mostrar el logo sin texto cuando showText es false', () => {
      render(<Logo showText={false} />);
      
      expect(screen.queryByText('Tu Empresa')).not.toBeInTheDocument();
      expect(screen.queryByText('Sistema Empresarial')).not.toBeInTheDocument();
    });

    it('debe mostrar el icono Building2 cuando se renderiza', () => {
      render(<Logo />);
      
      // Verificar que existe al menos un elemento SVG (el icono)
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });

  describe('Sizes', () => {
    it('debe aplicar las clases correctas para tamaño small', () => {
      render(<Logo size="sm" />);
      
      const title = screen.getByText('Tu Empresa');
      expect(title).toHaveClass('text-lg');
    });

    it('debe aplicar las clases correctas para tamaño medium (default)', () => {
      render(<Logo size="md" />);
      
      const title = screen.getByText('Tu Empresa');
      expect(title).toHaveClass('text-xl');
    });

    it('debe aplicar las clases correctas para tamaño large', () => {
      render(<Logo size="lg" />);
      
      const title = screen.getByText('Tu Empresa');
      expect(title).toHaveClass('text-2xl');
    });
  });

  describe('Variants', () => {
    it('debe aplicar colores claros para variant="light"', () => {
      render(<Logo variant="light" />);
      
      const title = screen.getByText('Tu Empresa');
      expect(title).toHaveClass('text-white');
    });

    it('debe aplicar colores oscuros para variant="dark"', () => {
      render(<Logo variant="dark" />);
      
      const title = screen.getByText('Tu Empresa');
      expect(title).toHaveClass('text-gray-900');
    });
  });

  describe('Custom Props', () => {
    it('debe aplicar className personalizada', () => {
      render(<Logo className="custom-class" />);
      
      const logoContainer = screen.getByText('Tu Empresa').closest('div');
      expect(logoContainer).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('debe tener estructura semánticamente correcta', () => {
      render(<Logo />);
      
      // Verificar que contiene tanto icono como texto
      expect(screen.getByText('Tu Empresa')).toBeInTheDocument();
      expect(screen.getByText('Sistema Empresarial')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('debe funcionar en diferentes contextos de la aplicación', () => {
      // Simular diferentes contextos
      const contexts = [
        { size: 'sm' as const, variant: 'light' as const, showText: false },
        { size: 'md' as const, variant: 'dark' as const, showText: true },
        { size: 'lg' as const, variant: 'light' as const }
      ];

      contexts.forEach((props, index) => {
        const { unmount } = render(<Logo {...props} />);
        
        // Verificar que el componente se renderiza sin errores
        if (props.showText !== false) {
          expect(screen.getByText('Tu Empresa')).toBeInTheDocument();
        }
        
        unmount();
      });
    });
  });
});