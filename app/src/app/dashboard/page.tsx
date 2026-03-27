import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { MashupList } from './mashup-list';
import { MashupListSkeleton } from './mashup-list-skeleton';
import { DashboardStats } from './dashboard-stats';
import { ContinueSection } from './continue-section';
import { ActivityFeed } from './activity-feed';

export default async function DashboardPage() {
  const headerList = await headers();
  const userId = headerList.get('x-user-id');

  if (!userId) redirect('/login');

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back</p>
        </div>
        <Link
          href="/mashups/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)] transition-all duration-300 hover:bg-orange-400 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Mashup
        </Link>
      </div>

      <DashboardStats />

      <ContinueSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<MashupListSkeleton />}>
            <MashupList userId={userId as string} />
          </Suspense>
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
