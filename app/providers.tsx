'use client';

import React, { useEffect, useState } from 'react';
import { ToastProvider } from '../src/shared/components/base/Toast';
import { initializeDatabase } from '../src/shared/services/database';

export function Providers({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeDatabase();
        setIsInitialized(true);
      } catch (error) {
        console.error('Error inicializando la aplicación:', error);
        setIsInitialized(true);
      }
    };

    initApp();
  }, []);

  // Mostrar loader mientras se inicializa
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">Inicializando sistema...</p>
            <p className="text-xs text-gray-500">Sistema Empresarial</p>
          </div>
        </div>
      </div>
    );
  }

  return <ToastProvider>{children}</ToastProvider>;
}
