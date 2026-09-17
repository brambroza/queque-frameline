'use client';

import { Box, ThemeProvider } from '@mui/material';
import { muiTheme } from '@/theme/mui-theme';
import type { ReportData } from '@/types/reports';
import { ReportDocument } from './report-document';

/** Element id the print stylesheet keys on (see `globals.css`). */
export const REPORT_PRINT_ROOT_ID = 'report-print-root';

/**
 * Print portal content: the same `ReportDocument` the screen shows, forced
 * into the light theme so a dark-mode session still prints black on white.
 */
export function ReportPrintSheet({ data }: { data: ReportData }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <Box id={REPORT_PRINT_ROOT_ID} sx={{ bgcolor: '#fff', color: '#0f172a', width: '100%', maxWidth: 780, mx: 'auto' }}>
        <ReportDocument data={data} print />
      </Box>
    </ThemeProvider>
  );
}
