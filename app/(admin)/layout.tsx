'use client';

import { AuthGuard } from '../../src/shared/components/AuthGuard';
import { AdminLayout } from '../../src/features/admin/dashboard/components/AdminLayout';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Extraer la página actual de la ruta
  const currentPage = pathname?.split('/').pop() || 'dashboard';

  const handleNavigate = (page: string) => {
    router.push(`/${page}`);
  };

  return (
    <AuthGuard requiredRole="admin">
      <AdminLayout currentPage={currentPage} onNavigate={handleNavigate}>
        {children}
      </AdminLayout>
    </AuthGuard>
  );
}
