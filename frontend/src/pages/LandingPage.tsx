import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Moon,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Users,
  Zap,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Role } from '../types/auth';

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

const featuredDrops = [
  {
    title: 'Midnight Indie & Synth Fest',
    category: 'CONCERT',
    city: 'Pune',
    venue: 'Mahalaxmi Lawns Arena',
    date: 'Sat, Nov 28 · 7:30 PM',
    price: '₹1,499',
    tag: 'FLASH DROP',
    seatsLeft: '42 seats left',
    accent: 'from-[#FF3366] to-amber-500',
    image:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Late Night Standup: Raw & Uncut',
    category: 'COMEDY',
    city: 'Mumbai',
    venue: 'Habitat Comedy Club',
    date: 'Sun, Nov 29 · 8:00 PM',
    price: '₹799',
    tag: 'AUTO-WAITLIST ON',
    seatsLeft: 'Waitlist open',
    accent: 'from-violet-500 to-[#FF3366]',
    image:
      'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Sunburn Echoes: Underground Electronic',
    category: 'FESTIVAL',
    city: 'Bengaluru',
    venue: 'Jayamahal Palace Grounds',
    date: 'Fri, Dec 4 · 6:00 PM',
    price: '₹2,199',
    tag: 'RESALE CAPPED 110%',
    seatsLeft: '118 seats left',
    accent: 'from-emerald-500 to-cyan-500',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
  },
];

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

  // Interactive hero preview: live ticking 10-min seat lock TTL + clickable seats
  const [ttlSeconds, setTtlSeconds] = useState(594);
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['B3', 'B4']);

  useEffect(() => {
    const timer = setInterval(() => {
      setTtlSeconds((prev) => (prev > 1 ? prev - 1 : 600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSeat = (code: string, state: SeatState) => {
    if (state !== 'available') return;
    setSelectedSeats((prev) => {
      if (prev.includes(code)) return prev.filter((s) => s !== code);
      if (prev.length >= 4) return prev;
      return [...prev, code];
    });
  };

  const mins = String(Math.floor(ttlSeconds / 60)).padStart(2, '0');
  const secs = String(ttlSeconds % 60).padStart(2, '0');
  const seatTotal = (selectedSeats.length * 1499).toLocaleString('en-IN');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Sticky Glass Navbar — Clean single Sign In button */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#top">
            <BrandLogo size="md" />
          </a>

          <nav className="hidden items-center gap-7 text-xs font-semibold text-zinc-600 md:flex dark:text-zinc-400">
            <a href="#drops" className="transition hover:text-zinc-900 dark:hover:text-white">
              Live Drops
            </a>
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

          <div className="flex items-center gap-2.5">
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#FF3366]/20 transition hover:bg-[#E62958]"
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-900 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-[#FF3366]"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden border-b border-zinc-200/70 dark:border-zinc-800/70">
        <div className="animate-pulse-glow pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[#FF3366]/20 blur-3xl" />
        <div className="animate-pulse-glow pointer-events-none absolute right-1/4 bottom-0 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-6">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#FF3366]/25 bg-[#FF3366]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[#FF3366]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3366] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3366]" />
                </span>
                NEXT-GEN FLASH-SALE TICKETING
              </span>

              <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-zinc-900 sm:text-5xl lg:text-[3.45rem] dark:text-white">
                Live events without{' '}
                <span className="bg-gradient-to-r from-[#FF3366] to-amber-500 bg-clip-text text-transparent">
                  refresh hell.
                </span>
              </h1>
            </div>

            <p className="animate-fade-up-delay-1 mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Lock seats fairly with 10-minute distributed timers, get auto-matched the instant a
              ticket drops back into inventory, and buy price-capped fan resale tickets with
              cryptographically rotated QR codes.
            </p>

            <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={user ? roleDashboard(user.role) : '/login'}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#FF3366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958]"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/organizer/auth"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-800 transition hover:-translate-y-0.5 hover:border-[#FF3366]/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
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

          {/* Right Live Interactive Preview Card (Clickable seats + real ticking countdown!) */}
          <div className="animate-fade-up-delay-1 lg:col-span-6">
            <div className="animate-float-slow overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111114]">
              <div className="flex items-center justify-between border-b border-dashed border-zinc-200 px-6 py-5 dark:border-zinc-800">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#FF3366]">
                    <Zap className="h-3 w-3" /> FLASH DROP LIVE · PUNE
                  </div>
                  <h2 className="mt-1 text-lg font-extrabold text-zinc-900 dark:text-white">
                    Midnight Indie &amp; Synth Fest 2026
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Mahalaxmi Lawns Arena · Sat, Nov 28 · 7:30 PM
                  </p>
                </div>
                <div className="rounded-xl border border-[#FF3366]/30 bg-[#FF3366]/10 px-3.5 py-2 text-right">
                  <div className="font-mono text-[9px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    SEAT LOCK TTL
                  </div>
                  <div className="font-mono text-base font-bold text-[#FF3366] tabular-nums">
                    {mins}:{secs}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-3 flex items-center justify-between text-[11px]">
                  <span className="font-mono font-semibold text-zinc-500">
                    TRY CLICKING GREEN SEATS
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Open
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-[#FF3366]" /> Selected
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-amber-500" /> Locked
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-8 gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800/80 dark:bg-zinc-950">
                  {INITIAL_SEATS.map((seat) => {
                    const isSelected = selectedSeats.includes(seat.code);
                    return (
                      <button
                        key={seat.code}
                        type="button"
                        disabled={seat.state !== 'available'}
                        onClick={() => toggleSeat(seat.code, seat.state)}
                        title={
                          seat.state === 'available'
                            ? `Seat ${seat.code} — Click to select`
                            : `Seat ${seat.code} (${seat.state})`
                        }
                        className={`flex h-7 items-center justify-center rounded-lg font-mono text-[9px] font-bold transition-all duration-200 ${
                          isSelected
                            ? 'scale-105 bg-[#FF3366] text-white shadow-md shadow-[#FF3366]/40 ring-2 ring-[#FF3366]/40'
                            : seat.state === 'locked'
                              ? 'cursor-not-allowed bg-amber-500/20 text-amber-500/70 ring-1 ring-amber-500/30'
                              : seat.state === 'booked'
                                ? 'cursor-not-allowed bg-zinc-300/60 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-600'
                                : 'cursor-pointer bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-500/40 hover:scale-105 hover:bg-emerald-500/35 dark:text-emerald-400'
                        }`}
                      >
                        {seat.code}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-3 font-mono text-xs dark:bg-zinc-900">
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
                    <Lock className="h-3 w-3" /> Redis Lock
                  </span>
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

      {/* Featured Upcoming Drops */}
      <section id="drops" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-[#FF3366]">
                UPCOMING DROPS
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                Trending live experiences
              </h2>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF3366] hover:underline"
            >
              Sign in to book or join waitlists <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {featuredDrops.map((ev, idx) => (
            <Reveal key={ev.title} delay={idx * 100}>
              <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition duration-300 hover:-translate-y-1.5 hover:border-[#FF3366]/40 hover:shadow-2xl dark:border-zinc-800 dark:bg-[#111114]">
                <div className={`relative h-48 overflow-hidden bg-gradient-to-br ${ev.accent}`}>
                  <img
                    src={ev.image}
                    alt={ev.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/15" />
                  <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                    <span className="inline-flex rounded-md bg-black/55 px-2.5 py-1 font-mono text-[10px] font-bold text-white backdrop-blur-md">
                      {ev.tag}
                    </span>
                  </div>
                  <div className="absolute right-3.5 bottom-3 left-3.5 flex items-center justify-between font-mono text-[11px] font-semibold text-white">
                    <span className="rounded bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                      {ev.category}
                    </span>
                    <span className="text-amber-300">{ev.seatsLeft}</span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">{ev.title}</h3>
                    <div className="mt-2 space-y-1 text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[#FF3366]" /> {ev.venue}, {ev.city}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {ev.date}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-zinc-400">Starting</div>
                      <div className="font-mono text-base font-extrabold text-zinc-900 dark:text-white">
                        {ev.price}
                      </div>
                    </div>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#FF3366] dark:bg-zinc-800 dark:hover:bg-[#FF3366]"
                    >
                      Book Drop <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

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
