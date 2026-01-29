'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../src/features/auth/hooks/useAuth';
import { AuthPage } from '../src/features/auth/pages/AuthPage';
import { AdminDashboardManager } from '../src/features/admin/dashboard/AdminDashboardManager';
import { SalesPage } from '../src/features/sales/pages/SalesPage';

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  // Redirigir según el estado de autenticación
  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated && user) {
        if (user.role === 'user') {
          router.push('/sales');
        } else if (user.role === 'admin') {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Mostrar loader mientras se verifica la autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">Verificando autenticación...</p>
            <p className="text-xs text-gray-500">Sistema Empresarial</p>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar según el estado de autenticación y el rol del usuario
  if (isAuthenticated && user) {
    if (user.role === 'user') {
      return <SalesPage />;
    } else if (user.role === 'admin') {
      return <AdminDashboardManager />;
    }
  }

  return <AuthPage />;
}
