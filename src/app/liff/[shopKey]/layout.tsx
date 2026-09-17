import { LiffThemeScope } from '@/components/line/liff-theme-scope';

/** Every route under `/liff/[shopKey]` renders inside the light-only LIFF theme. */
export default function LiffShopLayout({ children }: { children: React.ReactNode }) {
  return <LiffThemeScope>{children}</LiffThemeScope>;
}
