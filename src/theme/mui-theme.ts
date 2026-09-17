import { createTheme, type Theme } from '@mui/material/styles';
import {
  brand,
  neutral,
  status,
  radius,
  shadowLight,
  shadowDark,
  lightSurface,
  darkSurface,
  type ColorMode,
} from './tokens';

/**
 * สร้าง MUI theme ตามโหมดสี (light/dark)
 * component overrides ทำครั้งเดียวที่นี่ ให้ทั้งระบบดูพรีเมียมและสม่ำเสมอ
 */
export function createAppTheme(mode: ColorMode): Theme {
  const isDark = mode === 'dark';
  const surface = isDark ? darkSurface : lightSurface;
  const shadow = isDark ? shadowDark : shadowLight;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? brand[400] : brand[500],
        light: isDark ? brand[300] : brand[400],
        dark: isDark ? brand[500] : brand[700],
        contrastText: isDark ? '#04140c' : '#ffffff',
      },
      success: { main: status.success },
      warning: { main: status.warning },
      error: { main: status.error },
      info: { main: status.info },
      background: { default: surface.bg, paper: surface.paper },
      text: { primary: surface.text, secondary: surface.textSecondary },
      divider: surface.divider,
      ...(isDark
        ? {}
        : {
            grey: neutral as unknown as Record<string, string>,
          }),
    },
    shape: { borderRadius: radius.md },
    typography: {
      fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
      h1: { fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 },
      h2: { fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.18 },
      h3: { fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 },
      h4: { fontWeight: 700, letterSpacing: '-0.01em' },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: 'none' },
      caption: { letterSpacing: '0.01em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: { backgroundColor: surface.bg, color: surface.text },
          '::selection': {
            backgroundColor: isDark ? 'rgba(46,195,124,0.35)' : 'rgba(18,168,98,0.18)',
          },
          // scrollbar ให้เข้ากับโทน
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(16,24,40,0.18)',
            borderRadius: 8,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '*::-webkit-scrollbar-thumb:hover': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(16,24,40,0.28)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            fontWeight: 600,
            paddingInline: 18,
            paddingBlock: 8,
            boxShadow: 'none',
          },
          sizeSmall: { paddingInline: 12, paddingBlock: 5 },
          sizeLarge: { paddingInline: 24, paddingBlock: 11, fontSize: 15 },
          containedPrimary: {
            boxShadow: shadow.brand,
            '&:hover': { boxShadow: shadow.brand },
          },
          outlined: { borderColor: surface.divider },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: radius.md } },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: radius.lg,
            border: `1px solid ${surface.divider}`,
            backgroundImage: 'none',
            boxShadow: shadow.sm,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: radius.md },
          outlined: { borderColor: surface.divider },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none', boxShadow: 'none' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: 'none', borderColor: surface.divider },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: radius.sm },
          sizeSmall: { height: 22 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            '&.Mui-selected': {
              backgroundColor: surface.selected,
              color: isDark ? brand[300] : brand[600],
              '&:hover': { backgroundColor: surface.selected },
            },
            '&:hover': { backgroundColor: surface.hover },
          },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.md,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : neutral[0],
            '& .MuiOutlinedInput-notchedOutline': { borderColor: surface.divider },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? brand[400] : brand[400],
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: surface.divider },
          head: {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : neutral[50],
            fontWeight: 700,
            color: surface.textSecondary,
            fontSize: 12,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: { borderRadius: radius.lg },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: radius.sm,
            backgroundColor: isDark ? neutral[700] : neutral[900],
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 10px',
          },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: surface.divider } },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: radius.md } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: radius.md,
            border: `1px solid ${surface.divider}`,
            boxShadow: shadow.lg,
          },
        },
      },
    },
  });
}

/** ธีม light เริ่มต้น (backward-compat) */
export const muiTheme = createAppTheme('light');
