'use client';

import { Box, Card, CardActionArea, Chip, Stack, Typography } from '@mui/material';
import type { SignageConfig, SignageData, SignageTemplate } from '@/lib/signage/types';
import { SignageBoard } from '@/components/signage/signage-board';
import { SIGNAGE_TEMPLATE_LIST } from '@/components/signage/templates';

export function TemplatePicker({
  value,
  config,
  data,
  recommendedFor,
  recommendedLabel,
  onChange,
}: {
  value: SignageTemplate;
  config: SignageConfig;
  data: SignageData;
  recommendedFor?: string | null;
  recommendedLabel: string;
  onChange: (template: SignageTemplate) => void;
}) {
  return (
    <Stack spacing={1.2}>
      {SIGNAGE_TEMPLATE_LIST.map((tpl) => {
        const selected = tpl.id === value;
        const recommended = Boolean(recommendedFor && tpl.best_for.includes(recommendedFor));
        return (
          <Card
            key={tpl.id}
            variant="outlined"
            sx={{
              borderRadius: 2,
              borderColor: selected ? 'primary.main' : 'divider',
              boxShadow: selected ? '0 0 0 2px rgba(18,168,98,0.25)' : 'none',
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
            }}
          >
            <CardActionArea onClick={() => onChange(tpl.id)} aria-pressed={selected} sx={{ p: 1.2 }}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: config.layout === 'portrait' ? '16 / 9' : '16 / 9',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: '#070d07',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Box sx={{ height: '100%', aspectRatio: config.layout === 'portrait' ? '9 / 16' : '16 / 9' }}>
                  <SignageBoard data={data} config={{ ...config, template: tpl.id }} mode="thumbnail" />
                </Box>
              </Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>{tpl.label_th}</Typography>
                {recommended ? <Chip size="small" color="success" label={recommendedLabel} /> : null}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                {tpl.description_th}
              </Typography>
            </CardActionArea>
          </Card>
        );
      })}
    </Stack>
  );
}
