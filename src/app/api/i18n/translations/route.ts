import { NextResponse } from 'next/server';
import { getTranslationsForLanguage } from '@/lib/i18n/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') ?? 'th';
    const namespace = searchParams.get('namespace') ?? undefined;
    const data = await getTranslationsForLanguage(lang, namespace);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
