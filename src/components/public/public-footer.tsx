import Link from 'next/link';
import { Box, Container, Grid, Stack, Typography } from '@mui/material';

export function PublicFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        py: 6,
        mt: 8,
        bgcolor: 'background.paper',
        '& a': {
          color: 'text.secondary',
          textDecoration: 'none',
          fontSize: 14,
          transition: 'color .15s ease',
        },
        '& a:hover': { color: 'primary.main' },
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="h6" fontWeight={800}>QueueBooking LINE</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>ระบบจองคิวผ่าน LINE OA สำหรับธุรกิจบริการทุกประเภท</Typography>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Stack spacing={1}>
              <Typography fontWeight={700}>เมนู</Typography>
              <Link href="/">หน้าแรก</Link>
              <Link href="/use-cases">ตัวอย่างการใช้งาน</Link>
              <Link href="/features/promptpay-payment">QR Payment</Link>
              <Link href="/blog">บทความ</Link>
              <Link href="/pricing">ราคา</Link>
              <Link href="/contact">ติดต่อเรา</Link>
            </Stack>
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Stack spacing={1}>
              <Typography fontWeight={700}>บัญชี</Typography>
              <Link href="/login">Login</Link>
              <Link href="/register">Register</Link>
              <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
              <Link href="/terms">ข้อกำหนดการใช้บริการ</Link>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1}>
              <Typography fontWeight={700}>ติดต่อ</Typography>
              <Typography variant="body2">Email: amnart.gl@gmail.com</Typography>
              <Typography variant="body2">Phone: 085-608-3298</Typography>
              <Typography variant="body2">LINE OA: @queuebooking</Typography>
            </Stack>
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block' }}>
          © {new Date().getFullYear()} QueueBooking by{' '}
          <Link href="https://goalong.co.th/" target="_blank" rel="noopener noreferrer">
            <Box component="span" sx={{ fontWeight: 700 }}>GO Along Co., Ltd.</Box>
          </Link>
        </Typography>
      </Container>
    </Box>
  );
}
