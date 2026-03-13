import { test, expect } from '@playwright/test';

test.describe('Integración del Logo del Sistema', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/');
    
    // Esperar a que la aplicación se inicialice completamente
    await page.waitForFunction(() => {
      const loader = document.querySelector('.animate-spin');
      return !loader || !document.body.contains(loader);
    }, { timeout: 15000 });
  });

  test('debe mostrar el logo en la página de login', async ({ page }) => {
    // Verificar logo en el panel izquierdo (desktop)
    await expect(page.locator('text=ETERNAL').first()).toBeVisible();
    
    // Verificar branding empresarial
    await expect(page.locator('text=Transformando el futuro de los negocios digitales')).toBeVisible();
    await expect(page.locator('text=ETERNAL').first()).toBeVisible();
    
    // En móvil, verificar header
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('text=ETERNAL')).toBeVisible();
  });

  test('debe mostrar el logo en el dashboard administrativo', async ({ page }) => {
    // Login como admin
    await page.fill('input[type="email"]', 'admin@empresa.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    await page.waitForSelector('text=Panel Principal', { timeout: 10000 });
    
    // Verificar que el logo se muestra
    await expect(page.locator('text=ETERNAL')).toBeVisible();
  });

  test('debe mostrar el logo en la página de ventas', async ({ page }) => {
    // Login como vendedor
    await page.fill('input[type="email"]', 'vendedor@empresa.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    await page.waitForSelector('text=¡Hola, Vendedor!', { timeout: 10000 });
    
    // Verificar logo en el header
    await expect(page.locator('text=ETERNAL').first()).toBeVisible();
    
    // Verificar branding en la tarjeta del sistema
    await expect(page.locator('text=Sistema Empresarial')).toBeVisible();
    await expect(page.locator('text=v1.0 Portal de Ventas')).toBeVisible();
  });

  test('debe mantener consistencia de marca en todos los estados', async ({ page }) => {
    // Estado 1: Página de login
    await expect(page.locator('text=ETERNAL')).toBeVisible();
    
    // Estado 2: Después del login como admin
    await page.fill('input[type="email"]', 'admin@empresa.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('text=Panel Principal', { timeout: 10000 });
    await expect(page.locator('text=ETERNAL')).toBeVisible();
    
    // Estado 3: Logout y login como vendedor
    await page.click('button:has([data-testid="avatar"]), [data-testid="user-menu"]');
    await page.click('text=Cerrar Sesión');
    
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    await expect(page.locator('text=ETERNAL')).toBeVisible();
    
    await page.fill('input[type="email"]', 'vendedor@empresa.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('text=¡Hola, Vendedor!', { timeout: 10000 });
    await expect(page.locator('text=ETERNAL')).toBeVisible();
  });

  test('debe mostrar información corporativa correcta', async ({ page }) => {
    // Verificar información en la página de login
    await expect(page.locator('text=ETERNAL')).toBeVisible();
    await expect(page.locator('text=Sistema Empresarial')).toBeVisible();
    await expect(page.locator('text=Transformando el futuro de los negocios digitales')).toBeVisible();
  });
});