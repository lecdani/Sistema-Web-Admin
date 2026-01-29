import { test, expect } from '@playwright/test';

test.describe('Reports Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar a la aplicación
    await page.goto('http://localhost:3000/');
    
    // Hacer login como administrador
    await page.fill('input[type="email"]', 'admin@empresa.com');
    await page.fill('input[type="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    
    // Esperar a que cargue el dashboard
    await page.waitForSelector('text=¡Bienvenido, Administrador!');
  });

  test('should navigate to reports module from dashboard', async ({ page }) => {
    // Hacer clic en la tarjeta de reportes
    await page.click('text=Reportes de Ventas');
    
    // Verificar que estamos en la página de reportes
    await expect(page.locator('h1')).toContainText('Reportes de Ventas');
    await expect(page.locator('text=Análisis detallado del desempeño comercial')).toBeVisible();
  });

  test('should display sales metrics cards', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Verificar que las métricas están visibles
    await expect(page.locator('text=Ventas Totales')).toBeVisible();
    await expect(page.locator('text=Cantidad Vendida')).toBeVisible();
    await expect(page.locator('text=Ticket Promedio')).toBeVisible();
    await expect(page.locator('text=Transacciones')).toBeVisible();
  });

  test('should show and use filter controls', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Verificar filtros
    await expect(page.locator('text=Filtros de Reporte')).toBeVisible();
    await expect(page.locator('label:has-text("Fecha Desde")')).toBeVisible();
    await expect(page.locator('label:has-text("Fecha Hasta")')).toBeVisible();
    
    // Interactuar con filtros
    await page.fill('input[type="date"]', '2024-01-01');
    
    // Verificar que el botón limpiar funciona
    await page.click('text=Limpiar');
  });

  test('should navigate between report tabs', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Verificar tab por defecto (Resumen)
    await expect(page.locator('text=Ventas por Mes')).toBeVisible();
    
    // Navegar a tab de Productos
    await page.click('text=Productos');
    await expect(page.locator('text=Análisis por Productos')).toBeVisible();
    
    // Navegar a tab de Tiendas
    await page.click('text=Tiendas');
    await expect(page.locator('text=Análisis por Tiendas')).toBeVisible();
    
    // Navegar a tab de Tendencias
    await page.click('text=Tendencias');
    await expect(page.locator('text=Tendencias de Ventas')).toBeVisible();
  });

  test('should display charts and visualizations', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Verificar que los gráficos se cargan
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
    await expect(page.locator('text=Distribución por Ciudad')).toBeVisible();
  });

  test('should show export options', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Verificar botones de exportación
    await expect(page.locator('text=Exportar PDF')).toBeVisible();
    await expect(page.locator('text=Exportar Excel')).toBeVisible();
    
    // Verificar que los botones son clickeables
    await page.click('text=Exportar PDF');
    await page.click('text=Exportar Excel');
  });

  test('should open custom report dialog', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Hacer clic en reporte personalizado
    await page.click('text=Reporte Personalizado');
    
    // Verificar que el dialog se abre
    await expect(page.locator('text=Crear Reporte Personalizado')).toBeVisible();
    await expect(page.locator('text=Configura un reporte con métricas específicas según tus necesidades')).toBeVisible();
    
    // Interactuar con el dialog
    await page.fill('input#reportName', 'Mi Reporte Personalizado');
    await page.fill('input#reportDescription', 'Descripción del reporte');
    
    // Seleccionar algunas métricas
    await page.check('#totalSales');
    await page.check('#totalQuantity');
    
    // Verificar que el botón guardar se habilita
    await expect(page.locator('text=Guardar Reporte')).toBeEnabled();
    
    // Cancelar dialog
    await page.click('text=Cancelar');
  });

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Hacer clic en actualizar
    await page.click('text=Actualizar');
    
    // Verificar que los datos se recargan (puede haber un indicador de carga)
    await expect(page.locator('h1:has-text("Reportes de Ventas")')).toBeVisible();
  });

  test('should display top products table', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Verificar tabla de top productos
    await expect(page.locator('text=Top 5 Productos')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Verificar headers de tabla
    await expect(page.locator('th:has-text("Producto")')).toBeVisible();
    await expect(page.locator('th:has-text("Ventas Totales")')).toBeVisible();
    await expect(page.locator('th:has-text("Cantidad")')).toBeVisible();
  });

  test('should show trends analysis', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    await page.click('text=Tendencias');
    
    // Verificar métricas de tendencias
    await expect(page.locator('text=Mejor Mes')).toBeVisible();
    await expect(page.locator('text=Promedio Mensual')).toBeVisible();
    await expect(page.locator('text=Menor Mes')).toBeVisible();
  });

  test('should return to dashboard when back button is clicked', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Hacer clic en volver al dashboard
    await page.click('text=Volver al Dashboard');
    
    // Verificar que estamos de vuelta en el dashboard
    await expect(page.locator('text=¡Bienvenido, Administrador!')).toBeVisible();
    await expect(page.locator('text=Módulos de Gestión')).toBeVisible();
  });

  test('should be responsive on mobile view', async ({ page }) => {
    // Cambiar a vista móvil
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.click('text=Reportes de Ventas');
    
    // Verificar que la página sigue siendo funcional en móvil
    await expect(page.locator('h1:has-text("Reportes de Ventas")')).toBeVisible();
    await expect(page.locator('text=Ventas Totales')).toBeVisible();
    
    // Verificar que los tabs funcionan en móvil
    await page.click('text=Productos');
    await expect(page.locator('text=Análisis por Productos')).toBeVisible();
  });

  test('should handle empty data gracefully', async ({ page }) => {
    // Limpiar datos de localStorage
    await page.evaluate(() => {
      localStorage.removeItem('app-bill-headers');
      localStorage.removeItem('app-bill-details');
      localStorage.removeItem('app-order-headers');
      localStorage.removeItem('app-order-details');
    });
    
    await page.reload();
    
    // Hacer login nuevamente
    await page.fill('input[type="email"]', 'admin@empresa.com');
    await page.fill('input[type="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    
    await page.click('text=Reportes de Ventas');
    
    // Verificar que la página maneja datos vacíos
    await expect(page.locator('text=Reportes de Ventas')).toBeVisible();
    await expect(page.locator('text=0')).toBeVisible(); // Métricas en cero
  });

  test('should validate date filters', async ({ page }) => {
    await page.click('text=Reportes de Ventas');
    
    // Establecer fecha desde mayor que fecha hasta
    await page.fill('input[id*="dateFrom"]', '2024-12-31');
    await page.fill('input[id*="dateTo"]', '2024-01-01');
    
    // Verificar que el sistema maneja esta situación correctamente
    await expect(page.locator('text=Reportes de Ventas')).toBeVisible();
  });
});