'use client';

import React, { useState, useEffect } from 'react';
import { 
  Store as StoreIcon, 
  Users, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  BarChart3,
  Layout,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Workflow
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Button } from '@/shared/components/base/Button';
import { Badge } from '@/shared/components/base/Badge';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DashboardStats } from '@/shared/types';
import { getFromLocalStorage } from '@/shared/services/database';
import { citiesApi } from '@/shared/services/cities-api';
import { usersApi } from '@/shared/services/users-api';
import { storesApi } from '@/shared/services/stores-api';
import { productsApi } from '@/shared/services/products-api';
import { useRouter } from 'next/navigation';

interface DashboardModule {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface DashboardProps {
  onNavigateToUsers?: () => void;
  onNavigateToStores?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToPlanograms?: () => void;
  onNavigateToCities?: () => void;
  onNavigateToReports?: () => void;
  onNavigateToUnifiedFlow?: () => void;
  /** Si true, se refrescan los datos (útil al volver al dashboard) */
  isVisible?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigateToUsers, 
  onNavigateToStores, 
  onNavigateToProducts, 
  onNavigateToPlanograms, 
  onNavigateToCities, 
  onNavigateToReports,
  onNavigateToUnifiedFlow,
  isVisible = true
}) => {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalSessions: 0,
    totalStores: 0,
    activeStores: 0,
    totalProducts: 0,
    activeProducts: 0,
    totalPlanograms: 0,
    activePlanogram: 0,
    totalCities: 0,
    systemHealth: 'healthy'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) loadDashboardData();
  }, [isVisible]);

  const loadDashboardData = async () => {
    try {
      let totalCities = 0;
      let totalUsers = 0;
      let activeUsers = 0;
      let totalStores = 0;
      let activeStores = 0;

      try {
        const citiesList = await citiesApi.fetchAll();
        totalCities = citiesList.length;
      } catch {
        // Fallback: no API de ciudades o sin auth
      }

      try {
        const usersList = await usersApi.fetchAll();
        totalUsers = usersList.length;
        activeUsers = usersList.filter((u: any) => u.isActive === true).length;
      } catch {
        const users = getFromLocalStorage('app-users') || [];
        totalUsers = users.length;
        activeUsers = users.filter((u: any) => u.isActive === true).length;
      }

      try {
        const storesList = await storesApi.fetchAll();
        totalStores = storesList.length;
        activeStores = storesList.filter((s: any) => s.isActive === true).length;
      } catch {
        const stores = getFromLocalStorage('app-stores') || [];
        totalStores = stores.length;
        activeStores = stores.filter((s: any) => s.isActive === true).length;
      }

      let totalProducts = 0;
      let activeProducts = 0;
      try {
        const productsList = await productsApi.fetchAll();
        totalProducts = productsList.length;
        activeProducts = productsList.filter((p: any) => p.isActive === true).length;
      } catch {
        const products = getFromLocalStorage('app-products') || [];
        totalProducts = products.length;
        activeProducts = products.filter((p: any) => p.isActive === true).length;
      }

      const sessions = getFromLocalStorage('app-sessions') || [];
      const totalSessions = sessions.length;
      const planograms = getFromLocalStorage('app-planograms') || [];
      const totalPlanograms = planograms.length;
      const activePlanogram = planograms.filter((p: any) => p.isActive === true).length;

      setStats({
        totalUsers,
        activeUsers,
        totalSessions,
        totalStores,
        activeStores,
        totalProducts,
        activeProducts,
        totalPlanograms,
        activePlanogram,
        totalCities,
        systemHealth: totalUsers > 10 ? 'healthy' : totalUsers > 5 ? 'warning' : 'critical'
      });
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        totalSessions: 0,
        totalStores: 0,
        activeStores: 0,
        totalProducts: 0,
        activeProducts: 0,
        totalPlanograms: 0,
        activePlanogram: 0,
        totalCities: 0,
        systemHealth: 'healthy'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickStats = [
    {
      title: 'Ciudades',
      value: stats.totalCities.toString(),
      change: 0,
      icon: MapPin,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Tiendas Activas',
      value: stats.activeStores.toString(),
      change: 0,
      icon: StoreIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Productos Activos',
      value: stats.activeProducts.toString(),
      change: 0,
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Planograma Activo',
      value: stats.activePlanogram.toString(),
      change: 0,
      icon: Layout,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Usuarios Activos',
      value: stats.activeUsers.toString(),
      change: 0,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  const modules: DashboardModule[] = [
    {
      id: 'cities',
      title: 'Gestión de Ciudades',
      description: 'Administra las ciudades del sistema',
      icon: MapPin,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
      onClick: () => {
        if (onNavigateToCities) onNavigateToCities();
        else router.push('/cities');
      }
    },
    {
      id: 'stores',
      title: 'Gestión de Tiendas',
      description: 'Administra tus tiendas y sucursales',
      icon: StoreIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      onClick: () => {
        if (onNavigateToStores) onNavigateToStores();
        else router.push('/stores');
      }
    },
    {
      id: 'users',
      title: 'Gestión de Usuarios',
      description: 'Administra usuarios y permisos',
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      onClick: () => {
        if (onNavigateToUsers) onNavigateToUsers();
        else router.push('/users');
      }
    },
    {
      id: 'products',
      title: 'Gestión de Productos',
      description: 'Administra el catálogo de productos',
      icon: Package,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100',
      onClick: () => {
        if (onNavigateToProducts) onNavigateToProducts();
        else router.push('/products');
      }
    },
    {
      id: 'planograms',
      title: 'Planogramas',
      description: 'Planifica la disposición de productos',
      icon: Layout,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 hover:bg-cyan-100',
      onClick: () => {
        if (onNavigateToPlanograms) onNavigateToPlanograms();
        else router.push('/planograms');
      }
    },
    {
      id: 'sales-flow',
      title: 'Gestión de Pedidos',
      description: 'Gestiona Pedidos, Facturas y PODs en un solo lugar',
      icon: Workflow,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      onClick: () => {
        if (onNavigateToUnifiedFlow) onNavigateToUnifiedFlow();
        else router.push('/unified-flow');
      }
    },
    {
      id: 'reports',
      title: 'Reportes de Ventas',
      description: 'Análisis detallado del desempeño comercial',
      icon: BarChart3,
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100',
      onClick: () => {
        if (onNavigateToReports) onNavigateToReports();
        else router.push('/reports');
      }
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            ¡Bienvenido, {user?.firstName}! 
          </h1>
          <p className="text-gray-600 mt-2">
            Panel de control administrativo - {new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Sistema Operativo
          </Badge>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Ver Agenda
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          const isPositive = stat.change > 0;
          
          return (
            <Card key={index} className="hover:shadow-md transition-all duration-200 hover:border-gray-300">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    {stat.change !== 0 && (
                      <div className="flex items-center mt-1.5">
                        {isPositive ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <span className={`text-xs font-medium ml-1 ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {Math.abs(stat.change)}% vs mes anterior
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Modules */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            Módulos de Gestión
          </h2>
          <p className="text-sm text-gray-500">
            Accede a las herramientas administrativas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            
            return (
              <Card 
                key={module.id} 
                className="hover:shadow-md hover:border-blue-200 cursor-pointer group transition-all duration-200"
                onClick={module.onClick}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2.5 rounded-lg ${module.bgColor} transition-all duration-200 group-hover:scale-105 flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${module.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {module.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {module.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Estado del Sistema
            </CardTitle>
            <CardDescription>
              Información del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Estado General</span>
              <Badge className="bg-green-100 text-green-800">Operativo</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tiendas Registradas</span>
              <span className="text-sm font-semibold text-gray-900">{stats.totalStores}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Productos Registrados</span>
              <span className="text-sm font-semibold text-gray-900">{stats.totalProducts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Planogramas Totales</span>
              <span className="text-sm font-semibold text-gray-900">{stats.totalPlanograms}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Usuarios Registrados</span>
              <span className="text-sm font-semibold text-gray-900">{stats.totalUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Última Sincronización</span>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-sm font-semibold text-gray-900">En tiempo real</span>
              </div>
            </div>
            
            <div className="pt-2.5 border-t border-gray-100">
              <Button className="w-full" size="sm" variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver Métricas Detalladas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};