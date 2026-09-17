'use client';

import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded';
import SmartDisplayRoundedIcon from '@mui/icons-material/SmartDisplayRounded';
import { Box, Button, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function DemoControlPanel({
  currentStep,
  canPrev,
  canNext,
  isAutoPlaying,
  onPrev,
  onNext,
  onStart,
  onAutoPlayToggle,
  onReset,
  onStepAction,
  labels,
}: {
  currentStep: Step;
  canPrev: boolean;
  canNext: boolean;
  isAutoPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onAutoPlayToggle: () => void;
  onReset: () => void;
  onStepAction: (action: string) => void;
  labels: {
    title: string;
    subtitle: string;
    start: string;
    previous: string;
    next: string;
    autoPlay: string;
    stopAutoPlay: string;
    reset: string;
    stepActions: string;
    currentStep: string;
  };
}) {
  function StepActions() {
    if (currentStep === 2) {
      return (
        <Stack spacing={0.8}>
          <Button aria-label="Send booking message" onClick={() => onStepAction('chat_send_booking')} variant="outlined">ส่งข้อความ “จองคิว”</Button>
          <Button aria-label="Show rich menu" onClick={() => onStepAction('chat_show_richmenu')} variant="outlined">แสดง Rich Menu</Button>
          <Button aria-label="Reset chat" onClick={() => onStepAction('chat_reset')} variant="text">Reset Chat</Button>
        </Stack>
      );
    }
    if (currentStep === 3) {
      return (
        <Stack spacing={0.8}>
          <Button aria-label="Pick haircut service" onClick={() => onStepAction('liff_pick_service')} variant="outlined">เลือกบริการ</Button>
          <Button aria-label="Pick booking time" onClick={() => onStepAction('liff_pick_time')} variant="outlined">เลือกเวลา</Button>
          <Button aria-label="Confirm booking" onClick={() => onStepAction('liff_confirm')} variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}>ยืนยันจอง</Button>
        </Stack>
      );
    }
    if (currentStep === 5) {
      return (
        <Stack spacing={0.8}>
          <Button aria-label="Call queue" onClick={() => onStepAction('queue_call')} variant="outlined">เรียกคิว</Button>
          <Button aria-label="Recall queue" onClick={() => onStepAction('queue_recall')} variant="outlined">เรียกซ้ำ</Button>
          <Button aria-label="Complete queue" onClick={() => onStepAction('queue_complete')} variant="outlined">จบคิว</Button>
          <Button aria-label="Near queue message" onClick={() => onStepAction('queue_near')} variant="text">ส่ง Near Queue</Button>
        </Stack>
      );
    }
    if (currentStep === 6) {
      return (
        <Stack spacing={0.8}>
          <Button aria-label="Open fullscreen signage" onClick={() => onStepAction('signage_fullscreen')} variant="outlined">เปิด Fullscreen</Button>
          <Button aria-label="Toggle signage theme" onClick={() => onStepAction('signage_theme')} variant="outlined">เปลี่ยน Theme</Button>
          <Button aria-label="Refresh signage" onClick={() => onStepAction('signage_refresh')} variant="text">Refresh Signage</Button>
        </Stack>
      );
    }
    return null;
  }

  return (
    <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent>
        <Typography fontWeight={800}>{labels.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {labels.subtitle}
        </Typography>
        <Stack spacing={1}>
          <Tooltip title="เริ่มจาก Step แรก">
            <Button aria-label="Start demo" onClick={onStart} startIcon={<PlayArrowRoundedIcon />} variant="contained" sx={{ bgcolor: '#12a862', '&:hover': { bgcolor: '#5ead77' } }}>
              {labels.start}
            </Button>
          </Tooltip>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Previous step">
              <Box sx={{ flex: 1 }}>
                <Button aria-label="Previous step" onClick={onPrev} disabled={!canPrev} fullWidth startIcon={<SkipPreviousRoundedIcon />} variant="outlined">
                  {labels.previous}
                </Button>
              </Box>
            </Tooltip>
            <Tooltip title="Next step">
              <Box sx={{ flex: 1 }}>
                <Button aria-label="Next step" onClick={onNext} disabled={!canNext} fullWidth endIcon={<SkipNextRoundedIcon />} variant="outlined">
                  {labels.next}
                </Button>
              </Box>
            </Tooltip>
          </Stack>
          <Tooltip title="เล่นอัตโนมัติทีละ Step">
            <Button aria-label="Auto play demo" onClick={onAutoPlayToggle} startIcon={<SmartDisplayRoundedIcon />} variant="outlined" color={isAutoPlaying ? 'success' : 'inherit'}>
              {isAutoPlaying ? labels.stopAutoPlay : labels.autoPlay}
            </Button>
          </Tooltip>
          <Tooltip title="รีเซ็ตสถานะเดโม">
            <Button aria-label="Reset demo" onClick={onReset} startIcon={<RestartAltRoundedIcon />} variant="text">
              {labels.reset}
            </Button>
          </Tooltip>
          <Typography variant="caption" color="text.secondary">{labels.currentStep}: {currentStep}/6</Typography>
          <Box sx={{ pt: 0.8 }}>
            <Typography variant="caption" color="text.secondary">{labels.stepActions}</Typography>
            <Box sx={{ mt: 0.8 }}>
              <StepActions />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
