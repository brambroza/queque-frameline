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
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/i18n-provider';
import { useBranchScope } from '@/components/layout/branch-scope-provider';

import { useMenuAccess } from '@/components/layout/access-provider';
import { MENU_GROUPS, MENU_ITEMS, type MenuKey } from '@/lib/auth/menu-registry';

/** Sidebar icon per menu key; labels, hrefs and grouping live in the registry. */
const MENU_ICONS: Record<MenuKey, React.ReactNode> = {
  dashboard: <DashboardRoundedIcon fontSize="small" />,
  dock_queues: <EventNoteRoundedIcon fontSize="small" />,
  documents: <DescriptionRoundedIcon fontSize="small" />,
  calendar: <CalendarMonthRoundedIcon fontSize="small" />,
  queue_board: <ViewKanbanRoundedIcon fontSize="small" />,
  queue_display: <TvRoundedIcon fontSize="small" />,
  notifications: <NotificationsRoundedIcon fontSize="small" />,
  branches: <StoreRoundedIcon fontSize="small" />,
  vehicle_types: <DesignServicesRoundedIcon fontSize="small" />,
  docks: <TableRestaurantRoundedIcon fontSize="small" />,
  working_hours: <ScheduleRoundedIcon fontSize="small" />,
  holidays: <EventBusyRoundedIcon fontSize="small" />,
  staff: <GroupRoundedIcon fontSize="small" />,
  partners: <PeopleRoundedIcon fontSize="small" />,
  reports: <InsightsRoundedIcon fontSize="small" />,
  site_settings: <TuneRoundedIcon fontSize="small" />,
  line_settings: <ChatRoundedIcon fontSize="small" />,
  api_keys: <KeyRoundedIcon fontSize="small" />,
  settings: <SettingsRoundedIcon fontSize="small" />,
  translations: <TranslateRoundedIcon fontSize="small" />,
};

/** Screens that are shop-wide admin — hidden from users bound to specific branches. */
const SHOP_WIDE_ONLY: MenuKey[] = ['branches', 'staff', 'line_settings', 'translations'];

type PortalNavProps = {
  /** Render icon-only rail with tooltips (desktop collapsed sidebar). */
  collapsed?: boolean;
  /** Called after a nav item is clicked — used to close the mobile drawer. */
  onNavigate?: () => void;
};

/**
 * Portal side navigation. Renders the menu registry filtered by the user's role
 * menus and branch scope. In collapsed mode only icons are shown with hover tooltips.
 */
export function PortalNav({ collapsed = false, onNavigate }: PortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { loading: branchScopeLoading, scope } = useBranchScope();
  // Until the scope is known, assume shop-wide so the menu does not flicker items away.
  const isBranchBound = !branchScopeLoading && scope === 'branch';
  const { can } = useMenuAccess();

  const visibleGroups = MENU_GROUPS
    .map((g) => ({
      ...g,
      items: MENU_ITEMS
        .filter((it) => it.group === g.key && can(it.key) && (!SHOP_WIDE_ONLY.includes(it.key) || !isBranchBound))
        .map((it) => ({ ...it, icon: MENU_ICONS[it.key] })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Stack spacing={collapsed ? 1 : 2.2}>
      {visibleGroups.map((g, groupIdx) => (
        <Stack key={g.key} spacing={0.4}>
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
