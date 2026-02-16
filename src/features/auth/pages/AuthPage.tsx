'use client';

import React, { useState } from 'react';
import { Shield, Smartphone, HeadphonesIcon } from 'lucide-react';
import { Logo } from '@/shared/components/Logo';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { LoginForm } from './LoginForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { useLanguage } from '@/shared/hooks/useLanguage';

type AuthView = 'login' | 'forgot-password';

export const AuthPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const { translate } = useLanguage();

  const handleViewChange = (view: AuthView) => {
    setCurrentView(view);
  };

  const features = [
    {
      icon: Shield,
      text: translate('advancedSecurity') || 'Seguridad empresarial avanzada'
    },
    {
      icon: Smartphone,
      text: translate('anyDeviceAccess') || 'Acceso desde cualquier dispositivo'
    },
    {
      icon: HeadphonesIcon,
      text: translate('support247') || 'Soporte 24/7 especializado'
    }
  ];

  return (
    <div className="min-h-screen flex">
      {/* Panel Izquierdo - Información Empresarial */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 gradient-primary-alt relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] bg-repeat"></div>
        </div>

        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-between p-8 lg:p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex justify-start">
            <Logo size="lg" variant="light" />
          </div>

          {/* Contenido Principal */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
                {translate('companyName')}
              </h1>
              <p className="text-xl lg:text-2xl text-indigo-100 leading-relaxed">
                {translate('companyTaglineShort')}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-center gap-4 text-white">
                    <div className="flex-shrink-0 w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-lg font-medium">{feature.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-indigo-200 text-sm">
            {translate('copyright')}
          </div>
        </div>

        {/* Elementos decorativos */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
      </div>

      {/* Panel Derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <div className="w-full max-w-md">
          {/* Header móvil */}
          <div className="lg:hidden mb-8 text-center">
            <Logo size="md" variant="dark" className="justify-center mb-4" />
          </div>

          {/* Selector de idioma */}
          <div className="flex justify-end mb-6">
            <LanguageSelector />
          </div>

          {/* Formulario */}
          <div className="space-y-6">
            {currentView === 'login' ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                    {translate('welcome')}
                  </h2>
                  <p className="text-gray-600">
                    {translate('authSubtitle')}
                  </p>
                </div>

                <LoginForm onForgotPassword={() => handleViewChange('forgot-password')} />
                
              </>
            ) : (
              <ForgotPasswordForm onBackToLogin={() => handleViewChange('login')} />
            )}
          </div>

          {/* Links del footer */}
          <div className="text-center mt-8 space-y-2">
            <div className="flex justify-center space-x-4 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-700 transition-colors">
                {translate('termsOfService')}
              </a>
              <span>•</span>
              <a href="#" className="hover:text-gray-700 transition-colors">
                {translate('privacyPolicy')}
              </a>
              <span>•</span>
              <a href="#" className="hover:text-gray-700 transition-colors">
                {translate('support')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};