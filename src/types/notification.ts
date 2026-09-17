export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationCategory = 'bookings' | 'operations' | 'customers' | 'billing' | 'system' | 'marketing';
export type NotificationType = string;

export interface NotificationItem {
  id: string;
  company_id: string;
  shop_id: string | null;
  branch_id: string | null;
  user_id: string | null;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  body?: string | null;
  related_type: string | null;
  related_id: string | null;
  action_url: string | null;
  icon: string | null;
  color: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  archived_at: string | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
