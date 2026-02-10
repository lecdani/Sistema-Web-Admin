'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { removeLoggedUser } from '@/shared/utils/auth';
import { authService } from '@/features/auth/services/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}

const ADMIN_ONLY_MESSAGE = 'No posee cuenta de administrador.';

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.push('/login');
        return;
      }

      if (requiredRole === 'admin') {
        const isAdmin = user.role === 'admin';
        const isActive = user.isActive !== false;
        if (!isAdmin || !isActive) {
          removeLoggedUser();
          authService.logout();
          router.push(`/login?message=${encodeURIComponent(ADMIN_ONLY_MESSAGE)}`);
          return;
        }
      } else if (requiredRole && user.role !== requiredRole) {
        router.push('/login');
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
    return null;
  }

  if (requiredRole === 'admin' && (user.role !== 'admin' || user.isActive === false)) {
    return null;
  }
  if (requiredRole && requiredRole !== 'admin' && user.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
