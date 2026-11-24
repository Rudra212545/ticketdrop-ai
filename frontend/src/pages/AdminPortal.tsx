import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  CalendarPlus,
  Sparkles,
  QrCode,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Percent,
  Ticket,
} from 'lucide-react';
import DashboardLayout, { type SidebarNavItem } from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import type { OrganizerSummary } from '../types/auth';

export default function AdminPortal() {
  const [activeNav, setActiveNav] = useState('overview');

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => (await apiClient.get<OrganizerSummary>('/admin/profile')).data,
  });

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Studio Overview', icon: LayoutDashboard },
    { id: 'events', label: 'Events & Seat Maps', icon: CalendarPlus, badge: 'Phase 2', disabled: true },
    { id: 'ai-pricing', label: 'AI Pricing Co-Pilot', icon: Sparkles, badge: 'Phase 4', disabled: true },
    { id: 'scanner', label: 'Venue QR Scanner', icon: QrCode, badge: 'Phase 3', disabled: true },
  ];

  const isApproved = profile?.approvalStatus === 'APPROVED';

  return (
    <DashboardLayout
      workspaceLabel="Organizer Studio"
      pageTitle={profile?.orgName ?? 'Organizer Studio'}
      pageSubtitle="Create flash-sale drops, manage seat maps, and optimize pricing with AI Co-Pilot"
      navItems={navItems}
      activeNav={activeNav}
      onSelectNav={setActiveNav}
    >
      {isLoading && <div className="py-12 text-center text-sm text-zinc-500">Loading Organizer Studio...</div>}
      {error && <div className="py-12 text-center text-sm text-rose-500">Could not load organizer profile.</div>}

      {profile && (
        <>
          {!isApproved && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <div className="font-bold">Organization Status: {profile.approvalStatus}</div>
                <p className="mt-0.5 text-xs opacity-90">
                  Your organizer profile is awaiting verification from a Platform Super Admin before you can
                  publish live ticket drops.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Verification</span>
                {isApproved ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div
                className={`mt-2.5 font-mono text-lg font-bold ${
                  isApproved ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {profile.approvalStatus}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Platform Fee</span>
                <Percent className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="mt-2.5 font-mono text-2xl font-bold text-zinc-900 dark:text-white">
                {(profile.platformFeeBps / 100).toFixed(2)}%
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Published Events</span>
                <Ticket className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="mt-2.5 font-mono text-2xl font-bold text-zinc-900 dark:text-white">0</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Organization</span>
                <Building2 className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="mt-2.5 truncate text-sm font-bold text-zinc-900 dark:text-white">
                {profile.orgName}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
              Ready for Phase 2: Event &amp; Seat-Map Builder
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Next up, your approved organizer studio will let you launch concerts with multi-tier seat
              grids, Redis flash-sale waiting rooms, and configurable resale price caps.
            </p>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
