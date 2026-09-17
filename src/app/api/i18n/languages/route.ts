import { NextResponse } from 'next/server';
import { getLanguageOptions } from '@/lib/i18n/server';

export async function GET() {
  try {
    const data = await getLanguageOptions();
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
