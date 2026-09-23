import { ApiKeysCrud } from '@/components/forms/api-keys-crud';
import { requirePageAccess } from '@/lib/auth/page-roles';

export default async function ApiKeysPage() {
  await requirePageAccess('api_keys');
  return <ApiKeysCrud />;
}
