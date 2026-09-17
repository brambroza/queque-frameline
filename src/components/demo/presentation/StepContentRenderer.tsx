'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import Fade from '@mui/material/Fade';
import { MobileFrame } from '@/components/demo/device-frame/MobileFrame';
import { TabletFrame } from '@/components/demo/device-frame/TabletFrame';
import { TvFrame } from '@/components/demo/device-frame/TvFrame';
import { LineChatSimulator } from '@/components/demo/line-chat-simulator';
import { LiffBookingSimulator } from '@/components/demo/liff-booking-simulator';
import { RichMenuSimulator } from '@/components/demo/rich-menu-simulator';
import { FlexBookingSuccess } from '@/components/demo/flex-booking-success';
import { DemoQueueBoard } from '@/components/demo/demo-queue-board';
import { DemoSignage } from '@/components/demo/demo-signage';
import type { ChatMessage, DemoBooking, DemoMemberProfile, DemoMenuAction, DemoQueueItem } from '@/components/demo/line-demo-types';

export type DemoStep = 1 | 2 | 3 | 4 | 5 | 6;

export function StepContentRenderer({
  currentStep,
  title,
  description,
  messages,
  typing,
  memberProfile,
  activeMenu,
  queueItems,
  booking,
  onQuickReply,
  onMenuSelect,
  onBooked,
  onQueueCall,
  signageDark = true,
}: {
  currentStep: DemoStep;
  title: string;
  description: string;
  messages: ChatMessage[];
  typing: boolean;
  memberProfile: DemoMemberProfile;
  activeMenu: DemoMenuAction;
  queueItems: DemoQueueItem[];
  booking: DemoBooking | null;
  onQuickReply: (key: 'today' | 'tomorrow' | 'morning' | 'afternoon' | 'contact') => void;
  onMenuSelect: (key: DemoMenuAction) => void;
  onBooked: (booking: DemoBooking) => void;
  onQueueCall: () => void;
  signageDark?: boolean;
}) {
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography id="demo-step-title" tabIndex={-1} sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 800, color: '#111827' }}>
          {title}
        </Typography>
        <Typography color="#6B7280">{description}</Typography>
      </Box>

      <Fade in key={currentStep} timeout={280}>
        <Box>
        {(() => {
        switch (currentStep) {
          case 1:
            return (
              <Box sx={{ p: 3, borderRadius: 2, bgcolor: '#fff', border: '1px solid #e5e7eb' }}>
                <Typography fontWeight={700}>Flow ที่จะเห็นในเดโมนี้</Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  LINE Chat → LIFF Booking → Booking Success → Queue Board → Signage
                </Typography>
              </Box>
            );
          case 2:
            return (
              <MobileFrame title="LINE Chat Simulator">
                <LineChatSimulator
                  messages={messages}
                  typing={typing}
                  memberProfile={memberProfile}
                  onQuickReply={onQuickReply}
                  shopName="QueueBooking LINE"
                />
                <RichMenuSimulator active={activeMenu} onSelect={onMenuSelect} />
              </MobileFrame>
            );
          case 3:
            return (
              <MobileFrame title="LIFF Booking Simulator">
                <Box sx={{ p: 1.2 }}>
                  <LiffBookingSimulator onBooked={onBooked} />
                </Box>
              </MobileFrame>
            );
          case 4:
            return (
              <MobileFrame title="Booking Success">
                <Box sx={{ p: 2, bgcolor: '#0f172a', minHeight: 700 }}>
                  {booking ? <FlexBookingSuccess booking={booking} /> : <Typography color="#fff">ยังไม่มี booking สำหรับแสดง</Typography>}
                </Box>
              </MobileFrame>
            );
          case 5:
            return (
              <TabletFrame title="Queue Board">
                <Box sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Button size="small" variant="outlined" onClick={onQueueCall}>เรียกคิว</Button>
                  </Stack>
                  <DemoQueueBoard items={queueItems} />
                </Box>
              </TabletFrame>
            );
          case 6:
            return (
              <TvFrame title="Signage View">
                <Box sx={{ p: 2.4, bgcolor: signageDark ? '#0f172a' : '#f3f6f8', minHeight: '100%' }}>
                  <DemoSignage items={queueItems} />
                </Box>
              </TvFrame>
            );
          default:
            return null;
        }
      })()}
        </Box>
      </Fade>
    </Stack>
  );
}
