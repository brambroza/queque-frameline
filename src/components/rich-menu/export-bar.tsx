'use client';

import Link from 'next/link';
import { Alert, Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import { lineGreen } from '@/theme/tokens';
import type { BuilderState } from './rich-menu-types';
import { isDirty } from './rich-menu-types';

type Props = {
  state: BuilderState;
  onSave: () => void;
  onDownload: () => void;
  onUpload: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
};

function formatThaiDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Save / download / upload / publish actions + LINE publish status. */
export function ExportBar({ state, onSave, onDownload, onUpload, onPublish, onUnpublish }: Props) {
  const dirty = isDirty(state);
  const busy = state.busy !== null;
  const publishBlocked = !state.caps.has_token
    ? 'ต้องมี Channel Access Token — ตั้งค่าที่ LINE Settings'
    : !state.imageUrl
      ? 'กด "บันทึกรูปลงระบบ" ก่อน'
      : dirty
        ? 'บันทึกการตั้งค่าก่อนเผยแพร่'
        : null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Button variant="outlined" startIcon={<SaveRoundedIcon />} disabled={busy || !dirty} onClick={onSave}>
          {state.busy === 'save' ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
        </Button>
        <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={busy} onClick={onDownload}>
          {state.busy === 'export' ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด PNG'}
        </Button>
        <Button variant="outlined" startIcon={<CloudUploadRoundedIcon />} disabled={busy || dirty} onClick={onUpload}>
          {state.busy === 'upload' ? 'กำลังบันทึกรูป…' : 'บันทึกรูปลงระบบ'}
        </Button>
        <Tooltip title={publishBlocked ?? ''}>
          <span>
            <Button
              variant="contained"
              startIcon={<SendRoundedIcon />}
              disabled={busy || Boolean(publishBlocked)}
              onClick={onPublish}
              sx={{ bgcolor: lineGreen, '&:hover': { bgcolor: '#05b04b' } }}
            >
              {state.busy === 'publish' ? 'กำลังเผยแพร่…' : 'เผยแพร่ไป LINE'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {dirty ? <Alert severity="info">มีการแก้ไขที่ยังไม่ได้บันทึก — บันทึกการตั้งค่าก่อน จากนั้นบันทึกรูปลงระบบ แล้วจึงเผยแพร่</Alert> : null}

      <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>สถานะบน LINE OA</Typography>
        {!state.caps.has_token ? (
          <Alert severity="warning" action={<Button component={Link} href="/portal/line-settings" size="small">ตั้งค่า</Button>}>
            ยังไม่ได้ใส่ Channel Access Token — เผยแพร่อัตโนมัติไม่ได้ แต่ดาวน์โหลดไปอัปโหลดเองใน LINE OA Manager ได้
          </Alert>
        ) : state.lineRichMenuId ? (
          <Stack spacing={1}>
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              <Chip size="small" color="success" label="เผยแพร่แล้ว" />
              <Typography variant="body2">{state.publishedAt ? formatThaiDateTime(state.publishedAt) : ''}</Typography>
              <Chip size="small" variant="outlined" label={state.lineRichMenuId} sx={{ fontFamily: 'monospace', maxWidth: 260 }} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              เมนูนี้ตั้งเป็นเมนูเริ่มต้นให้ลูกค้าทุกคนแล้ว (เมนูที่สร้างผ่าน API จะไม่แสดงใน LINE OA Manager) — เผยแพร่ซ้ำเพื่อแทนที่
            </Typography>
            <Box>
              <Button size="small" color="inherit" startIcon={<LinkOffRoundedIcon />} disabled={busy} onClick={onUnpublish}>
                {state.busy === 'unpublish' ? 'กำลังยกเลิก…' : 'ยกเลิกการเผยแพร่'}
              </Button>
            </Box>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            พร้อมเผยแพร่ — ยังไม่มี Rich Menu จากระบบบน OA นี้ {state.imageUrl ? '' : '(ต้องบันทึกรูปลงระบบก่อน)'}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
