import type { PromoCard } from '@/components/demo/demo-flex-carousel';
import type { PaymentMethod, PaymentStatus } from '@/types/db';

export type DemoMenuAction = 'booking' | 'member' | 'check' | 'promo' | 'contact' | 'open_liff';

export type DemoBooking = {
  queueNo: string;
  branchName: string;
  serviceName: string;
  resourceName?: string;
  dateLabel: string;
  timeLabel: string;
  customerName: string;
  customerPhone?: string;
  /** Amount due in THB. Absent or 0 means the shop does not collect a deposit. */
  amount?: number;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
};

export type DemoQueueStatus = 'waiting' | 'called' | 'serving' | 'completed';

export type DemoQueueItem = DemoBooking & {
  id: string;
  status: DemoQueueStatus;
  resourceName?: string;
};

export type DemoMemberProfile = {
  name: string;
  phone: string;
  tier: string;
  points: number;
  totalBookings: number;
  lastQueueNo?: string;
};

export type DemoTemplate = 'barber' | 'restaurant' | 'clinic' | 'meeting';

export type ChatMessage = {
  id: string;
  role: 'customer' | 'bot' | 'system';
  text?: string;
  type?: 'text' | 'flex_booking_success' | 'member_profile' | 'promo' | 'flex_payment_request' | 'flex_payment_paid';
  booking?: DemoBooking;
  promos?: PromoCard[];
};
