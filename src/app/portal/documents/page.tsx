import { redirect } from 'next/navigation';
import { DOCUMENT_PATH } from '@/lib/auth/document-access';

/** Old combined SO / PO page — documents now live on two pages. Keep bookmarks and old notifications working. */
export default function DocumentsPage() {
  redirect(DOCUMENT_PATH.so);
}
