import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserCog,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/api';

export default function AccountSettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<'profile' | 'password' | 'danger'>('profile');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [orgName, setOrgName] = useState(user?.orgName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? '');
    setOrgName(user.orgName ?? '');
  }, [user]);

  const extractErr = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || fallback;

  const profileMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch('/auth/me', {
        fullName,
        orgName: user?.role === 'ADMIN' ? orgName : undefined,
      }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      setErrorMsg(null);
      setSuccessMsg('Profile details saved successfully.');
    },
    onError: (err) => {
      setSuccessMsg(null);
      setErrorMsg(extractErr(err, 'Could not update profile.'));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () =>
      apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setErrorMsg(null);
      setSuccessMsg('Your password has been updated.');
    },
    onError: (err) => {
      setSuccessMsg(null);
      setErrorMsg(extractErr(err, 'Could not change password.'));
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () =>
      apiClient.delete('/auth/me', {
        data: { password: deletePassword },
      }),
    onSuccess: async () => {
      await logout();
    },
    onError: (err) => {
      setSuccessMsg(null);
      setErrorMsg(extractErr(err, 'Could not delete account.'));
    },
  });

  if (!user) return null;

  const isOrganizer = user.role === 'ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const dashboardRoute = isSuperAdmin ? '/super-admin' : isOrganizer ? '/admin' : '/user';
  const roleLabel = isSuperAdmin ? 'Super Admin' : isOrganizer ? 'Organizer Partner' : 'Fan Account';

  const switchSection = (next: 'profile' | 'password' | 'danger') => {
    setSection(next);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    profileMutation.mutate();
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    passwordMutation.mutate();
  };

  const handleDeleteSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    deleteAccountMutation.mutate();
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Subtle Ambient Top Aurora */}
      <div
        aria-hidden="true"
        className="animate-aurora pointer-events-none fixed -top-36 left-[12%] h-80 w-80 rounded-full bg-[#FF3366]/12 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="animate-aurora-delayed pointer-events-none fixed -top-24 right-[10%] h-72 w-72 rounded-full bg-amber-500/10 blur-[110px]"
      />

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/85">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to={dashboardRoute}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <Link to="/">
              <BrandLogo size="sm" />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-rose-500/40 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Account Header Summary Card */}
        <div className="animate-fade-up relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-[#111115]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF3366] to-amber-500 font-mono text-xl font-extrabold text-white shadow-lg shadow-[#FF3366]/25">
                {user.fullName?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 sm:text-2xl dark:text-white">
                    {user.fullName}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FF3366]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#FF3366]">
                    {isOrganizer ? <Building2 className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                    {roleLabel}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">{user.email}</p>
                {isOrganizer && user.orgName && (
                  <p className="mt-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Organization: {user.orgName}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="font-mono text-[10px] font-semibold uppercase text-zinc-400">
                MEMBER SINCE
              </div>
              <div className="mt-0.5 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {new Date(user.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Settings Workspace */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Left Navigation Sidebar */}
          <aside className="lg:col-span-4">
            <div className="space-y-1.5 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-[#111115]">
              <button
                type="button"
                onClick={() => switchSection('profile')}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition ${
                  section === 'profile'
                    ? 'bg-[#FF3366]/12 text-[#FF3366]'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
                }`}
              >
                <UserCog className="h-4 w-4 shrink-0" />
                <div>
                  <div>Profile Details</div>
                  <div className="mt-0.5 text-[10px] font-normal text-zinc-500">
                    {isOrganizer ? 'Update owner & organization name' : 'Update your display name'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => switchSection('password')}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition ${
                  section === 'password'
                    ? 'bg-[#FF3366]/12 text-[#FF3366]'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
                }`}
              >
                <KeyRound className="h-4 w-4 shrink-0" />
                <div>
                  <div>Security &amp; Password</div>
                  <div className="mt-0.5 text-[10px] font-normal text-zinc-500">
                    Change your login password
                  </div>
                </div>
              </button>

              {!isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => switchSection('danger')}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition ${
                    section === 'danger'
                      ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                      : 'text-zinc-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400'
                  }`}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <div>
                    <div>Delete Account</div>
                    <div className="mt-0.5 text-[10px] font-normal text-zinc-500">
                      Permanently deactivate &amp; anonymize
                    </div>
                  </div>
                </button>
              )}
            </div>
          </aside>

          {/* Right Active Settings Form Panel */}
          <section className="lg:col-span-8">
            <div className="animate-fade-up overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#111115]">
              <div
                className={`h-1.5 bg-gradient-to-r ${
                  section === 'danger'
                    ? 'from-rose-600 via-rose-400 to-rose-600'
                    : 'from-[#FF3366] via-amber-500 to-[#FF3366]'
                }`}
              />

              <div className="p-6 sm:p-8">
                {errorMsg && (
                  <div className="animate-slide-reveal mb-5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="animate-slide-reveal mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> {successMsg}
                  </div>
                )}

                {section === 'profile' && (
                  <form onSubmit={handleProfileSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                        Profile Details
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Keep your account information up to date across TicketDrop AI.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Email Address (Read-only)
                      </label>
                      <input
                        disabled
                        value={user.email}
                        className="h-11 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 font-mono text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Full Name
                      </label>
                      <input
                        required
                        minLength={2}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                      />
                    </div>

                    {isOrganizer && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Organization Name
                        </label>
                        <input
                          required
                          minLength={2}
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                        />
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={profileMutation.isPending}
                        className="rounded-xl bg-[#FF3366] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958] disabled:opacity-50"
                      >
                        {profileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {section === 'password' && (
                  <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                        Security &amp; Password
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Use a strong password of at least 8 characters to protect your passes and account.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        New Password (min 8 characters)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={passwordMutation.isPending}
                        className="rounded-xl bg-[#FF3366] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958] disabled:opacity-50"
                      >
                        {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                )}

                {section === 'danger' && !isSuperAdmin && (
                  <form onSubmit={handleDeleteSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                        Delete Account
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Permanently deactivate your account and anonymize personal details.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <div>
                        <div className="font-bold">Before You Proceed</div>
                        <p className="mt-1 leading-relaxed opacity-90">
                          {isOrganizer
                            ? 'Your organization profile and personal details will be anonymized and all active sessions revoked immediately. Deletion is blocked while you have live published events.'
                            : 'Your personal details will be anonymized and all sessions revoked immediately. Deletion is blocked while you hold active passes or open resale listings.'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Confirm Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter your current password to confirm"
                        className="h-11 w-full rounded-xl border border-rose-500/30 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none focus:border-rose-500 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={deleteAccountMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleteAccountMutation.isPending ? 'Deleting Account...' : 'Delete My Account Permanently'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

