import React, { useState } from 'react';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './Dashboard';
import { UserManagement } from '../users/UserManagement';
import { StoreManagement } from '../stores/StoreManagement';
import { ProductManagement } from '../products/ProductManagement';
import { PlanogramManagement } from '../planograms/PlanogramManagement';
import { UserProfile } from '../users/components/UserProfile';
import { CityManagement } from '../cities/CityManagement';
import { ReportsManagement } from '../reports/ReportsManagement';
import { UnifiedSalesFlowComplete } from '../orders/UnifiedSalesFlowComplete';

export const AdminDashboardManager: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'users':
        return <UserManagement onBack={handleBackToDashboard} />;
      case 'stores':
        return <StoreManagement onBack={handleBackToDashboard} />;
      case 'products':
        return <ProductManagement onBack={handleBackToDashboard} />;
      case 'planograms':
        return <PlanogramManagement onBack={handleBackToDashboard} />;
      case 'profile':
        return <UserProfile onBack={handleBackToDashboard} />;
      case 'cities':
        return <CityManagement onBack={handleBackToDashboard} />;
      case 'reports':
        return <ReportsManagement onBack={handleBackToDashboard} />;
      case 'unified-flow':
        return <UnifiedSalesFlowComplete onBack={handleBackToDashboard} />;
      case 'dashboard':
      default:
        return <Dashboard 
          onNavigateToUsers={() => handleNavigate('users')}
          onNavigateToStores={() => handleNavigate('stores')}
          onNavigateToProducts={() => handleNavigate('products')}
          onNavigateToPlanograms={() => handleNavigate('planograms')}
          onNavigateToCities={() => handleNavigate('cities')}
          onNavigateToReports={() => handleNavigate('reports')}
          onNavigateToUnifiedFlow={() => handleNavigate('unified-flow')}
          isVisible={currentPage === 'dashboard'}
        />;
    }
  };

  return (
    <AdminLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderCurrentPage()}
    </AdminLayout>
  );
};