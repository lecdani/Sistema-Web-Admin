'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Badge } from '@/shared/components/base/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/base/Avatar';
import { ShoppingBag, LogOut, User, Clock, Settings, Bell, Activity } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { Logo } from '@/shared/components/Logo';
import { UserProfile } from '../../admin/users/components/UserProfile';

export const SalesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getUserInitials = () => {
    if (!user) return 'V';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'V';
  };

  if (showProfile) {
    return <UserProfile onBack={() => setShowProfile(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Logo size="sm" variant="dark" />
              <div className="hidden md:block">
                <h1 className="text-xl font-bold text-gray-900">Portal de Ventas</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <LanguageSelector />
              
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 cursor-pointer" onClick={() => setShowProfile(true)}>
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="bg-indigo-600 text-white text-sm font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-gray-900">
              ¡Hola, {user?.firstName || 'Vendedor'}!
            </h2>
            <p className="text-gray-600">
              Bienvenido al portal de ventas
            </p>
          </div>

          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Usuario</CardTitle>
              <CardDescription>Datos de tu cuenta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.avatar || undefined} />
                    <AvatarFallback className="bg-indigo-600 text-white text-lg font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      Vendedor
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Estado:</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Activo
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date and Time Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Fecha y Hora Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-gray-900">{formatDate(currentTime)}</p>
                <p className="text-xl text-gray-600">{formatTime(currentTime)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Section */}
          <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <Activity className="h-5 w-5" />
                🚀 Próximamente
              </CardTitle>
              <CardDescription className="text-indigo-700">
                Funcionalidades en desarrollo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-3 mb-2">
                    <ShoppingBag className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Gestión de productos</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Próximamente podrás gestionar productos y realizar pedidos
                  </p>
                </div>
                
                <div className="p-4 bg-white rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Seguimiento de ventas</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Visualiza estadísticas y seguimiento de tus ventas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
