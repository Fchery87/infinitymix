import { notFound } from 'next/navigation';
import { AudioObservabilityDashboard } from '@/components/admin/audio-observability-dashboard';
import { requireServerAdminUser } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export default async function AdminAudioObservabilityPage() {
  const adminUser = await requireServerAdminUser();

  if (!adminUser) {
    notFound();
  }

  return <AudioObservabilityDashboard adminUser={adminUser} />;
}

