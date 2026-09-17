import type { Metadata } from 'next';
import { DockDisplay } from '@/components/display/dock-display';

export const metadata: Metadata = { title: 'จอเรียกคิว' };

/** Yard TV. Open as `/display` (or `/display?key=…` when DISPLAY_KEY is set) on the screen at the gate. */
export default async function DisplayPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  return <DockDisplay displayKey={key ?? ''} />;
}
