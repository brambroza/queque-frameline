'use client';

import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';

type ChatRow = {
  id: string;
  direction: 'customer' | 'bot' | 'system';
  message_text: string;
  created_at: string;
};

export function MockLineSimulator({
  chats,
  onQuickReply,
  onSendMock,
}: {
  chats: ChatRow[];
  onQuickReply: (key: 'available' | 'book' | 'my_queue' | 'contact') => Promise<void>;
  onSendMock: (text: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [customText, setCustomText] = useState('');

  async function clickQuick(key: 'available' | 'book' | 'my_queue' | 'contact') {
    setBusy(true);
    try {
      await onQuickReply(key);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>Mock LINE Chat</Typography>
          <Chip label="Demo only" size="small" color="warning" />
        </Stack>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: '#f7f8fa',
            minHeight: 260,
            maxHeight: 340,
            overflowY: 'auto',
          }}
        >
          <Stack spacing={1}>
            {chats.map((c) => (
              <Box
                key={c.id}
                sx={{
                  alignSelf: c.direction === 'customer' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  px: 1.2,
                  py: 0.9,
                  borderRadius: 2,
                  bgcolor: c.direction === 'customer' ? '#d9fdd3' : c.direction === 'system' ? '#eef2f8' : '#fff',
                  border: '1px solid',
                  borderColor: c.direction === 'customer' ? '#b5e3ad' : '#e3e8ef',
                }}
              >
                <Typography variant="body2">{c.message_text}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" mt={1.5}>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void clickQuick('available')}>คิวว่างวันนี้</Button>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void clickQuick('book')}>จองคิว</Button>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void clickQuick('my_queue')}>เช็คคิวของฉัน</Button>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void clickQuick('contact')}>ติดต่อร้าน</Button>
        </Stack>

        <Stack direction="row" spacing={1} mt={1.5}>
          <TextField
            size="small"
            fullWidth
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="ข้อความ mock เพิ่มเติม"
          />
          <Button
            variant="contained"
            disabled={busy || customText.trim().length < 2}
            onClick={() => {
              const text = customText.trim();
              setCustomText('');
              setBusy(true);
              void onSendMock(text).finally(() => setBusy(false));
            }}
          >
            ส่ง
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
