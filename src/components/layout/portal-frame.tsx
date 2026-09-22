'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Avatar,
  Box,
  Breadcrumbs,
  Container,
  Drawer,
  IconButton,
  Link as MLink,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { PortalNav } from '@/components/layout/portal-nav';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { NotificationsMenu } from '@/components/layout/notifications-menu';
import { TopbarUserMenu } from '@/components/layout/topbar-user-menu';
import { AccessProvider } from '@/components/layout/access-provider';
import type { MenuAccess } from '@/lib/auth/menu-registry';
import { BranchScopeProvider } from '@/components/layout/branch-scope-provider';
import { BranchSwitch } from '@/components/layout/branch-switch';
import {
  SIDEBAR_MINI_WIDTH,
  SIDEBAR_WIDTH,
  SidebarCollapseProvider,
  useSidebarCollapse,
} from '@/components/layout/sidebar-collapse-context';
import { useI18n } from '@/components/i18n/i18n-provider';
import { PORTAL_APPBAR_HEIGHT_VAR } from '@/components/layout/sticky-offset';

/** Shared width/margin transition for the desktop sidebar and app bar. */
const sidebarTransition = (theme: Theme) =>
  theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  });

function titleFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  return parts.map((p) => p.replace(/-/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()));
}

type PortalFrameProps = {
  children: React.ReactNode;
  logoUrl: string | null;
  shopName?: string | null;
  fullName?: string | null;
  email?: string | null;
  appVersion: string;
  /** Menu access resolved by the server layout. */
  access: MenuAccess;
};

/**
 * Portal shell: app bar, responsive sidebar (mobile drawer / desktop
 * collapsible rail) and page container. Wraps children with the providers
 * the portal pages depend on.
 */
export function PortalFrame(props: PortalFrameProps) {
  return (
    <AccessProvider value={props.access}>
      <BranchScopeProvider>
        <SidebarCollapseProvider>
          <PortalFrameInner {...props} />
        </SidebarCollapseProvider>
      </BranchScopeProvider>
    </AccessProvider>
  );
}

/** Shared look for the small square button in the sidebar header (collapse / close). */
const sidebarHeaderButtonSx = {
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.secondary',
  boxShadow: (theme: Theme) => (theme.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(15,23,42,0.06)'),
  transition: (theme: Theme) =>
    theme.transitions.create(['background-color', 'color', 'border-color', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
  '&:hover': {
    bgcolor: 'primary.main',
    borderColor: 'primary.main',
    color: 'primary.contrastText',
    boxShadow: (theme: Theme) => `0 6px 16px ${theme.palette.primary.main}40`,
  },
} as const;

/**
 * Sidebar content (shop header + navigation + collapse toggle).
 * `collapsed` is only ever true inside the desktop permanent drawer.
 * `onClose` is only passed by the mobile temporary drawer and renders a close
 * button in the same slot the desktop collapse toggle occupies.
 */
function SidebarContent({
  logoUrl,
  shopName,
  collapsed,
  onNavigate,
  onToggle,
  toggleLabel,
  onClose,
}: {
  logoUrl: string | null;
  shopName?: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
  toggleLabel?: string;
  onClose?: () => void;
}) {
  const { t } = useI18n();

  const closeButton = !onToggle && onClose ? (
    <IconButton size="small" onClick={onClose} aria-label={t('common.close', 'ปิด')} sx={sidebarHeaderButtonSx}>
      <CloseRoundedIcon fontSize="small" />
    </IconButton>
  ) : null;

  const toggleButton = onToggle ? (
    <Tooltip title={toggleLabel ?? ''} placement="right" arrow>
      <IconButton
        size="small"
        onClick={onToggle}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        sx={{
          ...sidebarHeaderButtonSx,
          '& .MuiSvgIcon-root': {
            transition: (theme) => theme.transitions.create('transform', { duration: theme.transitions.duration.standard }),
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
          },
        }}
      >
        <ChevronLeftRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : null;

  return (
    <Box
      data-tour="portal-nav"
      sx={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', p: collapsed ? 1 : 2 }}
    >
      <Stack
        direction={collapsed ? 'column' : 'row'}
        spacing={collapsed ? 1 : 1.3}
        alignItems="center"
        sx={{
          mb: collapsed ? 1.5 : 2.5,
          p: collapsed ? 0.8 : 1.2,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(18,168,98,0.05)'),
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Shop Logo" width={38} height={38} className="rounded-[10px] object-cover" style={{ border: '1px solid var(--line)', flexShrink: 0 }} />
        ) : (
          <Avatar
            variant="rounded"
            sx={{
              width: 38,
              height: 38,
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
            }}
          >
            QB
          </Avatar>
        )}
        {!collapsed && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>{t('menu.portal')}</Typography>
            <Typography fontWeight={800} lineHeight={1.25} noWrap>{shopName || 'Queue Booking'}</Typography>
          </Box>
        )}
        {toggleButton ?? closeButton}
      </Stack>
      <PortalNav collapsed={collapsed} onNavigate={onNavigate} />
    </Box>
  );
}

function PortalFrameInner({
  children,
  logoUrl,
  shopName,
  fullName,
  email,
  appVersion,
}: PortalFrameProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const crumbs = useMemo(() => titleFromPath(pathname), [pathname]);
  const { t } = useI18n();
  const { collapsed, toggle } = useSidebarCollapse();
  const appBarRef = useRef<HTMLDivElement | null>(null);

  // Publish the live app bar height so sticky cards in pages can pin below it
  // (see `stickyBelowAppBar`). The bar grows on phones when the title wraps.
  useLayoutEffect(() => {
    const el = appBarRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty(PORTAL_APPBAR_HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(PORTAL_APPBAR_HEIGHT_VAR);
    };
  }, []);

  const desktopWidth = collapsed ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;
  // Inline fallbacks: the DB dictionary replaces fallback.ts wholesale, so a
  // key not yet seeded there would otherwise surface as the raw key string.
  const toggleLabel = collapsed ? t('menu.sidebar_expand', 'ขยายเมนู') : t('menu.sidebar_collapse', 'ย่อเมนู');

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
        bgcolor: 'background.default',
      }}
    >
      <Box component="nav" sx={{ width: { md: desktopWidth }, flexShrink: { md: 0 }, transition: sidebarTransition }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, maxWidth: '85vw', pb: 'env(safe-area-inset-bottom)' },
          }}
        >
          <SidebarContent
            logoUrl={logoUrl}
            shopName={shopName}
            collapsed={false}
            onNavigate={() => setOpen(false)}
            onClose={() => setOpen(false)}
          />
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: desktopWidth,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              borderRight: '1px solid',
              borderColor: 'divider',
              transition: sidebarTransition,
            },
          }}
        >
          <SidebarContent
            logoUrl={logoUrl}
            shopName={shopName}
            collapsed={collapsed}
            onToggle={toggle}
            toggleLabel={toggleLabel}
          />
        </Drawer>
      </Box>

      {/*
        Content column. The AppBar is `sticky` inside this column so the page
        offset always equals its real height (it grows on phones when the shop
        name / breadcrumbs wrap). Do not put `overflow` on this Box or the root
        Box — that would turn it into a scroll container and break `sticky`.
      */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          ref={appBarRef}
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(20,26,36,0.82)' : 'rgba(255,255,255,0.85)'),
            backdropFilter: 'blur(10px)',
            pt: 'env(safe-area-inset-top)',
          }}
        >
          <Toolbar sx={{ minHeight: 72 }}>
            <IconButton
              sx={{ display: { md: 'none' }, mr: 1 }}
              onClick={() => setOpen(true)}
              aria-label={t('menu.open_menu', 'เปิดเมนู')}
            >
              <MenuRoundedIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {t('menu.shop_selector')}
              </Typography>
              <Typography variant="body2" fontWeight={700} noWrap>{shopName ? `${shopName}  ` : '-'}</Typography>
              <Breadcrumbs
                aria-label="breadcrumb"
                sx={{
                  mt: 0.2,
                  '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
                  '& .MuiBreadcrumbs-li': { minWidth: 0 },
                }}
              >
                <MLink underline="hover" color="inherit" href="/portal/dashboard" noWrap>{t('menu.portal')}</MLink>
                {crumbs.map((c, idx) => (
                  <Typography
                    key={`${c}-${idx}`}
                    color={idx === crumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                    variant="caption"
                    noWrap
                  >
                    {c}
                  </Typography>
                ))}
              </Breadcrumbs>
            </Box>
            {/* `useFlexGap` so the `display: contents` wrapper below still gets even spacing between its children. */}
            <Stack data-tour="portal-toolbar" direction="row" spacing={{ xs: 0.5, md: 1.2 }} alignItems="center" useFlexGap>
              <BranchSwitch />
              {/* Hidden on phones — the same toggles live in the profile drawer (TopbarUserMenu). */}
              <Box sx={{ display: { xs: 'none', sm: 'contents' } }}>
                <LanguageSwitch />
              </Box>
              <NotificationsMenu />
              <TopbarUserMenu initialName={fullName} email={email} appVersion={appVersion} />
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" data-tour="page-content" sx={{ pt: { xs: 1.5, md: '15px' }, pb: 4 }}>
          <Container maxWidth="xl">
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
