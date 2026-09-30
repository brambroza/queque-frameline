import type { Metadata } from 'next';
import { DockDisplay } from '@/components/display/dock-display';

export const metadata: Metadata = { title: 'จอเรียกคิว' };

/**
 * Yard TV. Open as `/display?branch=<branch code>` on the screen at that branch's gate
 * (`?branch=all` = every branch on one screen; add `&key=…` when DISPLAY_KEY is set).
 * Without `branch` a multi-branch site shows the branch chooser.
 */
export default async function DisplayPage({ searchParams }: { searchParams: Promise<{ key?: string; branch?: string }> }) {
  const { key, branch } = await searchParams;
  return <DockDisplay displayKey={key ?? ''} branch={branch ?? ''} />;
}
