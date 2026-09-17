'use client';

import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';

export default function RichMenuGuidePage() {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={800}>Rich Menu Guide</Typography>
        <Typography variant="body2" color="text.secondary">
          คู่มือสร้าง Rich Menu สำหรับ LINE OA เพื่อเชื่อมเข้าระบบจองคิว
        </Typography>
      </Box>

      <Alert
        severity="info"
        action={<Button component={Link} href="/portal/rich-menu" color="inherit" size="small">สร้างอัตโนมัติ</Button>}
      >
        แนะนำให้สร้างอย่างน้อย 4 ปุ่ม: จองคิว, เช็คคิว, ข้อมูลบริการ, ติดต่อร้าน — หรือให้ระบบสร้างภาพและเผยแพร่ให้ตามประเภทธุรกิจ
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>Recommended Rich Menu Layout</Typography>
              <List dense>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="ปุ่ม 1: จองคิว"
                    secondary={`ลิงก์: ${appUrl}/liff/{shopKey}`}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="ปุ่ม 2: เช็คคิวของฉัน"
                    secondary={`ลิงก์: ${appUrl}/liff/{shopKey}/member`}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="ปุ่ม 3: บริการของเรา"
                    secondary="ลิงก์: เว็บไซต์ร้าน หรือหน้าแนะนำบริการ"
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    primary="ปุ่ม 4: ติดต่อร้าน"
                    secondary="Action: ส่งข้อความหาแอดมิน หรือเปิดฟอร์มติดต่อ"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>Checklist ก่อนเปิดใช้งาน</Typography>
              <List dense>
                <ListItem sx={{ px: 0 }}><ListItemText primary="กำหนดช่วงเวลาแสดง Rich Menu แล้ว" /></ListItem>
                <ListItem sx={{ px: 0 }}><ListItemText primary="ผูกลิงก์ LIFF จองคิวเรียบร้อย" /></ListItem>
                <ListItem sx={{ px: 0 }}><ListItemText primary="ผูกลิงก์ LIFF member/check queue เรียบร้อย" /></ListItem>
                <ListItem sx={{ px: 0 }}><ListItemText primary="ทดสอบในมือถือจริง 1 รอบ" /></ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>คู่มือฉบับเต็ม</Typography>
              <Typography variant="body2" color="text.secondary">อ่านขั้นตอนแบบภาพประกอบทั้งหมด</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component={Link} href="/blog" variant="outlined" startIcon={<MenuBookRoundedIcon />}>
                เปิดบทความ
              </Button>
              <Button component={Link} href="/docs/line-setup-guide.pdf" target="_blank" variant="contained" startIcon={<OpenInNewRoundedIcon />}>
                เปิด PDF
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button component={Link} href="/portal/onboarding/line-setup" variant="outlined">กลับไป LINE Setup</Button>
        <Button component={Link} href="/portal/line-settings" variant="contained">ไปหน้า LINE Settings</Button>
      </Stack>
    </Stack>
  );
}

