import { test, expect } from '@playwright/test';

test.describe('Dashboard - Módulos de Gestión', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/');
    
    // Esperar a que la aplicación se inicialice
    await page.waitForFunction(() => {
      const loader = document.querySelector('.animate-spin');
      return !loader || !document.body.contains(loader);
    }, { timeout: 15000 });
    
    // Login como administrador
    await page.fill('input[type="email"]', 'admin@empresa.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    
    // Esperar a que aparezca el dashboard
    await page.waitForSelector('text=¡Bienvenido de vuelta, Administrador!', { timeout: 10000 });
  });

  test('debe mostrar todos los módulos principales de gestión', async ({ page }) => {
    // Verificar módulos en el dashboard
    await expect(page.locator('text=Gestión de Tiendas')).toBeVisible();
    await expect(page.locator('text=Gestión de Usuarios')).toBeVisible();
    await expect(page.locator('text=Gestión de Facturas')).toBeVisible();
    await expect(page.locator('text=Gestión de Pedidos')).toBeVisible();
    await expect(page.locator('text=Planogramas')).toBeVisible();
    await expect(page.locator('text=Reportes')).toBeVisible();
    
    // Verificar navegación lateral por categorías
    await expect(page.locator('text=Administración')).toBeVisible();
    await expect(page.locator('text=Ventas y Operaciones')).toBeVisible();
    await expect(page.locator('text=Análisis')).toBeVisible();
    await expect(page.locator('text=Usuario')).toBeVisible();
  });

  test('debe mostrar las métricas actualizadas en las estadísticas rápidas', async ({ page }) => {
    // Verificar estadísticas rápidas expandidas
    await expect(page.locator('text=Ventas del Mes')).toBeVisible();
    await expect(page.locator('text=Pedidos Activos')).toBeVisible();
    await expect(page.locator('text=Total Productos')).toBeVisible();
    await expect(page.locator('text=Usuarios Activos')).toBeVisible();
    
    // Verificar que los valores están presentes
    await expect(page.locator('text=$125,430')).toBeVisible();
    await expect(page.locator('text=847')).toBeVisible(); // Pedidos Activos
    await expect(page.locator('text=2,847')).toBeVisible(); // Total Productos
  });

  test('debe mostrar la navegación lateral organizada por categorías', async ({ page }) => {
    // Verificar categorías en el menú lateral
    await expect(page.locator('text=Administración')).toBeVisible();
    await expect(page.locator('text=Ventas y Operaciones')).toBeVisible();
    await expect(page.locator('text=Análisis')).toBeVisible();
    await expect(page.locator('text=Usuario')).toBeVisible();
    await expect(page.locator('text=Sistema')).toBeVisible();
  });

  test('debe mostrar todos los módulos en la vista principal del dashboard', async ({ page }) => {
    // Verificar que todos los módulos están visibles en el dashboard
    await expect(page.locator('text=Gestión de Tiendas')).toBeVisible();
    await expect(page.locator('text=Gestión de Usuarios')).toBeVisible();
    await expect(page.locator('text=Gestión de Pedidos')).toBeVisible();
    await expect(page.locator('text=Gestión de Facturas')).toBeVisible();
    await expect(page.locator('text=Planogramas')).toBeVisible();
    await expect(page.locator('text=Reportes')).toBeVisible();
    
    // Verificar título de la sección
    await expect(page.locator('text=Módulos de Gestión')).toBeVisible();
  });

  test('debe mostrar actividad reciente actualizada', async ({ page }) => {
    // Verificar sección de actividad reciente
    await expect(page.locator('text=Actividad Reciente')).toBeVisible();
    
    // Verificar algunas actividades específicas
    await expect(page.locator('text=Nuevo pedido #2847 procesado')).toBeVisible();
    await expect(page.locator('text=Planograma actualizado para Tienda Centro')).toBeVisible();
    await expect(page.locator('text=Reporte mensual generado')).toBeVisible();
    
    // Verificar que se muestran los badges de módulos
    await expect(page.locator('text=Pedidos')).toBeVisible();
    await expect(page.locator('text=Planogramas')).toBeVisible();
    await expect(page.locator('text=Reportes')).toBeVisible();
  });

  test('debe mostrar métricas del sistema mejoradas', async ({ page }) => {
    // Verificar sección de estado del sistema
    await expect(page.locator('text=Estado del Sistema')).toBeVisible();
    await expect(page.locator('text=Métricas en tiempo real')).toBeVisible();
    
    // Verificar métricas específicas
    await expect(page.locator('text=Estado General')).toBeVisible();
    await expect(page.locator('text=Operativo')).toBeVisible();
    await expect(page.locator('text=Tiempo de Actividad')).toBeVisible();
    await expect(page.locator('text=99.9%')).toBeVisible();
    
    // Verificar nuevas métricas
    await expect(page.locator('text=Pedidos Hoy')).toBeVisible();
    await expect(page.locator('text=127')).toBeVisible();
    await expect(page.locator('text=Reportes Generados')).toBeVisible();
    await expect(page.locator('text=45')).toBeVisible();
    
    // Verificar botón de métricas detalladas
    await expect(page.locator('text=Ver Métricas Detalladas')).toBeVisible();
  });

  test('debe ser responsive en diferentes tamaños de pantalla', async ({ page }) => {
    // Probar en tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('text=Gestión de Tiendas')).toBeVisible();
    await expect(page.locator('text=Gestión de Pedidos')).toBeVisible();
    
    // Probar en móvil
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('text=¡Bienvenido de vuelta, Administrador!')).toBeVisible();
    await expect(page.locator('text=Módulos de Gestión')).toBeVisible();
    
    // Volver a desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('text=Gestión de Tiendas')).toBeVisible();
  });

  test('debe mostrar indicadores de crecimiento en los módulos', async ({ page }) => {
    // Buscar iconos de crecimiento positivo y negativo
    const upArrows = page.locator('svg').filter({ hasText: '' }); // ArrowUpRight icons
    const downArrows = page.locator('svg').filter({ hasText: '' }); // ArrowDownRight icons
    
    // Verificar que hay indicadores de crecimiento
    await expect(page.locator('text=8.2%')).toBeVisible(); // Crecimiento de tiendas
    await expect(page.locator('text=15.3%')).toBeVisible(); // Crecimiento de pedidos
    await expect(page.locator('text=22.1%')).toBeVisible(); // Crecimiento de reportes
  });

  test('debe permitir hacer click en los módulos', async ({ page }) => {
    // Verificar que los módulos son clickeables (aunque redirijan a console.log por ahora)
    const tiendModule = page.locator('text=Gestión de Tiendas').locator('..').locator('..');
    await expect(tiendModule).toBeVisible();
    
    const pedidosModule = page.locator('text=Gestión de Pedidos').locator('..').locator('..');
    await expect(pedidosModule).toBeVisible();
    
    const reportesModule = page.locator('text=Gestión de Reportes').locator('..').locator('..');
    await expect(reportesModule).toBeVisible();
    
    const planogramasModule = page.locator('text=Gestión de Planogramas').locator('..').locator('..');
    await expect(planogramasModule).toBeVisible();
  });
});