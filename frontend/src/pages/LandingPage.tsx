import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Menu,
  Moon,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Users,
  X,
  Zap,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/api';
import type { Role } from '../types/auth';
import { formatRupees, type EventSummary } from '../types/event';

function roleDashboard(role: Role): string {
  if (role === 'SUPER_ADMIN') return '/super-admin';
  if (role === 'ADMIN') return '/admin';
  return '/user';
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-7 opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

const CATEGORY_ART: Record<string, { image: string; accent: string }> = {
  CONCERT: {
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80',
    accent: 'from-[#FF3366] to-amber-500',
  },
  COMEDY: {
    image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=900&q=80',
    accent: 'from-violet-500 to-[#FF3366]',
  },
  FESTIVAL: {
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
    accent: 'from-emerald-500 to-cyan-500',
  },
  SPORTS: {
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=900&q=80',
    accent: 'from-sky-500 to-blue-600',
  },
  TECH: {
    image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=900&q=80',
    accent: 'from-amber-500 to-[#FF3366]',
  },
};

function getEventArt(category: string) {
  return CATEGORY_ART[category.toUpperCase()] ?? CATEGORY_ART.CONCERT;
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type SeatState = 'booked' | 'locked' | 'available';

const INITIAL_SEATS: { code: string; state: SeatState }[] = [
  { code: 'A1', state: 'booked' }, { code: 'A2', state: 'booked' }, { code: 'A3', state: 'locked' },
  { code: 'A4', state: 'locked' }, { code: 'A5', state: 'available' }, { code: 'A6', state: 'available' },
  { code: 'A7', state: 'booked' }, { code: 'A8', state: 'booked' },
  { code: 'B1', state: 'booked' }, { code: 'B2', state: 'available' }, { code: 'B3', state: 'available' },
  { code: 'B4', state: 'available' }, { code: 'B5', state: 'available' }, { code: 'B6', state: 'locked' },
  { code: 'B7', state: 'booked' }, { code: 'B8', state: 'available' },
  { code: 'C1', state: 'available' }, { code: 'C2', state: 'available' }, { code: 'C3', state: 'available' },
  { code: 'C4', state: 'booked' }, { code: 'C5', state: 'booked' }, { code: 'C6', state: 'available' },
  { code: 'C7', state: 'available' }, { code: 'C8', state: 'available' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const liveEventsQuery = useQuery({
    queryKey: ['landing-live-events'],
    queryFn: async () => (await apiClient.get<EventSummary[]>('/events')).data,
    retry: false,
  });
  const liveEvents = liveEventsQuery.data ?? [];

  // Interactive hero preview: live ticking 10-min seat hold + ambient live arena motion + 3D tilt
  const [ttlSeconds, setTtlSeconds] = useState(594);
  const [seats, setSeats] = useState(INITIAL_SEATS);
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['B3', 'B4']);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTtlSeconds((prev) => (prev > 1 ? prev - 1 : 600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Subtle ambient flash-drop activity on non-selected seats (pauses while user interacts)
  useEffect(() => {
    if (isCardHovered) return;
    const pulseTimer = setInterval(() => {
      setSeats((prev) => {
        const candidates = prev.filter(
          (s) => s.state !== 'booked' && !selectedSeats.includes(s.code),
        );
        if (candidates.length === 0) return prev;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return prev.map((s) =>
          s.code === pick.code
            ? { ...s, state: s.state === 'available' ? 'locked' : 'available' }
            : s,
        );
      });
    }, 2400);
    return () => clearInterval(pulseTimer);
  }, [isCardHovered, selectedSeats]);

  const toggleSeat = (code: string, state: SeatState) => {
    if (state !== 'available') return;
    setSelectedSeats((prev) => {
      if (prev.includes(code)) return prev.filter((s) => s !== code);
      if (prev.length >= 4) return prev;
      return [...prev, code];
    });
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - y) * 7,
      ry: (x - 0.5) * 8,
      gx: Math.round(x * 100),
      gy: Math.round(y * 100),
    });
  };

  const resetCardTilt = () => {
    setIsCardHovered(false);
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  };

  const heroEvent = liveEvents[0];
  const unitPriceRupees = heroEvent ? Math.round(heroEvent.minPricePaise / 100) : 1499;
  const mins = String(Math.floor(ttlSeconds / 60)).padStart(2, '0');
  const secs = String(ttlSeconds % 60).padStart(2, '0');
  const seatTotal = (selectedSeats.length * unitPriceRupees).toLocaleString('en-IN');
  const ringCircumference = 2 * Math.PI * 18;
  const ringOffset = ringCircumference * (1 - ttlSeconds / 600);

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Sticky Glass Navbar — Clean single Sign In button + Mobile Menu */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#top">
            <BrandLogo size="md" />
          </a>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-zinc-600 md:flex dark:text-zinc-400">
            {liveEvents.length > 0 && (
              <a href="#drops" className="transition hover:text-zinc-900 dark:hover:text-white">
                Live Drops
              </a>
            )}
            <a href="#how-it-works" className="transition hover:text-zinc-900 dark:hover:text-white">
              How It Works
            </a>
            <a href="#why-ticketdrop" className="transition hover:text-zinc-900 dark:hover:text-white">
              Why TicketDrop
            </a>
            <a href="#organizers" className="transition hover:text-zinc-900 dark:hover:text-white">
              For Organizers
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <Link
                to={roleDashboard(user.role)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-[#FF3366]/20 transition hover:bg-[#E62958] sm:px-4"
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-900 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] sm:px-4 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-[#FF3366]"
              >
                Sign In
              </Link>
            )}

            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 md:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="border-t border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-[#0D0D10]">
            <div className="flex flex-col gap-1 text-sm font-semibold">
              {[
                ...(liveEvents.length > 0 ? [{ href: '#drops', label: 'Live Drops' }] : []),
                { href: '#how-it-works', label: 'How It Works' },
                { href: '#why-ticketdrop', label: 'Why TicketDrop' },
                { href: '#organizers', label: 'For Organizers' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-zinc-700 transition hover:bg-zinc-100 hover:text-[#FF3366] dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden border-b border-zinc-200/70 dark:border-zinc-800/70">
        {/* Subtle Architectural Dot Grid + Multi-Layer Drifting Aurora */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(113,113,122,0.16)_1px,transparent_0)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,#000_45%,transparent_100%)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)]"
        />
        <div
          aria-hidden="true"
          className="animate-aurora pointer-events-none absolute -top-28 left-[14%] h-[26rem] w-[26rem] rounded-full bg-[#FF3366]/20 blur-[110px] dark:bg-[#FF3366]/22"
        />
        <div
          aria-hidden="true"
          className="animate-aurora-delayed pointer-events-none absolute -bottom-24 right-[10%] h-[24rem] w-[24rem] rounded-full bg-amber-500/15 blur-[110px] dark:bg-amber-500/18"
        />
        <div
          aria-hidden="true"
          className="animate-aurora pointer-events-none absolute top-1/3 right-[28%] h-64 w-64 rounded-full bg-violet-500/10 blur-[100px] dark:bg-violet-500/15"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-6">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#FF3366]/25 bg-[#FF3366]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[#FF3366] backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3366] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3366]" />
                </span>
                NEXT-GEN FLASH-SALE TICKETING
              </span>

              <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-[3.45rem] dark:text-white">
                Live events without{' '}
                <span className="animate-gradient-text bg-gradient-to-r from-[#FF3366] via-amber-500 to-[#FF3366] bg-clip-text text-transparent">
                  refresh hell.
                </span>
              </h1>
            </div>

            <p className="animate-fade-up-delay-1 mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Lock seats fairly with 10-minute exclusive timers, get auto-matched the instant a
              ticket drops back into inventory, and buy price-capped fan resale tickets with
              tamper-proof rotated QR passes.
            </p>

            <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={user ? roleDashboard(user.role) : '/login'}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#FF3366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/30 transition duration-300 hover:-translate-y-0.5 hover:bg-[#E62958] hover:shadow-xl hover:shadow-[#FF3366]/40"
              >
                <span
                  aria-hidden="true"
                  className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />
                <span className="relative">Get Started</span>
                <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/organizer/auth"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white/90 px-5 py-3.5 text-sm font-semibold text-zinc-800 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#FF3366]/50 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-200"
              >
                <Building2 className="h-4 w-4 text-[#FF3366]" /> Host an Event
              </Link>
            </div>

            <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Zero double-bookings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Max 110% resale cap
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> AI Event Concierge
              </span>
            </div>
          </div>

          {/* Right Live Interactive 3D Glass Arena Showcase */}
          <div className="animate-fade-up-delay-1 relative lg:col-span-6">
            {/* Soft Ambient Halo Behind Card */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-[#FF3366]/25 via-amber-500/15 to-violet-500/20 opacity-70 blur-2xl transition-opacity duration-500 dark:opacity-80"
            />

            {/* Floating Micro-Badge: Top Right */}
            <div className="animate-float-badge pointer-events-none absolute -top-4 right-4 z-20 hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 shadow-lg backdrop-blur-md sm:flex dark:bg-zinc-900/95 dark:text-emerald-400">
              <QrCode className="h-3.5 w-3.5" /> Instant QR Pass
            </div>

            {/* Floating Micro-Badge: Bottom Left */}
            <div className="animate-float-badge-delayed pointer-events-none absolute -bottom-4 left-4 z-20 hidden items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-lg backdrop-blur-md sm:flex dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Fair Queue Active
            </div>

            <div
              onMouseEnter={() => setIsCardHovered(true)}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={resetCardTilt}
              style={{
                transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transition: isCardHovered
                  ? 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              className="relative rounded-[1.75rem] bg-gradient-to-b from-zinc-300/80 via-zinc-200/50 to-[#FF3366]/35 p-[1px] shadow-2xl shadow-zinc-900/15 dark:from-zinc-700/70 dark:via-zinc-800/60 dark:to-[#FF3366]/45 dark:shadow-black/50"
            >
              <div className="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-white/95 backdrop-blur-xl dark:bg-[#111115]/95">
                {/* Cursor-Following Specular Spotlight */}
                <div
                  aria-hidden="true"
                  style={{
                    background: `radial-gradient(360px circle at ${tilt.gx}% ${tilt.gy}%, rgba(255, 51, 102, 0.14), transparent 65%)`,
                  }}
                  className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                />

                {/* Card Header */}
                <div className="relative flex items-center justify-between gap-3 border-b border-dashed border-zinc-200/90 px-5 py-4 sm:px-6 sm:py-5 dark:border-zinc-800/90">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#FF3366]">
                      <Zap className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {heroEvent ? `LIVE DROP · ${heroEvent.city}` : 'INTERACTIVE ARENA PREVIEW'}
                      </span>
                    </div>
                    <h2 className="mt-1 truncate text-base font-extrabold text-zinc-900 sm:text-lg dark:text-white">
                      {heroEvent ? heroEvent.title : 'Experience Real-Time Seat Holds'}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {heroEvent
                        ? `${heroEvent.venueName} · ${formatEventDate(heroEvent.eventStartAt)}`
                        : 'Tap open green seats below to test instant 10-min checkout locks'}
                    </p>
                  </div>

                  {/* Animated Circular Progress Countdown Ring */}
                  <div className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-[#FF3366]/25 bg-[#FF3366]/10 px-3 py-2">
                    <svg className="h-9 w-9 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        className="text-[#FF3366]/20"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="#FF3366"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                      />
                    </svg>
                    <div className="text-right">
                      <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        HOLD TIMER
                      </div>
                      <div className="font-mono text-sm font-extrabold text-[#FF3366] tabular-nums sm:text-base">
                        {mins}:{secs}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Mini-Arena */}
                <div className="relative p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono font-semibold text-zinc-500">
                      TAP GREEN SEATS TO LOCK
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Open
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-[#FF3366]" /> Yours
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-sm bg-amber-500" /> Held
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-50/90 p-3.5 sm:p-4 dark:border-zinc-800/80 dark:bg-[#0A0A0E]">
                    {/* Curved Illuminated Main Stage + Soft Spotlight Beam */}
                    <div className="relative mb-3.5 flex flex-col items-center">
                      <div
                        aria-hidden="true"
                        className="animate-stage-beam pointer-events-none absolute -top-2 h-14 w-3/4 rounded-full bg-gradient-to-b from-[#FF3366]/25 via-amber-500/10 to-transparent blur-xl"
                      />
                      <svg
                        viewBox="0 0 260 22"
                        className="h-5 w-4/5 overflow-visible"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient id="heroStageArc" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#FF3366" stopOpacity="0.15" />
                            <stop offset="50%" stopColor="#FF3366" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.15" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 10 18 Q 130 2 250 18"
                          fill="none"
                          stroke="url(#heroStageArc)"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="-mt-1 font-mono text-[9px] font-semibold tracking-[0.26em] text-zinc-400 uppercase">
                        MAIN STAGE
                      </span>
                    </div>

                    <div className="relative grid grid-cols-8 gap-1.5 sm:gap-2">
                      {seats.map((seat) => {
                        const isSelected = selectedSeats.includes(seat.code);
                        return (
                          <button
                            key={seat.code}
                            type="button"
                            disabled={seat.state !== 'available' && !isSelected}
                            onClick={() => toggleSeat(seat.code, seat.state)}
                            title={
                              seat.state === 'available'
                                ? `Seat ${seat.code} — Tap to select`
                                : `Seat ${seat.code} (${seat.state})`
                            }
                            className={`flex h-6 items-center justify-center rounded-md font-mono text-[8px] font-bold transition-all duration-300 ease-out sm:h-7 sm:rounded-lg sm:text-[9px] ${
                              isSelected
                                ? 'animate-seat-pop bg-gradient-to-b from-[#FF3366] to-[#E62958] text-white shadow-md shadow-[#FF3366]/45 ring-2 ring-[#FF3366]/40'
                                : seat.state === 'locked'
                                  ? 'cursor-not-allowed border border-dashed border-amber-500/45 bg-amber-500/15 text-amber-500/80'
                                  : seat.state === 'booked'
                                    ? 'cursor-not-allowed bg-zinc-200/80 text-zinc-400 dark:bg-zinc-800/75 dark:text-zinc-600'
                                    : 'cursor-pointer bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/35 hover:-translate-y-0.5 hover:scale-105 hover:bg-emerald-500/30 hover:shadow-sm hover:shadow-emerald-500/20 dark:text-emerald-400'
                            }`}
                          >
                            {seat.code}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selection Summary Bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-zinc-100/90 px-4 py-3 font-mono text-xs dark:border-zinc-800/80 dark:bg-zinc-900/90">
                    <span className="text-zinc-600 dark:text-zinc-300">
                      {selectedSeats.length > 0 ? (
                        <>
                          {selectedSeats.length} Seat{selectedSeats.length > 1 ? 's' : ''} (
                          {selectedSeats.join(', ')}) ·{' '}
                          <strong className="text-zinc-900 dark:text-white">₹{seatTotal}</strong>
                        </>
                      ) : (
                        'Tap any green seat above to preview lock'
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Lock className="h-3 w-3" /> Exclusive Hold
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Consumer Trust Metrics Strip */}
      <section className="border-b border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-[#0D0D10]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
          {[
            { value: '100%', label: 'Verified & Tamper-Proof QR Passes' },
            { value: '10 min', label: 'Guaranteed Exclusive Seat Lock' },
            { value: '110%', label: 'Strict Max Fan Resale Price Cap' },
            { value: 'Instant', label: 'Auto-Waitlist Seat Claim Alerts' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
                {stat.value}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Real Live Drops from Database (Hidden completely if 0 live events — zero fake data!) */}
      {liveEvents.length > 0 && (
        <section id="drops" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#FF3366]">
                  LIVE NOW
                </span>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  Current live experiences
                </h2>
              </div>
              <Link
                to={user ? roleDashboard(user.role) : '/login'}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF3366] hover:underline"
              >
                {user ? 'Browse all in dashboard' : 'Sign in to book or join waitlists'}{' '}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {liveEvents.slice(0, 6).map((ev, idx) => {
              const art = getEventArt(ev.category);
              return (
                <Reveal key={ev.id} delay={idx * 90}>
                  <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition duration-300 hover:-translate-y-1.5 hover:border-[#FF3366]/40 hover:shadow-2xl dark:border-zinc-800 dark:bg-[#111114]">
                    <div className={`relative h-48 overflow-hidden bg-gradient-to-br ${art.accent}`}>
                      <img
                        src={art.image}
                        alt={ev.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/15" />
                      <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-1.5">
                        {ev.flashSaleEnabled && (
                          <span className="inline-flex rounded-md bg-[#FF3366] px-2.5 py-1 font-mono text-[10px] font-bold text-white shadow">
                            FLASH DROP
                          </span>
                        )}
                        {ev.seatingMode === 'STANDING' && (
                          <span className="inline-flex rounded-md bg-black/60 px-2.5 py-1 font-mono text-[10px] font-bold text-white backdrop-blur-md">
                            STANDING
                          </span>
                        )}
                      </div>
                      <div className="absolute right-3.5 bottom-3 left-3.5 flex items-center justify-between font-mono text-[11px] font-semibold text-white">
                        <span className="rounded bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                          {ev.category}
                        </span>
                        <span className="text-emerald-300">
                          {ev.availableSeats} {ev.seatingMode === 'STANDING' ? 'passes' : 'seats'} left
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-white">{ev.title}</h3>
                        <div className="mt-2 space-y-1 text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-[#FF3366]" /> {ev.venueName}, {ev.city}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> {formatEventDate(ev.eventStartAt)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-zinc-400">Starting</div>
                          <div className="font-mono text-base font-extrabold text-zinc-900 dark:text-white">
                            {formatRupees(ev.minPricePaise)}
                          </div>
                        </div>
                        <Link
                          to={user?.role === 'USER' ? `/events/${ev.id}` : '/login'}
                          className="inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#FF3366] dark:bg-zinc-800 dark:hover:bg-[#FF3366]"
                        >
                          Book Drop <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* How It Works — 3-Step Flow */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-t border-zinc-200/70 bg-white py-24 dark:border-zinc-800/70 dark:bg-[#0D0D10]"
      >
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="max-w-2xl">
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#FF3366]">
                HOW IT WORKS
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                From discovery to venue gate in 3 fair steps
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: Users,
                title: 'Enter Fair Waiting Room',
                desc: 'During high-demand drops, fans enter a fair virtual queue with live position updates—no bot flooding or page crashes.',
              },
              {
                step: '02',
                icon: Lock,
                title: 'Lock Seats for 10 Minutes',
                desc: 'Pick adjacent seats on the interactive venue map. Your selection is exclusively locked while you complete checkout peacefully.',
              },
              {
                step: '03',
                icon: QrCode,
                title: 'Instant QR or Verified Resale',
                desc: 'Receive a tamper-proof QR pass in your wallet. Plans changed? Resell safely within the organizer price cap with automatic QR rotation.',
              },
            ].map(({ step, icon: Icon, title, desc }, idx) => (
              <Reveal key={step} delay={idx * 120}>
                <div className="relative h-full rounded-2xl border border-zinc-200 bg-zinc-50/70 p-6 transition hover:border-[#FF3366]/40 dark:border-zinc-800 dark:bg-[#111114]">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF3366]/15 text-[#FF3366]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-2xl font-extrabold text-zinc-200 dark:text-zinc-800">
                      {step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why TicketDrop — 4 Differentiators Bento */}
      <section
        id="why-ticketdrop"
        className="scroll-mt-20 border-t border-zinc-200/70 py-24 dark:border-zinc-800/70"
      >
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="max-w-2xl">
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#FF3366]">
                ENGINEERED DIFFERENTLY
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                Built to solve what legacy ticket platforms ignore
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Lock,
                title: 'Fair 10-Minute Seat Locks',
                desc: 'Once you select your seats, they are exclusively held for you for 10 full minutes—no disappearing carts or double-bookings during sold-out drops.',
                badge: 'Zero Double-Booking',
              },
              {
                icon: RefreshCw,
                title: 'Smart Auto-Waitlist (Zero Refresh Hell)',
                desc: 'Set your seat count and budget once. The instant an unpaid seat drops back into inventory, it is automatically held for the next matching fan.',
                badge: 'Instant Claim',
              },
              {
                icon: ShieldCheck,
                title: 'Anti-Scalper Price-Capped Resale',
                desc: 'Organizers cap fan-to-fan resale prices so tickets stay fair. When a pass is resold, the old QR is instantly invalidated and a fresh verified pass is issued.',
                badge: 'Escrow Protected',
              },
              {
                icon: Sparkles,
                title: 'AI Event Concierge & Pricing Co-Pilot',
                desc: 'Search naturally by vibe, city, budget, and adjacent seats—while organizers get real-time demand insights to price every tier accurately.',
                badge: 'Smart Discovery',
              },
            ].map(({ icon: Icon, title, desc, badge }, idx) => (
              <Reveal key={title} delay={idx * 90}>
                <div className="h-full rounded-2xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-1 hover:border-[#FF3366]/40 hover:shadow-xl dark:border-zinc-800 dark:bg-[#111114]">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF3366]/15 text-[#FF3366]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-mono text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-zinc-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* For Organizers CTA Banner */}
      <section id="organizers" className="scroll-mt-20 mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-[#09090B] p-8 text-white shadow-2xl sm:p-12">
            <div className="animate-pulse-glow pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[#FF3366]/25 blur-3xl" />
            <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold text-amber-300">
                  <Ticket className="h-3.5 w-3.5" /> TICKETDROP STUDIO
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
                  Want to organize an event?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Launch concerts, festivals, or standup tours with custom multi-tier seat maps,
                  anti-scalper resale caps, and AI demand forecasting.
                </p>
              </div>

              <Link
                to="/organizer/auth"
                className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#FF3366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958]"
              >
                Launch in TicketDrop Studio
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#09090B]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <BrandLogo size="sm" />
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-zinc-500">
            <Link to="/login" className="hover:text-zinc-900 dark:hover:text-white">
              Fan Login
            </Link>
            <Link to="/organizer/auth" className="hover:text-zinc-900 dark:hover:text-white">
              Organizer Studio
            </Link>
          </div>
          <div className="font-mono text-[11px] text-zinc-500">
            © {new Date().getFullYear()} TicketDrop AI · Built for Fair Live Events
          </div>
        </div>
      </footer>
    </div>
  );
}
