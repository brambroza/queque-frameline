'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { CopyField } from '@/components/ui/copy-field';
import { ALL_BRANCHES, displayBranchKey, displayPath } from '@/lib/display/branch';

type BranchRow = { id: string; code: string | null; branch_name: string };

/** One TV link: the URL to copy plus a button that opens it in a new tab. */
function LinkRow({ label, hint, origin, path, keyHint }: { label: string; hint?: string; origin: string; path: string; keyHint: string }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <CopyField label={label} value={`${origin}${path}${keyHint}`} hint={hint} />
      </Box>
      <Button size="small" variant="outlined" component="a" href={path} target="_blank" rel="noreferrer" startIcon={<OpenInNewRoundedIcon />} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'center' } }}>
        เปิดจอ
      </Button>
    </Stack>
  );
}

/**
 * Yard TV links, one per branch the signed-in user may see: each TV shows only
 * its own branch's docks and queue.
 *
 * @param base `NEXT_PUBLIC_APP_URL` without a trailing slash ('' = use the current origin).
 * @param needsKey `DISPLAY_KEY` is set, so every URL also needs `key=`.
 */
export function QueueDisplayLinks({ base, needsKey }: { base: string; needsKey: boolean }) {
  const { scope } = useBranchScope();
  const [rows, setRows] = useState<BranchRow[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/branches?active=true&page_size=100', { cache: 'no-store' });
      const json = (await res.json()) as { data?: BranchRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'โหลดรายชื่อสาขาไม่สำเร็จ');
      setRows([...(json.data ?? [])].sort((a, b) => a.branch_name.localeCompare(b.branch_name, 'th')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายชื่อสาขาไม่สำเร็จ');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
  const keyHint = needsKey ? '&key=…' : '';

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>URL สำหรับทีวี — แยกตามสาขา</Typography>

          {error ? (
            <Alert severity="error" action={<Button size="small" onClick={() => void load()}>ลองใหม่</Button>}>{error}</Alert>
          ) : rows === null ? (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" height={40} />
              <Skeleton variant="rounded" height={40} />
            </Stack>
          ) : rows.length === 0 ? (
            <Alert severity="info">ยังไม่มีสาขาที่เปิดใช้งาน — เพิ่มสาขาและท่าก่อน แล้วลิงก์ของแต่ละสาขาจะแสดงที่นี่</Alert>
          ) : (
            <Stack spacing={2}>
              {rows.map((b) => (
                <LinkRow key={b.id} label={b.branch_name} hint={b.code ? undefined : 'สาขานี้ยังไม่มีรหัส — ตั้งรหัสสาขาเพื่อให้ URL สั้นและอ่านง่าย'} origin={origin} path={displayPath(displayBranchKey(b))} keyHint={keyHint} />
              ))}
              {scope === 'shop' && rows.length > 1 ? (
                <LinkRow label="ทุกสาขาในจอเดียว" hint="สำหรับห้องควบคุม — ไม่ควรใช้กับทีวีหน้าลาน" origin={origin} path={displayPath(ALL_BRANCHES)} keyHint={keyHint} />
              ) : null}
            </Stack>
          )}

          <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', fontSize: 14, '& li': { mb: 0.5 } }}>
            <li>แต่ละจอแสดงเฉพาะท่าและคิวของสาขาตัวเอง — เปิด /display โดยไม่ระบุสาขา จะให้เลือกสาขาก่อน (มีสาขาเดียว = แสดงสาขานั้นเลย)</li>
            <li>อัปเดตทุก 5 วินาที ไม่ต้องล็อกอิน</li>
            <li>แตะหน้าจอ 1 ครั้งหลังเปิด เพื่ออนุญาตเสียงเรียกคิว (ข้อกำหนดของเบราว์เซอร์)</li>
            <li>แสดงเลขคิว ทะเบียนรถ (ตามรูปแบบของประเภทรถ) ประเภทรถ เวลานัด เลข SO/PO ชื่อลูกค้า ชื่อคนขับ ท่า และเลข DO — ไม่แสดงเบอร์โทร</li>
            <li>{needsKey ? 'ตั้งค่า DISPLAY_KEY ไว้แล้ว: แทน … หลัง key= ด้วยค่าใน env (ปุ่ม “เปิดจอ” ไม่ได้ใส่ key ให้)' : 'ต้องการจำกัดการเข้าถึง: ตั้ง env DISPLAY_KEY แล้วเติม &key=ค่านั้น ต่อท้าย URL'}</li>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
