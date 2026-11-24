import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  Moon,
  Sun,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Role } from '../types/auth';

function roleHome(role: Role): string {
  if (role === 'SUPER_ADMIN') return '/super-admin';
  if (role === 'ADMIN') return '/admin';
  return '/user';
}

const FAN_GUARANTEES = [
  {
    icon: Lock,
    title: 'Exclusive 10-Minute Seat Hold',
    desc: 'Once you select your seats, they stay locked exclusively for you while you complete checkout peacefully.',
  },
  {
    icon: RefreshCw,
    title: 'Smart Auto-Waitlist Alerts',
    desc: 'Set your preferred tier and budget once—get notified first the moment expired seats drop back in.',
  },
  {
    icon: ShieldCheck,
    title: 'Price-Capped Resale & Fresh QR',
    desc: 'Every fan-to-fan resale stays within the organizer price cap and mints a brand-new verified QR pass.',
  },
];

export default function AuthPage() {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const cycle = setInterval(() => setActiveCard((i) => (i + 1) % FAN_GUARANTEES.length), 3500);
    return () => clearInterval(cycle);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedInUser =
        mode === 'login'
          ? await login(email, password)
          : await register({
              email,
              password,
              fullName,
              role: 'USER',
            });
      navigate(roleHome(signedInUser.role), { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white text-zinc-900 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100 lg:grid-cols-12">
      {/* Left Fan Showcase — Authentic Product Guarantees (No Fake Counts/Events) */}
      <div className="relative hidden flex-col justify-between gap-8 overflow-hidden border-r border-zinc-200 bg-zinc-100/90 px-10 py-10 text-zinc-900 transition-colors duration-200 dark:border-zinc-800/80 dark:bg-[#0D0D10] dark:text-white lg:col-span-6 lg:flex xl:px-14">
        {/* Ambient Animated Glows */}
        <div className="animate-pulse-glow pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#FF3366]/20 blur-3xl" />
        <div className="animate-pulse-glow pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />

        {/* Top Brand */}
        <div className="relative z-10 mx-auto w-full max-w-lg">
          <Link to="/">
            <BrandLogo size="lg" />
          </Link>
        </div>

        {/* Center Headline + Animated Guarantee Cards */}
        <div className="relative z-10 mx-auto w-full max-w-lg">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF3366]/25 bg-[#FF3366]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[#FF3366] dark:border-white/10 dark:bg-white/5 dark:text-amber-300">
              <Ticket className="h-3.5 w-3.5" /> FAN ACCESS PORTAL
            </span>
            <h1 className="mt-4 text-3xl leading-[1.12] font-extrabold tracking-tight text-zinc-900 xl:text-4xl dark:text-white">
              Your front-row pass,{' '}
              <span className="bg-gradient-to-r from-[#FF3366] to-amber-500 bg-clip-text text-transparent">
                without the chaos.
              </span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Fair drops, zero double-bookings, and verified digital passes built for real fans.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            {FAN_GUARANTEES.map(({ icon: Icon, title, desc }, idx) => {
              const isHighlighted = idx === activeCard;
              return (
                <div
                  key={title}
                  onMouseEnter={() => setActiveCard(idx)}
                  className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-all duration-300 ${
                    isHighlighted
                      ? 'translate-x-1 border-[#FF3366]/50 bg-white shadow-lg shadow-[#FF3366]/10 dark:bg-zinc-900'
                      : 'border-zinc-200 bg-white/75 dark:border-zinc-800 dark:bg-zinc-900/50'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                      isHighlighted
                        ? 'bg-[#FF3366] text-white shadow-md shadow-[#FF3366]/30'
                        : 'bg-[#FF3366]/15 text-[#FF3366]'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Subtle Line */}
        <div className="relative z-10 mx-auto flex w-full max-w-lg items-center gap-2 font-mono text-[11px] text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-[#FF3366]" />
          <span>AI Event Concierge · Instant Verified Digital Passes</span>
        </div>
      </div>

      {/* Right Fan Auth Panel — Ambient gradient visible on mobile too */}
      <div className="relative flex flex-col justify-center overflow-hidden bg-zinc-50 px-6 py-12 transition-colors duration-200 dark:bg-[#09090B] lg:col-span-6 lg:px-16">
        <div className="animate-pulse-glow pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#FF3366]/20 blur-3xl lg:hidden" />
        <div className="animate-pulse-glow pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl lg:hidden" />

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
              <BrandLogo size="md" />
            </Link>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {mode === 'login' ? 'Sign in to TicketDrop' : 'Create your fan account'}
          </h2>
          <p className="mt-1.5 text-sm text-zinc-500">
            {mode === 'login'
              ? 'Access your tickets, live waitlists, and AI concierge.'
              : 'Get instant access to flash drops and verified resale tickets.'}
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
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Full Name
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
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
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3366] py-2.5 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/20 transition hover:-translate-y-0.5 hover:bg-[#E62958] disabled:opacity-50"
            >
              {submitting ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Fan Account'}
              {!submitting && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          {/* Organizer Partner CTA */}
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <Link
              to="/organizer/auth"
              className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition hover:border-[#FF3366]/50 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF3366]/10 text-[#FF3366]">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">
                    Want to organize an event?
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Launch concerts &amp; flash drops in TicketDrop Studio
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
              <Link to="/organizer/auth" className="transition hover:text-zinc-900 dark:hover:text-white">
                Organizer Studio
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
