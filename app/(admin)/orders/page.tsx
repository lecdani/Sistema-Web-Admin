'use client';

import { Suspense } from 'react';
import { OrderManagement } from '../../../src/features/admin/orders/OrderManagement';

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrderManagement />
    </Suspense>
  );
}
