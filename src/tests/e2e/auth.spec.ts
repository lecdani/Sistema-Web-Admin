import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Next.js dev server runs on port 3000 by default
    await page.goto('http://localhost:3000/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /bienvenido|welcome/i })).toBeVisible();
    await expect(page.getByLabelText(/email|correo/i)).toBeVisible();
    await expect(page.getByLabelText(/password|contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión|sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: /iniciar sesión|sign in/i }).click();
    
    await expect(page.getByText(/correo.*obligatorio|email.*required/i)).toBeVisible();
    await expect(page.getByText(/contraseña.*obligatorio|password.*required/i)).toBeVisible();
  });

  test('should show validation error for invalid email', async ({ page }) => {
    await page.getByLabelText(/email|correo/i).fill('invalid-email');
    await page.getByRole('button', { name: /iniciar sesión|sign in/i }).click();
    
    await expect(page.getByText(/correo.*válido|email.*valid/i)).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.getByLabelText(/email|correo/i).fill('admin@empresa.com');
    await page.getByLabelText(/password|contraseña/i).fill('admin123');
    await page.getByRole('button', { name: /iniciar sesión|sign in/i }).click();
    
    // Verificar que se redirige al dashboard
    await expect(page.getByRole('heading', { name: /panel de control|dashboard/i })).toBeVisible();
    await expect(page.getByText(/bienvenido de nuevo|welcome back/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabelText(/email|correo/i).fill('admin@empresa.com');
    await page.getByLabelText(/password|contraseña/i).fill('wrongpassword');
    await page.getByRole('button', { name: /iniciar sesión|sign in/i }).click();
    
    await expect(page.getByText(/credenciales.*incorrectas|invalid.*credentials/i)).toBeVisible();
  });

  test('should navigate to forgot password form', async ({ page }) => {
    await page.getByText(/olvidé.*contraseña|forgot.*password/i).click();
    
    await expect(page.getByRole('heading', { name: /restablecer|reset/i })).toBeVisible();
    await expect(page.getByText(/enlace.*restablecimiento|reset.*link/i)).toBeVisible();
  });

  test('should change language', async ({ page }) => {
    // Cambiar a inglés
    await page.getByRole('button', { name: /🇪🇸|español/i }).click();
    await page.getByText(/english/i).click();
    
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    
    // Cambiar de vuelta a español
    await page.getByRole('button', { name: /🇺🇸|english/i }).click();
    await page.getByText(/español/i).click();
    
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each dashboard test
    await page.goto('http://localhost:3000/');
    await page.getByLabelText(/email|correo/i).fill('admin@empresa.com');
    await page.getByLabelText(/password|contraseña/i).fill('admin123');
    await page.getByRole('button', { name: /iniciar sesión|sign in/i }).click();
    
    await expect(page.getByRole('heading', { name: /panel de control|dashboard/i })).toBeVisible();
  });

  test('should display dashboard statistics', async ({ page }) => {
    await expect(page.getByText(/total.*usuarios|total.*users/i)).toBeVisible();
    await expect(page.getByText(/usuarios.*activos|active.*users/i)).toBeVisible();
    await expect(page.getByText(/sesiones.*totales|total.*sessions/i)).toBeVisible();
    await expect(page.getByText(/estado.*sistema|system.*health/i)).toBeVisible();
  });

  test('should display user profile in header', async ({ page }) => {
    await expect(page.getByText(/administrador.*sistema/i)).toBeVisible();
  });

  test('should be able to logout', async ({ page }) => {
    await page.getByRole('button', { name: /AS/i }).click(); // Avatar initials
    await page.getByText(/cerrar sesión|sign out/i).click();
    
    await expect(page.getByRole('heading', { name: /bienvenido|welcome/i })).toBeVisible();
  });

  test('should display recent activity', async ({ page }) => {
    await expect(page.getByText(/actividad reciente|recent activity/i)).toBeVisible();
    await expect(page.getByText(/usuarios registrados|registered users/i)).toBeVisible();
  });

  test('should display quick actions', async ({ page }) => {
    await expect(page.getByText(/acciones rápidas|quick actions/i)).toBeVisible();
    await expect(page.getByText(/gestionar usuarios|manage users/i)).toBeVisible();
    await expect(page.getByText(/ver actividad|view activity/i)).toBeVisible();
  });
});