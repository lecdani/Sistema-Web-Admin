'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ResetPasswordForm } from '../../../src/features/auth/pages/ResetPasswordForm';
import Link from 'next/link';
import { Button } from '@/shared/components/base/Button';
import { AlertCircle } from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  if (!token || !email) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 backdrop-blur-sm p-8 text-center shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-amber-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Enlace inválido o expirado</h2>
          <p className="text-gray-600 mb-6">
            Este enlace de recuperación no es válido o ya ha caducado. Solicita uno nuevo desde la pantalla de inicio de sesión.
          </p>
          <Button asChild className="w-full h-12">
            <Link href="/login">Ir al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm token={token} email={email} />;
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md h-64 bg-white/80 rounded-xl animate-pulse" />
      }>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
