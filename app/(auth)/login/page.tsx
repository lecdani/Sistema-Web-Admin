'use client';

import { AuthPage } from '../../../src/features/auth/pages/AuthPage';

// Forzar renderizado dinámico para evitar prerenderizado estático
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <AuthPage />;
}
