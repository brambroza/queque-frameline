'use client';

import { useI18n } from '@/components/i18n/i18n-provider';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import { IconButton, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function toPublicLocalizedPath(pathname: string, nextLang: 'th' | 'en') {
  const isEnPath = pathname === '/en' || pathname.startsWith('/en/');
  if (nextLang === 'en') {
    if (isEnPath) return pathname;
    if (pathname === '/') return '/en';
    return `/en${pathname}`;
  }
  if (!isEnPath) return pathname;
  const stripped = pathname.replace(/^\/en/, '');
  return stripped || '/';
}

export function LanguageSwitch() {
  const { lang, setLang, languages } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const open = Boolean(anchorEl);

  const options = useMemo(
    () => (languages.length ? languages : [{ code: 'th', name: 'ไทย' }, { code: 'en', name: 'English' }]),
    [languages],
  );

  const active = options.find((l) => l.code === lang) ?? { code: lang, name: lang.toUpperCase() };
  const flag = active.code === 'en' ? '🇬🇧' : '🇹🇭';

  return (
    <>
      <Tooltip title={`Language: ${String(active.code).toUpperCase()}`}>
        <IconButton
          aria-label="Switch language"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{flag}</span>
          <TranslateRoundedIcon sx={{ ml: 0.5, fontSize: 16, color: 'text.secondary' }} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {options.map((l) => (
          <MenuItem
            key={String(l.code)}
            selected={l.code === lang}
            onClick={() => {
              const nextLang = ((l.code as 'th' | 'en') ?? 'th');
              setLang(nextLang);

              // Public pages are language-routed (/ and /en/*).
              // Portal/admin pages remain same route and use dictionary switching.
              if (!pathname.startsWith('/portal')) {
                const localizedPath = toPublicLocalizedPath(pathname, nextLang);
                const suffix = typeof window !== 'undefined' ? `${window.location.search}${window.location.hash}` : '';
                if (localizedPath !== pathname || suffix) {
                  router.push(`${localizedPath}${suffix}`);
                }
              }
              setAnchorEl(null);
            }}
          >
            <span style={{ marginRight: 8 }}>{l.code === 'en' ? '🇬🇧' : '🇹🇭'}</span>
            <ListItemText primary={`${String(l.code).toUpperCase()} - ${l.native_name || l.name}`} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
