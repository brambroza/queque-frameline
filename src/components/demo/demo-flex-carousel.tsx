'use client';

import { Box, Stack, Typography } from '@mui/material';

export type PromoCard = {
  id: string;
  title: string;
  subtitle: string;
  cta?: string;
};

export function DemoFlexCarousel({
  cards,
  accent = '#12a862',
}: {
  cards: PromoCard[];
  accent?: string;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.3 }}>
      {cards.map((card) => (
        <Box
          key={card.id}
          sx={{
            minWidth: 210,
            maxWidth: 240,
            borderRadius: 2.5,
            bgcolor: '#fff',
            border: '1px solid #dce4ec',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ bgcolor: accent, color: '#fff', px: 1.2, py: 0.9 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{card.title}</Typography>
          </Box>
          <Box sx={{ p: 1.2 }}>
            <Typography sx={{ fontSize: 13, color: '#354255', minHeight: 40 }}>{card.subtitle}</Typography>
            {card.cta ? (
              <Box sx={{ mt: 1, borderRadius: 999, border: '1px solid #c8d2de', px: 1, py: 0.6, fontSize: 12, color: '#3f4d5e', textAlign: 'center' }}>
                {card.cta}
              </Box>
            ) : null}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
