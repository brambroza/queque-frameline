import { PageShell } from '@/components/ui/page-shell';
import { SettingsCrud } from '@/components/forms/settings-crud';
import { GoogleCalendarSettings } from '@/components/forms/google-calendar-settings';

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="จัดการโปรไฟล์ร้านค้า การเชื่อมต่อ และค่า config ของระบบ">
      <div className="space-y-4">
        <GoogleCalendarSettings />
        <SettingsCrud />
      </div>
    </PageShell>
  );
}
