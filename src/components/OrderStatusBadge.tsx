import { STATUS_COLORS, STATUS_LABELS } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import { Badge } from './ui';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} />;
}
