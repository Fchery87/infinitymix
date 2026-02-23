import { notFound } from 'next/navigation';
import { requireServerAdminUser } from '@/lib/auth/admin';
import { AudioPreviewQaDashboard } from '@/components/admin/audio-preview-qa-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminAudioPreviewQaPage() {
  const adminUser = await requireServerAdminUser();
  if (!adminUser) {
    notFound();
  }
  return <AudioPreviewQaDashboard />;
}
