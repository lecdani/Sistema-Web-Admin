'use client';

import { useRouter } from 'next/navigation';
import { ForgotPasswordForm } from '../../../src/features/auth/pages/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <ForgotPasswordForm onBackToLogin={() => router.push('/login')} />
    </div>
  );
}
