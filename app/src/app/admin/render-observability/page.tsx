import { notFound } from 'next/navigation';
import { RenderObservabilityDashboard } from '@/components/admin/render-observability-dashboard';
import { requireServerAdminUser } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export default async function AdminRenderObservabilityPage() {
  const adminUser = await requireServerAdminUser();

  if (!adminUser) {
    notFound();
  }

  return <RenderObservabilityDashboard adminUser={adminUser} />;
}
