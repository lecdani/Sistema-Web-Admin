'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.push('/login');
        return;
      }

      if (requiredRole && user.role !== requiredRole) {
        // Redirigir según el rol del usuario
        if (user.role === 'admin') {
          router.push('/dashboard');
        } else if (user.role === 'user') {
          router.push('/sales');
        } else {
          router.push('/login');
        }
      }
    }
  }, [isAuthenticated, isLoading, user, requiredRole, router]);

  if (isLoading) {
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

  if (!isAuthenticated || !user) {
    return null; // El useEffect redirigirá
  }

  if (requiredRole && user.role !== requiredRole) {
    return null; // El useEffect redirigirá
  }

  return <>{children}</>;
}
