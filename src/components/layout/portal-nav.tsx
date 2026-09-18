'use client';

import { usePathname } from 'next/navigation';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import TableRestaurantRoundedIcon from '@mui/icons-material/TableRestaurantRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/i18n-provider';
import { useBranchScope } from '@/components/layout/branch-scope-provider';

type NavItem = {
  labelKey: string;
  fallback: string;
  href: string;
  icon: React.ReactNode;
  /** Hidden from users bound to specific branches — these screens are shop-wide admin. */
  shopWideOnly?: boolean;
};
type NavGroup = { titleKey: string; fallback: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    titleKey: 'menu.overview',
    fallback: 'ภาพรวม',
    items: [
      { labelKey: 'menu.dashboard', fallback: 'แดชบอร์ด', href: '/portal/dashboard', icon: <DashboardRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.dock_queues', fallback: 'คิวรับ-ส่งสินค้า', href: '/portal/bookings', icon: <EventNoteRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.documents', fallback: 'เอกสาร SO / PO', href: '/portal/documents', icon: <DescriptionRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.calendar', fallback: 'ปฏิทิน', href: '/portal/calendar', icon: <CalendarMonthRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.queue_board', fallback: 'บอร์ดคิว', href: '/portal/queue-board', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.queue_display', fallback: 'จอแสดงคิว', href: '/portal/queue-display', icon: <TvRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.notifications', fallback: 'การแจ้งเตือน', href: '/portal/notifications', icon: <NotificationsRoundedIcon fontSize="small" /> },
    ],
  },
  {
    titleKey: 'menu.group_site',
    fallback: 'จัดการคลัง',
    items: [
      { labelKey: 'menu.branches', fallback: 'สาขา/ประตู', href: '/portal/branches', icon: <StoreRoundedIcon fontSize="small" />, shopWideOnly: true },
      { labelKey: 'menu.vehicle_types', fallback: 'ประเภทรถ', href: '/portal/services', icon: <DesignServicesRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.docks', fallback: 'ท่ารับ-ส่งสินค้า', href: '/portal/resources', icon: <TableRestaurantRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.working_hours', fallback: 'เวลาทำการ', href: '/portal/working-hours', icon: <ScheduleRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.holidays', fallback: 'วันหยุด', href: '/portal/holidays', icon: <EventBusyRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.staff', fallback: 'พนักงาน', href: '/portal/staff', icon: <GroupRoundedIcon fontSize="small" />, shopWideOnly: true },
      { labelKey: 'menu.partners', fallback: 'คู่ค้า', href: '/portal/partners', icon: <PeopleRoundedIcon fontSize="small" /> },
    ],
  },
  {
    titleKey: 'menu.group_insights',
    fallback: 'รายงาน & ตั้งค่า',
    items: [
      { labelKey: 'menu.reports', fallback: 'รายงาน', href: '/portal/reports', icon: <InsightsRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.site_settings', fallback: 'ตั้งค่าระบบคิว', href: '/portal/site-settings', icon: <TuneRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.line_settings', fallback: 'เชื่อมต่อ LINE', href: '/portal/line-settings', icon: <ChatRoundedIcon fontSize="small" />, shopWideOnly: true },
      { labelKey: 'menu.settings', fallback: 'ข้อมูลคลัง', href: '/portal/settings', icon: <SettingsRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.translations', fallback: 'การแปลภาษา', href: '/portal/translations', icon: <TranslateRoundedIcon fontSize="small" />, shopWideOnly: true },
    ],
  },
];

type PortalNavProps = {
  /** Render icon-only rail with tooltips (desktop collapsed sidebar). */
  collapsed?: boolean;
  /** Called after a nav item is clicked — used to close the mobile drawer. */
  onNavigate?: () => void;
};

/**
 * Portal side navigation. Renders grouped menu items filtered by role and
 * branch scope. In collapsed mode only icons are shown with hover tooltips.
 */
export function PortalNav({ collapsed = false, onNavigate }: PortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { loading: branchScopeLoading, scope } = useBranchScope();
  // Until the scope is known, assume shop-wide so the menu does not flicker items away.
  const isBranchBound = !branchScopeLoading && scope === 'branch';

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.shopWideOnly || !isBranchBound),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Stack spacing={collapsed ? 1 : 2.2}>
      {visibleGroups.map((g, groupIdx) => (
        <Stack key={g.titleKey} spacing={0.4}>
          {collapsed ? (
            groupIdx > 0 ? <Divider sx={{ mx: 1.5, mb: 0.6 }} /> : null
          ) : (
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                mb: 0.3,
                fontWeight: 700,
                fontSize: 11,
                color: 'text.secondary',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {t(g.titleKey, g.fallback)}
            </Typography>
          )}
          <List dense disablePadding>
            {g.items.map(({ labelKey, fallback, href, icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const label = t(labelKey, fallback);
              const button = (
                <ListItemButton
                  key={href}
                  onClick={() => {
                    router.push(href);
                    onNavigate?.();
                  }}
                  selected={active}
                  aria-label={collapsed ? label : undefined}
                  sx={{
                    position: 'relative',
                    borderRadius: 2,
                    mb: 0.3,
                    transition: 'background-color .15s ease, color .15s ease',
                    ...(collapsed
                      ? { width: 44, height: 40, mx: 'auto', px: 0, justifyContent: 'center' }
                      : { py: { xs: 1.1, md: 0.75 }, pl: 1.5 }), // taller touch rows in the mobile drawer
                    '&::before': active
                      ? {
                          content: '""',
                          position: 'absolute',
                          left: collapsed ? 2 : 4,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 3,
                          height: 18,
                          borderRadius: 3,
                          bgcolor: 'primary.main',
                        }
                      : undefined,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 34,
                      justifyContent: 'center',
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500, noWrap: true }}
                    />
                  )}
                </ListItemButton>
              );
              return collapsed ? (
                <Tooltip key={href} title={label} placement="right" arrow enterDelay={300}>
                  {button}
                </Tooltip>
              ) : (
                button
              );
            })}
          </List>
        </Stack>
      ))}
      <Box sx={{ height: 8 }} />
    </Stack>
  );
}
