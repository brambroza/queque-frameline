'use client';

import { useEffect, useRef } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';
import KeyboardDoubleArrowDownRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowDownRounded';

const BRAND = '#12a862';

const HEADLINE_WORDS = ['ทดลอง', 'ระบบจองคิว', 'ผ่าน', 'LINE', 'ได้ทันที'];

const HERO_STATS: Array<{ value: number; suffix: string; label: string }> = [
  { value: 5, suffix: ' ขั้นตอน', label: 'เดินครบทั้ง flow' },
  { value: 4, suffix: ' เทมเพลต', label: 'ร้านตัดผม ร้านอาหาร คลินิก ห้องประชุม' },
  { value: 0, suffix: ' บาท', label: 'ไม่ต้องสมัคร ไม่ต้องล็อกอิน' },
];

/**
 * Animated hero section for the public sandbox demo page.
 *
 * Motion is GSAP-driven and loaded lazily on the client. All animation is skipped
 * when the visitor has `prefers-reduced-motion: reduce` enabled, in which case the
 * markup renders in its final (fully visible) state.
 */
export function DemoHero() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revertMotion = () => {};

    async function setupHeroMotion() {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const { gsap } = await import('gsap');
      const root = rootRef.current;
      if (cancelled || !root) return;

      const context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

        timeline
          .from('[data-hero-badge]', { y: 14, autoAlpha: 0, duration: 0.5 })
          .from(
            '[data-hero-word]',
            {
              y: 34,
              autoAlpha: 0,
              rotateX: -55,
              transformOrigin: '50% 100%',
              duration: 0.7,
              stagger: 0.08,
            },
            '-=0.25',
          )
          .from('[data-hero-sub]', { y: 18, autoAlpha: 0, duration: 0.55 }, '-=0.35')
          .from('[data-hero-cta]', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.1 }, '-=0.3')
          .from('[data-hero-stat]', { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.1 }, '-=0.25');

        // Count-up for each stat value.
        root.querySelectorAll<HTMLElement>('[data-hero-stat-value]').forEach((node) => {
          const target = Number(node.dataset.heroStatValue || '0');
          const counter = { value: 0 };
          gsap.to(counter, {
            value: target,
            duration: 1.1,
            delay: 0.9,
            ease: 'power2.out',
            onUpdate: () => {
              node.textContent = String(Math.round(counter.value));
            },
          });
        });

        // Drifting aurora blobs behind the headline.
        gsap.utils.toArray<HTMLElement>('[data-hero-blob]').forEach((blob, index) => {
          gsap.to(blob, {
            xPercent: index % 2 === 0 ? 12 : -14,
            yPercent: index % 2 === 0 ? -10 : 12,
            scale: 1.12,
            duration: 9 + index * 2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        });

        gsap.to('[data-hero-scroll-cue]', {
          y: 8,
          duration: 1.1,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }, root);

      revertMotion = () => context.revert();
    }

    void setupHeroMotion();

    return () => {
      cancelled = true;
      revertMotion();
    };
  }, []);

  /** Scrolls the sandbox panel into view for visitors who click the primary CTA. */
  function scrollToSandbox() {
    document.getElementById('sandbox-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <Box
      ref={rootRef}
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
        px: { xs: 2.5, md: 6 },
        py: { xs: 5, md: 8 },
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#f7fbf8',
      }}
    >
      <Box
        data-hero-blob
        aria-hidden
        sx={{
          position: 'absolute',
          top: -140,
          left: -80,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND}33 0%, transparent 68%)`,
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        data-hero-blob
        aria-hidden
        sx={{
          position: 'absolute',
          bottom: -160,
          right: -60,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #7bd8ad40 0%, transparent 70%)',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      <Stack spacing={2.4} sx={{ position: 'relative', maxWidth: 880 }}>
        <Box data-hero-badge>
          <Chip
            size="small"
            label="Sandbox Demo • ไม่ต้องล็อกอิน"
            sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }}
          />
        </Box>

        <Typography
          variant="h2"
          sx={{
            fontWeight: 900,
            lineHeight: 1.15,
            fontSize: { xs: 32, sm: 44, md: 56 },
            perspective: 800,
          }}
        >
          {HEADLINE_WORDS.map((word) => (
            <Box
              key={word}
              data-hero-word
              component="span"
              sx={{
                display: 'inline-block',
                mr: 1.2,
                color: word === 'LINE' ? BRAND : undefined,
              }}
            >
              {word}
            </Box>
          ))}
        </Typography>

        <Typography data-hero-sub color="text.secondary" sx={{ fontSize: { xs: 15, md: 18 }, maxWidth: 660 }}>
          จำลองตั้งแต่ลูกค้าทักแชท LINE กด Rich Menu จองคิวผ่าน LIFF ไปจนถึงหน้าจอเรียกคิวหน้าร้าน
          ทุกอย่างทำงานจริงในเบราว์เซอร์ของคุณ
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
          <Box data-hero-cta>
            <Button
              size="large"
              variant="contained"
              startIcon={<PlayCircleFilledRoundedIcon />}
              onClick={scrollToSandbox}
              sx={{ bgcolor: BRAND, '&:hover': { bgcolor: '#0e8d52' }, px: 3 }}
            >
              เริ่มทดลองเลย
            </Button>
          </Box>
          <Box data-hero-cta>
            <Button size="large" variant="outlined" href="/pricing" sx={{ px: 3 }}>
              ดูแพ็กเกจราคา
            </Button>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.6, sm: 4 }} sx={{ pt: 1.5 }}>
          {HERO_STATS.map((stat) => (
            <Box key={stat.label} data-hero-stat>
              <Typography sx={{ fontWeight: 900, fontSize: 28, color: BRAND, lineHeight: 1.1 }}>
                <Box component="span" data-hero-stat-value={stat.value}>
                  {stat.value}
                </Box>
                {stat.suffix}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Box data-hero-scroll-cue sx={{ pt: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <KeyboardDoubleArrowDownRoundedIcon fontSize="small" />
          <Typography variant="caption">เลื่อนลงเพื่อเริ่ม STEP 1</Typography>
        </Box>
      </Stack>
    </Box>
  );
}
