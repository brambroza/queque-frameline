'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Avatar, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { FlexBookingSuccess } from '@/components/demo/flex-booking-success';
import { FlexPaymentPaid, FlexPaymentRequest } from '@/components/demo/flex-payment-request';
import { QuickReplyBar } from '@/components/demo/quick-reply-bar';
import { DemoFlexCarousel } from '@/components/demo/demo-flex-carousel';
import type { ChatMessage, DemoMemberProfile } from '@/components/demo/line-demo-types';

function Bubble({ msg, memberProfile }: { msg: ChatMessage; memberProfile: DemoMemberProfile }) {
  if (msg.type === 'flex_booking_success' && msg.booking) {
    return (
      <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ maxWidth: '100%' }}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: '#fff' }}>◀</Avatar>
        <FlexBookingSuccess booking={msg.booking} />
      </Stack>
    );
  }

  if ((msg.type === 'flex_payment_request' || msg.type === 'flex_payment_paid') && msg.booking) {
    return (
      <Stack direction="row" spacing={1.2} alignItems="flex-start" sx={{ maxWidth: '100%' }}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: '#fff' }}>◀</Avatar>
        {msg.type === 'flex_payment_request'
          ? <FlexPaymentRequest booking={msg.booking} />
          : <FlexPaymentPaid booking={msg.booking} />}
      </Stack>
    );
  }

  if (msg.type === 'member_profile') {
    return (
      <Box sx={{ alignSelf: 'flex-start', maxWidth: '88%', borderRadius: 2.5, px: 1.4, py: 1.2, bgcolor: '#252a33', color: '#e6edf7', border: '1px solid #313741' }}>
        <Typography sx={{ fontWeight: 800 }}>ข้อมูลสมาชิก</Typography>
        <Typography sx={{ fontSize: 14 }}>ชื่อ: {memberProfile.name}</Typography>
        <Typography sx={{ fontSize: 14 }}>เบอร์: {memberProfile.phone}</Typography>
        <Typography sx={{ fontSize: 14 }}>ระดับ: {memberProfile.tier}</Typography>
        <Typography sx={{ fontSize: 14 }}>แต้มสะสม: {memberProfile.points}</Typography>
        <Typography sx={{ fontSize: 14 }}>จำนวนการจอง: {memberProfile.totalBookings}</Typography>
        <Typography sx={{ fontSize: 14 }}>คิวล่าสุด: {memberProfile.lastQueueNo ?? '-'}</Typography>
      </Box>
    );
  }

  if (msg.type === 'promo') {
    return (
      <Box sx={{ alignSelf: 'flex-start', width: '92%', borderRadius: 2.5, bgcolor: '#1f252d', border: '1px solid #2f3640', overflow: 'hidden', p: 1.1 }}>
        <Typography sx={{ color: '#9ce0b4', fontWeight: 800, mb: 0.8 }}>โปรโมชั่นแนะนำ</Typography>
        <DemoFlexCarousel cards={msg.promos ?? []} />
      </Box>
    );
  }

  const isCustomer = msg.role === 'customer';
  return (
    <Stack sx={{ alignSelf: isCustomer ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
      <Box
        sx={{
          px: 1.4,
          py: 1.1,
          borderRadius: 2.5,
          bgcolor: isCustomer ? '#12a862' : '#252a33',
          color: isCustomer ? '#fff' : '#e5edf6',
        }}
      >
        <Typography sx={{ fontSize: 15, lineHeight: 1.35, whiteSpace: 'pre-line' }}>{msg.text}</Typography>
      </Box>
    </Stack>
  );
}

export function LineChatSimulator({
  messages,
  typing,
  onQuickReply,
  memberProfile,
  shopName = 'queue booking',
}: {
  messages: ChatMessage[];
  typing?: boolean;
  onQuickReply: (key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact') => void;
  memberProfile: DemoMemberProfile;
  shopName?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const intro = useMemo(() => (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ color: '#9aa9bb', px: 1 }}>
      <Chip size="small" label="Demo Mode" sx={{ bgcolor: '#223327', color: '#9ce0b4', border: '1px solid #2d6840' }} />
      <Typography sx={{ fontSize: 12 }}>ผู้รับผิดชอบเป็นผู้ตอบกลับ</Typography>
    </Stack>
  ), []);

  return (
    <Box sx={{ height: '100%', minHeight: 660, borderRadius: 1, overflow: 'hidden', border: '1px solid #20262d', bgcolor: '#11151a' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.1, bgcolor: '#090b0f', color: '#e9f0f8', borderBottom: '1px solid #1c222b' }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Typography sx={{ fontSize: 30, lineHeight: 1 }}>‹</Typography>
          <Box>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{shopName}</Typography>
            <Typography sx={{ fontSize: 12, color: '#7f95ad' }}>online</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ color: '#d4dce7' }}>
          <SearchRoundedIcon fontSize="small" />
          <CallOutlinedIcon fontSize="small" />
          <MenuRoundedIcon fontSize="small" />
        </Stack>
      </Stack>

      <Stack sx={{ p: 1.2, borderBottom: '1px solid #1c222b' }}>{intro}</Stack>

      <Stack ref={scrollerRef} spacing={1.2} sx={{ px: 1.2, py: 1.2, height: 440, overflowY: 'auto', bgcolor: '#151a21' }}>
        {messages.map((msg) => <Bubble key={msg.id} msg={msg} memberProfile={memberProfile} />)}
        {typing ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#93a0af', px: 1 }}>
            <CircularProgress size={14} color="inherit" />
            <Typography sx={{ fontSize: 12 }}>กำลังพิมพ์...</Typography>
          </Stack>
        ) : null}
      </Stack>

      <Box sx={{ px: 1.2, py: 1, borderTop: '1px solid #1c222b', bgcolor: '#10151b' }}>
        <QuickReplyBar onClick={onQuickReply} />
      </Box>
    </Box>
  );
}
