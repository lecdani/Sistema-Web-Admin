'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Store as StoreIcon,
  Users, 
  FileText,
  LogOut, 
  Menu, 
  X,
  User as UserIcon,
  Bell,
  Package,
  BarChart3,
  Layout,
  MapPin,
  ShoppingCart,
  FileImage
} from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/base/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/base/DropdownMenu';
import { Badge } from '@/shared/components/base/Badge';
import { Separator } from '@/shared/components/base/Separator';
import { Logo } from '@/shared/components/Logo';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPage, onNavigate }) => {
  const { user, logout, refreshUser } = useAuth();
  const { translate } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Actualizar barra y menú cuando el perfil guarda cambios (nombre, email, etc.)
  useEffect(() => {
    const handler = () => refreshUser?.();
    window.addEventListener('user-updated', handler);
    return () => window.removeEventListener('user-updated', handler);
  }, [refreshUser]);

  // Determinar la página actual desde la ruta si no se proporciona
  const activePage = currentPage || pathname?.split('/').pop() || 'dashboard';

  const handleNavigate = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    } else {
      router.push(`/${page}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const coreNavigation = [
    { nameKey: 'navMainPanel', href: '/dashboard', icon: LayoutDashboard, current: activePage === 'dashboard' },
    { nameKey: 'navCities', href: '/cities', icon: MapPin, current: activePage === 'cities' },
    { nameKey: 'navStores', href: '/stores', icon: StoreIcon, current: activePage === 'stores' },
    { nameKey: 'navUsers', href: '/users', icon: Users, current: activePage === 'users' }
  ];

  const catalogNavigation = [
    { nameKey: 'navProducts', href: '/products', icon: Package, current: activePage === 'products' },
    { nameKey: 'navPlanograms', href: '/planograms', icon: Layout, current: activePage === 'planograms' }
  ];

  const salesNavigation = [
    { nameKey: 'navOrders', href: '/orders', icon: ShoppingCart, current: activePage === 'orders' || activePage === 'unified-flow' }
  ];

  const analyticsNavigation = [
    { nameKey: 'navReports', href: '/reports', icon: BarChart3, current: activePage === 'reports' }
  ];

  const userNavigation = [
    { nameKey: 'navMyProfile', href: '/profile', icon: UserIcon, current: activePage === 'profile' }
  ];

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'user': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return translate('admin');
      case 'user': return translate('roleSeller');
      default: return translate('user');
    }
  };

  const NavSection = ({ titleKey, items }: { titleKey: string; items: typeof coreNavigation }) => (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
        {translate(titleKey)}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.nameKey}
            href={item.href}
            onClick={() => handleNavigate(item.href.replace('/', ''))}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              item.current
                ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-200'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="h-5 w-5" />
            {translate(item.nameKey)}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <Logo size="md" variant="dark" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
            <NavSection titleKey="sectionAdministration" items={coreNavigation} />
            <Separator className="mx-3" />
            <NavSection titleKey="sectionCatalog" items={catalogNavigation} />
            <Separator className="mx-3" />
            <NavSection titleKey="sectionSales" items={salesNavigation} />
            <Separator className="mx-3" />
            <NavSection titleKey="sectionAnalytics" items={analyticsNavigation} />
            <Separator className="mx-3" />
            <NavSection titleKey="sectionUser" items={userNavigation} />
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.avatar || undefined} />
                <AvatarFallback className="bg-indigo-600 text-white text-sm font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs px-2 py-0.5 ${getRoleColor(user?.role)}`}>
                    {getRoleLabel(user?.role)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0 z-30">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  3
                </span>
              </Button>

              {/* Language selector */}
              <LanguageSelector />

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback className="bg-indigo-600 text-white text-sm font-semibold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-2">
                      <p className="text-sm font-semibold leading-none">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs leading-none text-gray-500">
                        {user?.email}
                      </p>
                      <Badge className={`text-xs w-fit ${getRoleColor(user?.role)}`}>
                        {getRoleLabel(user?.role)}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleNavigate('profile')}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>{translate('myProfile')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{translate('signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};