import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Accordion, AccordionDetails, AccordionSummary, Container, Typography } from '@mui/material';

export function FaqSection({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>FAQ</Typography>
      {items.map((f) => (
        <Accordion key={f.q} sx={{ borderRadius: '12px !important', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography fontWeight={600}>{f.q}</Typography></AccordionSummary>
          <AccordionDetails><Typography color="text.secondary">{f.a}</Typography></AccordionDetails>
        </Accordion>
      ))}
    </Container>
  );
}
