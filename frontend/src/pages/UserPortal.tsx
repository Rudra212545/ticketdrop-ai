import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Ticket,
  LogOut,
  Moon,
  Sun,
  Search,
  MapPin,
  Clock,
  ArrowRight,
  Zap,
  CheckCircle2,
  QrCode,
  Calendar,
  ShieldCheck,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from '../components/BrandLogo';
import { apiClient } from '../lib/api';
import { formatRupees, type EventSummary, type TicketResponse } from '../types/event';

const CATEGORY_ART: Record<string, { image: string; gradient: string }> = {
  CONCERT: {
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-[#FF3366] to-amber-500',
  },
  COMEDY: {
    image: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-violet-500 to-[#FF3366]',
  },
  FESTIVAL: {
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-emerald-500 to-cyan-500',
  },
  SPORTS: {
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-sky-500 to-blue-600',
  },
  TECH: {
    image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
    gradient: 'from-amber-500 to-[#FF3366]',
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

/** Deterministic crisp SVG visual QR badge derived from the signed qrTokenId */
function TicketQrVisual({ seed, size = 'sm' }: { seed: string; size?: 'sm' | 'lg' }) {
  const cells = useMemo(() => {
    const grid: boolean[] = [];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < 49; i++) {
      const row = Math.floor(i / 7);
      const col = i % 7;
      const isCorner =
        (row < 2 && col < 2) || (row < 2 && col > 4) || (row > 4 && col < 2);
      grid.push(isCorner || ((hash >> (i % 24)) & 1) === 1 || ((i * 17 + seed.charCodeAt(i % seed.length)) % 3 === 0));
    }
    return grid;
  }, [seed]);

  return (
    <div
      className={`rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition-transform duration-300 ${
        size === 'lg' ? 'p-4 shadow-xl' : 'p-2 group-hover:scale-105'
      }`}
    >
      <div className={`grid grid-cols-7 ${size === 'lg' ? 'h-40 w-40 gap-1' : 'h-14 w-14 gap-0.5'}`}>
        {cells.map((filled, idx) => (
          <span
            key={idx}
            className={`rounded-[2px] ${filled ? 'bg-zinc-950' : 'bg-transparent'}`}
          />
        ))}
      </div>
    </div>
  );
}

const CATEGORIES = ['ALL', 'CONCERT', 'COMEDY', 'FESTIVAL', 'SPORTS', 'TECH'] as const;

export default function UserPortal() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<'events' | 'tickets'>('events');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [slideIdx, setSlideIdx] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [activePass, setActivePass] = useState<TicketResponse | null>(null);

  useEffect(() => {
    if (!activePass) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePass(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePass]);

  const eventsQuery = useQuery({
    queryKey: ['published-events'],
    queryFn: async () => (await apiClient.get<EventSummary[]>('/events')).data,
  });

  const ticketsQuery = useQuery({
    queryKey: ['my-tickets'],
    queryFn: async () => (await apiClient.get<TicketResponse[]>('/tickets/me')).data,
  });

  const allEvents = eventsQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEvents.filter((ev) => {
      const matchesCat = selectedCategory === 'ALL' || ev.category.toUpperCase() === selectedCategory;
      const matchesQuery =
        !q ||
        ev.title.toLowerCase().includes(q) ||
        ev.city.toLowerCase().includes(q) ||
        ev.venueName.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [allEvents, searchQuery, selectedCategory]);

  const spotlightEvents = useMemo(() => allEvents.slice(0, 5), [allEvents]);

  useEffect(() => {
    if (spotlightEvents.length <= 1 || carouselPaused) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % spotlightEvents.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [spotlightEvents.length, carouselPaused]);

  const activeSpotlight = spotlightEvents[slideIdx % Math.max(1, spotlightEvents.length)] ?? null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Subtle Drifting Ambient Top Aurora */}
      <div
        aria-hidden="true"
        className="animate-aurora pointer-events-none fixed -top-36 left-[12%] h-80 w-80 rounded-full bg-[#FF3366]/12 blur-[120px] dark:bg-[#FF3366]/14"
      />
      <div
        aria-hidden="true"
        className="animate-aurora-delayed pointer-events-none fixed -top-24 right-[10%] h-72 w-72 rounded-full bg-amber-500/10 blur-[110px] dark:bg-amber-500/12"
      />
      {/* Sticky Glass Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/">
            <BrandLogo size="md" />
          </Link>

          <div className="hidden items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 md:flex dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => setTab('events')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                tab === 'events'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Explore Drops ({allEvents.length})
            </button>
            <button
              onClick={() => setTab('tickets')}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                tab === 'tickets'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              My Passes ({tickets.length})
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="hidden items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 sm:flex dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF3366]/15 font-mono text-[11px] font-bold text-[#FF3366]">
                {user?.fullName?.charAt(0).toUpperCase() ?? 'F'}
              </div>
              <div className="text-left leading-tight">
                <div className="max-w-[130px] truncate text-xs font-bold text-zinc-900 dark:text-white">
                  {user?.fullName}
                </div>
                <div className="max-w-[130px] truncate text-[10px] text-zinc-500">
                  {user?.email}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-700 transition hover:border-rose-500/40 hover:text-rose-600 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="border-b border-zinc-200 bg-white px-4 py-2.5 md:hidden dark:border-zinc-800 dark:bg-[#0D0D10]">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            onClick={() => setTab('events')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              tab === 'events'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500'
            }`}
          >
            Explore Drops ({allEvents.length})
          </button>
          <button
            onClick={() => setTab('tickets')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              tab === 'tickets'
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-500'
            }`}
          >
            My Passes ({tickets.length})
          </button>
        </div>
      </div>

      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'events' && (
          <div className="animate-fade-up space-y-8">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="group relative w-full md:max-w-md">
                <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#FF3366]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events, venues, or cities..."
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white/95 pr-10 pl-10 text-sm text-zinc-900 shadow-xs outline-none backdrop-blur-sm transition duration-200 focus:border-[#FF3366] focus:ring-4 focus:ring-[#FF3366]/10 dark:border-zinc-800 dark:bg-[#111114]/95 dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <SlidersHorizontal className="mr-1 h-4 w-4 shrink-0 text-zinc-400" />
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                      selectedCategory === cat
                        ? 'bg-[#FF3366] text-white shadow-md shadow-[#FF3366]/30'
                        : 'border border-zinc-200 bg-white/90 text-zinc-600 hover:-translate-y-0.5 hover:border-[#FF3366]/40 hover:text-zinc-900 dark:border-zinc-800 dark:bg-[#111114]/90 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {eventsQuery.isLoading && (
              <div className="space-y-6">
                <div className="h-64 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-900/70" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-900/60"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Cinematic Auto-Sliding Spotlight Carousel Across All Live Drops */}
            {activeSpotlight && !searchQuery && selectedCategory === 'ALL' && (
              <div
                onMouseEnter={() => setCarouselPaused(true)}
                onMouseLeave={() => setCarouselPaused(false)}
                className="group relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-[#09090B] text-white shadow-2xl shadow-zinc-900/15 transition-shadow duration-500 hover:shadow-[#FF3366]/15 dark:border-zinc-800 dark:shadow-black/60"
              >
                <img
                  key={activeSpotlight.id}
                  src={getEventArt(activeSpotlight.category).image}
                  alt={activeSpotlight.title}
                  className="animate-ken-burns absolute inset-0 h-full w-full object-cover opacity-55"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/80 to-[#09090B]/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090B]/90 via-transparent to-transparent" />

                <div
                  key={`content-${activeSpotlight.id}`}
                  className="animate-slide-reveal relative z-10 grid gap-5 p-6 sm:p-8 lg:grid-cols-12 lg:items-end"
                >
                  <div className="lg:col-span-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3366] px-3 py-1 font-mono text-[10px] font-extrabold tracking-wider text-white shadow-md shadow-[#FF3366]/40">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        SPOTLIGHT {slideIdx + 1}/{spotlightEvents.length}
                      </span>
                      <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-bold text-white backdrop-blur">
                        {activeSpotlight.seatingMode === 'STANDING' ? 'OPEN-GROUND STANDING' : 'ASSIGNED SEATING'}
                      </span>
                      {activeSpotlight.flashSaleEnabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-bold text-amber-300 backdrop-blur">
                          <Zap className="h-3 w-3" /> FAIR QUEUE
                        </span>
                      )}
                      {activeSpotlight.resaleEnabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold text-emerald-300 backdrop-blur">
                          <ShieldCheck className="h-3 w-3" /> RESALE CAP{' '}
                          {Math.round(activeSpotlight.maxResaleMultiplier * 100)}%
                        </span>
                      )}
                    </div>

                    <h1 className="mt-3.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {activeSpotlight.title}
                    </h1>
                    <p className="mt-2 line-clamp-2 max-w-2xl text-xs leading-relaxed text-zinc-300 sm:text-sm">
                      {activeSpotlight.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-zinc-200">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-[#FF3366]" /> {activeSpotlight.venueName},{' '}
                        {activeSpotlight.city}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-amber-400" />{' '}
                        {formatEventDate(activeSpotlight.eventStartAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:col-span-4 lg:items-end">
                    <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-2.5 backdrop-blur-md transition-transform duration-300 group-hover:scale-[1.02] lg:text-right">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        {activeSpotlight.availableSeats} of {activeSpotlight.totalSeats}{' '}
                        {activeSpotlight.seatingMode === 'STANDING' ? 'passes' : 'seats'} open
                      </div>
                      <div className="mt-0.5 font-mono text-xl font-extrabold text-white">
                        From {formatRupees(activeSpotlight.minPricePaise)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/events/${activeSpotlight.id}`}
                        className="group/btn relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#FF3366] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#FF3366]/35 transition duration-300 hover:-translate-y-0.5 hover:bg-[#E62958] hover:shadow-xl hover:shadow-[#FF3366]/45 sm:text-sm"
                      >
                        <span
                          aria-hidden="true"
                          className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                        />
                        <span className="relative">Book Tickets</span>
                        <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Carousel Controls + Smooth Auto-Progress Bar (when 2+ live events exist) */}
                {spotlightEvents.length > 1 && (
                  <div className="relative z-10 border-t border-white/10 bg-black/35 backdrop-blur-xs">
                    <div className="flex items-center justify-between px-6 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {spotlightEvents.map((ev, i) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setSlideIdx(i)}
                            aria-label={`Show ${ev.title}`}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i === slideIdx ? 'w-7 bg-[#FF3366]' : 'w-2 bg-white/30 hover:bg-white/60'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSlideIdx((prev) => (prev - 1 + spotlightEvents.length) % spotlightEvents.length)
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:scale-105 hover:bg-white/20 active:scale-95"
                          title="Previous event"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideIdx((prev) => (prev + 1) % spotlightEvents.length)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:scale-105 hover:bg-white/20 active:scale-95"
                          title="Next event"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="h-[2px] w-full bg-white/10">
                      {!carouselPaused && (
                        <div
                          key={`prog-${slideIdx}`}
                          className="animate-progress-fill h-full w-full bg-gradient-to-r from-[#FF3366] via-amber-400 to-[#FF3366]"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live Drops Grid */}
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                    Live Ticket Drops
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    10-minute exclusive seat holds with instant verified digital passes.
                  </p>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
                </span>
              </div>

              {!eventsQuery.isLoading && filteredEvents.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-[#111114]">
                  <Ticket className="mx-auto h-8 w-8 text-zinc-400" />
                  <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-white">
                    No matching live drops
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Try clearing your city or category filter, or check back soon for new drops.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredEvents.map((ev, idx) => {
                    const art = getEventArt(ev.category);
                    const pctRemaining =
                      ev.totalSeats > 0 ? Math.round((ev.availableSeats / ev.totalSeats) * 100) : 0;
                    return (
                      <div
                        key={ev.id}
                        style={{ animationDelay: `${Math.min(idx, 5) * 70}ms` }}
                        className="animate-fade-up group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-300 hover:-translate-y-1.5 hover:border-[#FF3366]/55 hover:shadow-2xl hover:shadow-[#FF3366]/10 dark:border-zinc-800 dark:bg-[#111114]"
                      >
                        {/* Cover Artwork */}
                        <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${art.gradient}`}>
                          <img
                            src={art.image}
                            alt={ev.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/15" />

                          <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
                            <span className="rounded-md bg-black/55 px-2.5 py-1 font-mono text-[10px] font-bold text-white backdrop-blur">
                              {ev.category}
                            </span>
                            {ev.flashSaleEnabled && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#FF3366] px-2.5 py-1 font-mono text-[10px] font-bold text-white shadow">
                                <Zap className="h-3 w-3" /> FLASH DROP
                              </span>
                            )}
                          </div>

                          <div className="absolute right-3.5 bottom-3 left-3.5 flex items-center justify-between font-mono text-[11px] font-semibold text-white">
                            <span>{ev.city}</span>
                            <span className="text-emerald-300">
                              {ev.availableSeats} / {ev.totalSeats}{' '}
                              {ev.seatingMode === 'STANDING' ? 'passes' : 'open'}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="flex flex-1 flex-col justify-between p-5">
                          <div>
                            <h3 className="text-base font-extrabold text-zinc-900 transition-colors group-hover:text-[#FF3366] dark:text-white">
                              {ev.title}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                              {ev.description}
                            </p>

                            <div className="mt-3.5 space-y-1.5 text-xs text-zinc-500">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF3366]" />
                                <span className="truncate">{ev.venueName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                <span>{formatEventDate(ev.eventStartAt)}</span>
                              </div>
                            </div>

                            {/* Availability bar */}
                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div
                                style={{ width: `${pctRemaining}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-[#FF3366] to-amber-500 transition-all duration-700"
                              />
                            </div>
                          </div>

                          <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                Starting at
                              </div>
                              <div className="font-mono text-base font-extrabold text-zinc-900 dark:text-white">
                                {formatRupees(ev.minPricePaise)}
                              </div>
                            </div>
                            <Link
                              to={`/events/${ev.id}`}
                              className="group/cta inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-[#FF3366]/25 transition duration-200 hover:bg-[#E62958] hover:shadow-md hover:shadow-[#FF3366]/35 active:scale-95"
                            >
                              {ev.seatingMode === 'STANDING' ? 'Select Passes' : 'Select Seats'}{' '}
                              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Digital Passes Wallet */}
        {tab === 'tickets' && (
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  My Verified Passes
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Tap any pass to open a full-screen scannable Gate Pass for venue entry.
                </p>
              </div>
              <span className="font-mono text-xs text-zinc-500">
                {tickets.length} active pass{tickets.length === 1 ? '' : 'es'}
              </span>
            </div>

            {tickets.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-14 text-center dark:border-zinc-800 dark:bg-[#111114]">
                <QrCode className="mx-auto h-9 w-9 text-zinc-400" />
                <h2 className="mt-3 text-base font-bold text-zinc-900 dark:text-white">
                  Your pass wallet is empty
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Book a live drop to receive your instant verified QR passes here.
                </p>
                <button
                  onClick={() => setTab('events')}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#E62958]"
                >
                  Explore Live Drops <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {tickets.map((t, idx) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActivePass(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActivePass(t);
                      }
                    }}
                    style={{ animationDelay: `${Math.min(idx, 5) * 65}ms` }}
                    className="animate-fade-up group relative cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-[#FF3366]/50 hover:shadow-2xl hover:shadow-[#FF3366]/10 dark:border-zinc-800 dark:bg-[#111114]"
                  >
                    <div className="h-2 bg-gradient-to-r from-[#FF3366] via-amber-500 to-[#FF3366]" />

                    {/* Top Pass Details + QR Visual */}
                    <div className="relative flex items-start justify-between gap-4 border-b border-dashed border-zinc-200 p-5 sm:p-6 dark:border-zinc-700/80">
                      <span className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full bg-zinc-50 dark:bg-[#09090B]" />
                      <span className="absolute -right-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-zinc-50 dark:bg-[#09090B]" />

                      <div className="min-w-0">
                        <span className="inline-flex rounded-md bg-[#FF3366]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#FF3366]">
                          {t.tierName} · {t.city}
                        </span>
                        <h3 className="mt-2 text-lg font-extrabold text-zinc-900 transition-colors group-hover:text-[#FF3366] dark:text-white">
                          {t.eventTitle}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF3366]" /> {t.venueName}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                          <Calendar className="h-3.5 w-3.5 shrink-0" /> {formatEventDate(t.eventStartAt)}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-1.5">
                        <TicketQrVisual seed={t.qrTokenId} />
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold text-zinc-400 transition group-hover:text-[#FF3366]">
                          <Maximize2 className="h-2.5 w-2.5" /> TAP QR
                        </span>
                      </div>
                    </div>

                    {/* Bottom Stub Strip */}
                    <div className="flex items-center justify-between bg-zinc-50 px-5 py-4 sm:px-6 dark:bg-zinc-950/60">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">
                            PASS
                          </div>
                          <div className="font-mono text-sm font-extrabold text-zinc-900 dark:text-white">
                            {t.passLabel}
                          </div>
                        </div>
                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />
                        <div>
                          <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">
                            PAID
                          </div>
                          <div className="font-mono text-sm font-bold text-zinc-900 dark:text-white">
                            {formatRupees(t.pricePaise)}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Interactive Full-Screen Gate Pass Modal */}
      {activePass && (
        <div
          onClick={() => setActivePass(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-pop relative w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#111115]"
          >
            <div className="h-2.5 bg-gradient-to-r from-[#FF3366] via-amber-500 to-[#FF3366]" />

            <button
              type="button"
              onClick={() => setActivePass(null)}
              aria-label="Close Gate Pass"
              className="absolute top-5 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                VERIFIED GATE PASS · {activePass.status}
              </div>

              <h2 className="mt-3 text-xl font-extrabold text-zinc-900 dark:text-white">
                {activePass.eventTitle}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {activePass.venueName}, {activePass.city}
              </p>
              <p className="mt-0.5 font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                {formatEventDate(activePass.eventStartAt)}
              </p>

              <div className="mt-5 flex justify-center">
                <TicketQrVisual seed={activePass.qrTokenId} size="lg" />
              </div>

              <div className="mt-4 font-mono text-[10px] text-zinc-400">
                TOKEN · {activePass.qrTokenId.slice(0, 18).toUpperCase()}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-left dark:border-zinc-800 dark:bg-zinc-900/70">
                <div>
                  <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">
                    PASS / SEAT
                  </div>
                  <div className="font-mono text-sm font-extrabold text-zinc-900 dark:text-white">
                    {activePass.passLabel}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">
                    TIER
                  </div>
                  <div className="truncate font-mono text-sm font-bold text-[#FF3366]">
                    {activePass.tierName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
