'use client';

import { useEffect, useMemo, useState } from 'react';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, Button, CircularProgress, Divider, ListItemText, Menu, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { useI18n } from '@/components/i18n/i18n-provider';

type ShopOption = { id: string; name: string | null; shop_key: string | null };

type ActiveShopResponse = { data?: { shops?: ShopOption[]; current_shop_id?: string | null }; error?: string };

/** Menus longer than this get a search box on top. */
const SEARCH_THRESHOLD = 6;

/**
 * Topbar shop selector for a global super_admin.
 *
 * The choice is stored server-side in the acting-shop cookie, then the page is
 * reloaded on its bare pathname so every provider (branch scope, notifications,
 * subscription) re-fetches for the new shop and no `?branch_id=` from the previous
 * shop lingers. Render only when the caller is a super_admin — the endpoint 403s
 * everyone else.
 */
export function ShopSwitch({ activeShopId }: { activeShopId: string | null }) {
  const { t } = useI18n();
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(activeShopId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/active-shop', { cache: 'no-store' });
        const json = (await res.json()) as ActiveShopResponse;
        if (cancelled || !res.ok) return;
        setShops(json.data?.shops ?? []);
        setCurrentId(json.data?.current_shop_id ?? null);
      } catch {
        // Selector stays empty; the rest of the shell still works.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(() => shops.find((s) => s.id === currentId) ?? null, [shops, currentId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) => (s.name ?? '').toLowerCase().includes(q) || (s.shop_key ?? '').toLowerCase().includes(q));
  }, [shops, search]);

  const close = () => {
    setAnchorEl(null);
    setSearch('');
  };

  /** Persist the choice then hard-reload on the bare pathname. */
  const select = async (shopId: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/active-shop', {
        method: shopId ? 'POST' : 'DELETE',
        headers: shopId ? { 'Content-Type': 'application/json' } : undefined,
        body: shopId ? JSON.stringify({ shop_id: shopId }) : undefined,
      });
      if (!res.ok) {
        setBusy(false);
        return;
      }
      window.location.assign(window.location.pathname);
    } catch {
      setBusy(false);
    }
  };

  const pickLabel = t('menu.shop_selector_pick', 'เลือกร้าน');

  if (loading) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {t('menu.shop_selector', 'เลือกร้าน')}
        </Typography>
        <Skeleton height={28} sx={{ width: { xs: 120, sm: 160 } }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
        {t('menu.shop_selector', 'เลือกร้าน')}
      </Typography>
      <Box>
        <Button
          size="small"
          variant="outlined"
          color={current ? 'primary' : 'warning'}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <BusinessRoundedIcon />}
          endIcon={<ExpandMoreRoundedIcon />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
          sx={{ borderRadius: 999, textTransform: 'none', whiteSpace: 'nowrap', maxWidth: { xs: 150, sm: 260 }, fontWeight: 700 }}
        >
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.name || pickLabel}</Box>
        </Button>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: { xs: 240, sm: 280 },
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: { xs: '60vh', sm: 420 },
            },
          },
        }}
      >
        {shops.length > SEARCH_THRESHOLD ? (
          <Box sx={{ px: 1.5, pt: 0.5, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t('menu.shop_selector_search', 'ค้นหาร้าน')}
              inputProps={{ 'aria-label': t('menu.shop_selector_search', 'ค้นหาร้าน') }}
            />
          </Box>
        ) : null}

        {filtered.length === 0 ? (
          <MenuItem disabled>
            <ListItemText primary={t('menu.shop_selector_empty', 'ไม่พบร้าน')} />
          </MenuItem>
        ) : (
          filtered.map((s) => (
            <MenuItem
              key={s.id}
              selected={s.id === currentId}
              onClick={() => {
                close();
                void select(s.id);
              }}
            >
              <ListItemText primary={s.name || s.shop_key || s.id} secondary={s.shop_key ?? undefined} />
            </MenuItem>
          ))
        )}

        {currentId ? <Divider /> : null}
        {currentId ? (
          <MenuItem
            onClick={() => {
              close();
              void select(null);
            }}
          >
            <ListItemText primary={t('menu.shop_selector_clear', 'ล้างการเลือก')} />
          </MenuItem>
        ) : null}
      </Menu>
    </Box>
  );
}
