'use client';

import { use } from 'react';
import { OrderDetailView } from '../../../src/features/admin/orders/OrderDetailView';

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OrderDetailView orderId={id} />;
}
