import { PageShell } from '@/components/ui/page-shell';
import { ShopSubscriptionsCrud } from '@/components/forms/shop-subscriptions-crud';

export default function ShopSubscriptionsPage() {
  return (
    <PageShell title="Shop Packages" description="กำหนดสิทธิ์แพ็กเกจร้านค้าและวันหมดอายุ">
      <ShopSubscriptionsCrud />
    </PageShell>
  );
}
