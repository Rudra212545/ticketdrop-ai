import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Users,
  ScrollText,
  Check,
  X,
  Ban,
  RotateCcw,
  Search,
  Building2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import DashboardLayout, { type SidebarNavItem } from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import type {
  ApprovalStatus,
  AuditLogResponse,
  OrganizerSummary,
  UserModerationResponse,
} from '../types/auth';

export default function SuperAdminPortal() {
  const [tab, setTab] = useState<'organizers' | 'users' | 'audit'>('organizers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ApprovalStatus>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const organizersQuery = useQuery({
    queryKey: ['sa-organizers'],
    queryFn: async () => (await apiClient.get<OrganizerSummary[]>('/super-admin/organizers')).data,
  });

  const usersQuery = useQuery({
    queryKey: ['sa-users'],
    queryFn: async () => (await apiClient.get<UserModerationResponse[]>('/super-admin/users')).data,
  });

  const auditQuery = useQuery({
    queryKey: ['sa-audit'],
    queryFn: async () =>
      (await apiClient.get<{ content: AuditLogResponse[]; totalElements: number }>('/super-admin/audit-logs?size=30'))
        .data,
  });

  const decideMutation = useMutation({
    mutationFn: async ({ profileId, decision }: { profileId: string; decision: ApprovalStatus }) =>
      apiClient.patch(`/super-admin/organizers/${profileId}/decision`, { decision }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sa-organizers'] });
      queryClient.invalidateQueries({ queryKey: ['sa-audit'] });
      showToast(`Organizer status updated to ${vars.decision}. Logged to Audit Trail.`);
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) =>
      apiClient.post(`/super-admin/users/${userId}/${ban ? 'ban' : 'unban'}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sa-users'] });
      queryClient.invalidateQueries({ queryKey: ['sa-audit'] });
      showToast(
        vars.ban
          ? 'Account banned and JWT revoked immediately in Redis.'
          : 'Account reinstated and unbanned in Redis.',
      );
    },
  });

  const organizers = organizersQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const audits = auditQuery.data?.content ?? [];
  const pendingCount = organizers.filter((o) => o.approvalStatus === 'PENDING').length;

  const filteredOrganizers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return organizers.filter((org) => {
      const matchesStatus = statusFilter === 'ALL' || org.approvalStatus === statusFilter;
      const matchesQuery =
        !q ||
        org.orgName.toLowerCase().includes(q) ||
        org.email.toLowerCase().includes(q) ||
        org.fullName.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [organizers, search, statusFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) => !q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q),
    );
  }, [users, search]);

  const navItems: SidebarNavItem[] = [
    {
      id: 'organizers',
      label: 'Organizers',
      icon: ShieldCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { id: 'users', label: 'Users & Anti-Scalper', icon: Users, badge: users.length },
    { id: 'audit', label: 'Audit Logs (AOP)', icon: ScrollText, badge: auditQuery.data?.totalElements ?? 0 },
  ];

  const kpis = [
    { label: 'Total Organizers', value: organizers.length, icon: Building2, tone: 'text-zinc-900 dark:text-white' },
    {
      label: 'Pending Review',
      value: pendingCount,
      icon: AlertCircle,
      tone: pendingCount > 0 ? 'text-amber-500' : 'text-emerald-500',
    },
    { label: 'Registered Users', value: users.length, icon: Users, tone: 'text-zinc-900 dark:text-white' },
    {
      label: 'AOP Audit Events',
      value: auditQuery.data?.totalElements ?? 0,
      icon: Activity,
      tone: 'text-[#FF3366]',
    },
  ];

  return (
    <DashboardLayout
      workspaceLabel="Super Admin"
      pageTitle="Trust, Safety & Governance"
      pageSubtitle="Approve organizers, stop scalpers in Redis, and inspect immutable AOP audit logs"
      navItems={navItems}
      activeNav={tab}
      onSelectNav={(id) => {
        setTab(id as 'organizers' | 'users' | 'audit');
        setSearch('');
      }}
    >
      {toast && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]"
          >
            <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
              <span>{label}</span>
              <Icon className="h-4 w-4 text-zinc-400" />
            </div>
            <div className={`mt-2.5 font-mono text-2xl font-bold ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Organizers Tab */}
      {tab === 'organizers' && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800/80">
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organization or owner..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pr-3 pl-9 text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    statusFilter === st
                      ? 'bg-[#FF3366] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Fee</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/70">
                {filteredOrganizers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-xs text-zinc-500">
                      No organizers match this filter.
                    </td>
                  </tr>
                )}
                {filteredOrganizers.map((org) => (
                  <tr key={org.profileId} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                    <td className="px-5 py-4 font-semibold text-zinc-900 dark:text-white">
                      {org.orgName}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {org.fullName}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{org.email}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                      {(org.platformFeeBps / 100).toFixed(2)}%
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          org.approvalStatus === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : org.approvalStatus === 'PENDING'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {org.approvalStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {org.approvalStatus === 'PENDING' && (
                          <>
                            <button
                              disabled={decideMutation.isPending}
                              onClick={() =>
                                decideMutation.mutate({ profileId: org.profileId, decision: 'APPROVED' })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              disabled={decideMutation.isPending}
                              onClick={() =>
                                decideMutation.mutate({ profileId: org.profileId, decision: 'REJECTED' })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-400"
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {org.approvalStatus === 'APPROVED' && (
                          <button
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({ profileId: org.profileId, decision: 'SUSPENDED' })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-400"
                          >
                            <Ban className="h-3.5 w-3.5" /> Suspend
                          </button>
                        )}
                        {(org.approvalStatus === 'REJECTED' || org.approvalStatus === 'SUSPENDED') && (
                          <button
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({ profileId: org.profileId, decision: 'APPROVED' })
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Re-Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800/80">
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user name or email..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pr-3 pl-9 text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Redis Instant Ban</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/70">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-white">{u.fullName}</div>
                      <div className="font-mono text-xs text-zinc-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {u.role}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : u.status === 'BANNED'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {u.role !== 'SUPER_ADMIN' && (
                        <button
                          disabled={banMutation.isPending}
                          onClick={() => banMutation.mutate({ userId: u.id, ban: u.status !== 'BANNED' })}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            u.status === 'BANNED'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
                          }`}
                        >
                          {u.status === 'BANNED' ? (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" /> Unban
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" /> Ban Scalper
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {tab === 'audit' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#111114]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">Actor Role</th>
                  <th className="px-5 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/70">
                {audits.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                      No privileged actions recorded yet.
                    </td>
                  </tr>
                )}
                {audits.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                    <td className="px-5 py-3.5 font-mono text-zinc-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono font-semibold text-amber-700 dark:text-amber-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-zinc-800 dark:text-zinc-200">
                      {log.resourceType}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#FF3366]">{log.actorRole}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-500">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
