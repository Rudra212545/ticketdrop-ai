import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ShieldCheck,
  Sparkles,
  QrCode,
  ArrowRight,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Ticket,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function OrganizerAuthPage() {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'apply'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user =
        mode === 'login'
          ? await login(email, password)
          : await register({
              email,
              password,
              fullName,
              role: 'ADMIN',
              orgName,
              registrationNo,
            });
      if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'SUPER_ADMIN') {
        navigate('/super-admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Authentication failed. Please check your organizer credentials.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white text-zinc-900 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100 lg:grid-cols-12">
      {/* Left Organizer Partner Showcase — Fully Light & Dark Theme-Aware */}
      <div className="relative hidden flex-col justify-between gap-8 overflow-hidden border-r border-zinc-200 bg-zinc-100/80 px-10 py-10 text-zinc-900 transition-colors duration-200 dark:border-zinc-800/80 dark:bg-[#0D0D10] dark:text-white lg:col-span-6 lg:flex xl:px-14">
        <div className="animate-pulse-glow pointer-events-none absolute -top-20 -right-20 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="animate-pulse-glow pointer-events-none absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-[#FF3366]/15 blur-3xl dark:bg-[#FF3366]/20" />

        <div className="relative z-10 mx-auto w-full max-w-lg">
          <Link to="/">
            <BrandLogo size="lg" subtitle="Verified Event Partners" />
          </Link>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-emerald-300">
            <Building2 className="h-3.5 w-3.5" /> ORGANIZER PARTNER PORTAL
          </span>
          <h1 className="mt-4 text-3xl leading-[1.12] font-extrabold tracking-tight text-zinc-900 xl:text-4xl dark:text-white">
            Sell out venues. Kill black-market scalping.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Every organizer account is verified before publishing live ticket drops.
          </p>

          <div className="mt-6 space-y-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Price-Capped Resale Escrow',
                desc: 'Cap fan resale at 100%–110% of face value with automatic QR rotation.',
              },
              {
                icon: Sparkles,
                title: 'AI Pricing & Demand Co-Pilot',
                desc: 'Real-time waitlist velocity & demand recommendations for your tiers.',
              },
              {
                icon: QrCode,
                title: 'Instant Venue QR Verification',
                desc: 'Instant gate verification rejects resold or duplicated screenshots.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-[#FF3366]/40 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF3366]/15 text-[#FF3366]">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">{title}</div>
                  <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-lg font-mono text-[11px] text-zinc-500">
          Dedicated Organizer Workspace · Verified Partner Controls
        </div>
      </div>

      {/* Right Organizer Form — Ambient gradient visible on mobile too */}
      <div className="relative flex flex-col justify-center overflow-hidden bg-zinc-50 px-6 py-12 transition-colors duration-200 dark:bg-[#09090B] lg:col-span-6 lg:px-16">
        <div className="animate-pulse-glow pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl lg:hidden" />
        <div className="animate-pulse-glow pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#FF3366]/20 blur-3xl lg:hidden" />

        <button
          onClick={toggleTheme}
          title="Toggle Light / Dark theme"
          className="absolute top-6 right-6 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white/90 text-zinc-600 backdrop-blur transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-300"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="animate-fade-up relative z-10 mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/">
              <BrandLogo size="md" subtitle="Organizer Studio" />
            </Link>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {mode === 'login' ? 'Organizer Studio Sign In' : 'Apply as an Event Organizer'}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-500">
            {mode === 'login'
              ? 'Manage your live events, seat maps, and dynamic pricing.'
              : 'Submit your organization details for platform verification.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Partner Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('apply');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'apply'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Apply as Partner
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'apply' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Contact Full Name
                  </label>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Organization / Venue Name
                    </label>
                    <input
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter organization or venue name"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      GST / Business Reg No
                    </label>
                    <input
                      value={registrationNo}
                      onChange={(e) => setRegistrationNo(e.target.value)}
                      placeholder="GSTIN / Reg No (optional)"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partners@yourvenue.com"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (min. 8 characters)'}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pr-10 pl-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3366] py-2.5 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/20 transition hover:bg-[#E62958] disabled:opacity-50"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In to Studio'
                  : 'Submit Partner Application'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Symmetric Fan Portal CTA */}
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <Link
              to="/login"
              className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition hover:border-[#FF3366]/50 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF3366]/10 text-[#FF3366]">
                  <Ticket className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">
                    Are you a Fan looking for tickets?
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Sign in to book live drops &amp; verified resale passes
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-[#FF3366]" />
            </Link>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 pt-5 text-[11px] text-zinc-500 dark:border-zinc-800/70">
            <span>© {new Date().getFullYear()} TicketDrop AI</span>
            <div className="flex items-center gap-4">
              <Link to="/" className="transition hover:text-zinc-900 dark:hover:text-white">
                Home
              </Link>
              <Link to="/login" className="transition hover:text-zinc-900 dark:hover:text-white">
                Fan Login
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
