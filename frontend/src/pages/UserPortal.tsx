import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
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
  RefreshCw,
  Copy,
  Check,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from '../components/BrandLogo';
import { apiClient } from '../lib/api';
import {
  formatRupees,
  type BookingResponse,
  type EventSummary,
  type ResaleListingResponse,
  type TicketResponse,
  type WaitlistEntryResponse,
} from '../types/event';

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

/** Real ISO-18004 scannable SVG QR code encoding the signed qrTokenId */
function TicketQrVisual({
  seed,
  size = 'sm',
  muted = false,
}: {
  seed: string;
  size?: 'sm' | 'lg';
  muted?: boolean;
}) {
  const px = size === 'lg' ? 192 : 76;
  return (
    <div
      className={`relative rounded-2xl bg-white shadow-md ring-1 ring-zinc-200/90 transition-transform duration-300 ${
        size === 'lg' ? 'p-4 shadow-2xl ring-2 ring-zinc-200' : 'p-2.5 group-hover:scale-105'
      } ${muted ? 'opacity-45 grayscale' : ''}`}
    >
      {/* Subtle scanner corner brackets */}
      <span className="pointer-events-none absolute top-1.5 left-1.5 h-2.5 w-2.5 rounded-tl-md border-t-2 border-l-2 border-[#FF3366]/60" />
      <span className="pointer-events-none absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-tr-md border-t-2 border-r-2 border-[#FF3366]/60" />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-2.5 w-2.5 rounded-bl-md border-b-2 border-l-2 border-[#FF3366]/60" />
      <span className="pointer-events-none absolute right-1.5 bottom-1.5 h-2.5 w-2.5 rounded-br-md border-r-2 border-b-2 border-[#FF3366]/60" />

      <QRCodeSVG
        value={seed}
        size={px}
        level="M"
        bgColor="#FFFFFF"
        fgColor="#09090B"
        marginSize={1}
      />
    </div>
  );
}

const CATEGORIES = ['ALL', 'CONCERT', 'COMEDY', 'FESTIVAL', 'SPORTS', 'TECH'] as const;

export default function UserPortal() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'events' | 'resale' | 'waitlist' | 'tickets'>('events');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [slideIdx, setSlideIdx] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [activePass, setActivePass] = useState<TicketResponse | null>(null);
  const [passFilter, setPassFilter] = useState<'ALL' | 'ACTIVE' | 'RESALE_LISTED' | 'USED' | 'REVOKED'>('ALL');
  const [copiedToken, setCopiedToken] = useState(false);
  const [resellTicket, setResellTicket] = useState<TicketResponse | null>(null);
  const [resellPriceRupees, setResellPriceRupees] = useState('');
  const [resellModalError, setResellModalError] = useState<string | null>(null);
  const [portalNotice, setPortalNotice] = useState<string | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setPortalError(null);
    setPortalNotice(msg);
    setTimeout(() => setPortalNotice(null), 4500);
  };

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

  const resaleQuery = useQuery({
    queryKey: ['resale-listings'],
    queryFn: async () => (await apiClient.get<ResaleListingResponse[]>('/resale')).data,
  });

  const waitlistQuery = useQuery({
    queryKey: ['my-waitlist'],
    queryFn: async () => (await apiClient.get<WaitlistEntryResponse[]>('/waitlist/me')).data,
    refetchInterval: 10_000,
  });

  const createResaleMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<ResaleListingResponse>('/resale', {
          ticketId: resellTicket!.id,
          askingPricePaise: Math.round(Number(resellPriceRupees) * 100),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['resale-listings'] });
      setResellTicket(null);
      setResellPriceRupees('');
      setResellModalError(null);
      showNotice('Pass listed on the Verified Resale Market!');
    },
    onError: (err: unknown) => {
      setResellModalError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Could not list pass for resale.',
      );
    },
  });

  const buyResaleMutation = useMutation({
    mutationFn: async (listingId: string) =>
      (await apiClient.post<ResaleListingResponse>(`/resale/${listingId}/purchase`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resale-listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      showNotice('Resale pass purchased! Old QR revoked and a freshly signed QR pass is now in My Passes.');
      setTab('tickets');
    },
    onError: (err: unknown) => {
      setPortalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not complete resale purchase.');
    },
  });

  const cancelResaleMutation = useMutation({
    mutationFn: async (listingId: string) => apiClient.delete(`/resale/${listingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resale-listings'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      showNotice('Resale listing cancelled. Your pass is ACTIVE again.');
    },
    onError: (err: unknown) => {
      setPortalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not cancel resale listing.');
    },
  });

  const leaveWaitlistMutation = useMutation({
    mutationFn: async (entryId: string) => apiClient.delete(`/waitlist/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
      showNotice('Removed from waitlist.');
    },
    onError: (err: unknown) => {
      setPortalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not leave waitlist.');
    },
  });

  const claimOfferMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const booking = (await apiClient.post<BookingResponse>(`/waitlist/${entryId}/claim`)).data;
      return (await apiClient.post<BookingResponse>(`/bookings/${booking.id}/confirm-payment`, { simulateFailure: false })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      showNotice('Waitlist offer claimed & paid! Your new QR pass is ready in My Passes.');
      setTab('tickets');
    },
    onError: (err: unknown) => {
      setPortalError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not claim offer.');
    },
  });

  const allEvents = eventsQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const resaleListings = resaleQuery.data ?? [];
  const waitlistEntries = waitlistQuery.data ?? [];
  const activeOfferCount = waitlistEntries.filter((w) => w.status === 'OFFERED').length;

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
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                tab === 'events'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Drops ({allEvents.length})
            </button>
            <button
              onClick={() => setTab('resale')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                tab === 'resale'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Resale ({resaleListings.length})
            </button>
            <button
              onClick={() => setTab('waitlist')}
              className={`relative rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                tab === 'waitlist'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Waitlist ({waitlistEntries.length})
              {activeOfferCount > 0 && (
                <span className="ml-1.5 inline-flex h-2 w-2 animate-ping rounded-full bg-[#FF3366]" />
              )}
            </button>
            <button
              onClick={() => setTab('tickets')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
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

            <Link
              to="/settings"
              title="Account Settings (Edit Profile, Password, Delete Account)"
              className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 transition hover:border-[#FF3366]/50 sm:px-3 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF3366]/15 font-mono text-[11px] font-bold text-[#FF3366]">
                {user?.fullName?.charAt(0).toUpperCase() ?? 'F'}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <div className="max-w-[130px] truncate text-xs font-bold text-zinc-900 dark:text-white">
                  {user?.fullName}
                </div>
                <div className="max-w-[130px] truncate text-[10px] text-zinc-500">
                  {user?.email}
                </div>
              </div>
            </Link>

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
      <div className="border-b border-zinc-200 bg-white px-3 py-2.5 md:hidden dark:border-zinc-800 dark:bg-[#0D0D10]">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {[
            { id: 'events' as const, label: `Drops (${allEvents.length})` },
            { id: 'resale' as const, label: `Resale (${resaleListings.length})` },
            { id: 'waitlist' as const, label: `Wait (${waitlistEntries.length})` },
            { id: 'tickets' as const, label: `Passes (${tickets.length})` },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-lg py-2 text-[11px] font-bold transition ${
                tab === item.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {(portalNotice || portalError) && (
          <div className="animate-slide-reveal fixed right-4 bottom-6 z-50 w-[calc(100vw-2rem)] max-w-sm">
            <div
              className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
                portalError
                  ? 'border-rose-500/40 bg-white/95 dark:bg-[#111115]/95'
                  : 'border-emerald-500/40 bg-white/95 dark:bg-[#111115]/95'
              }`}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  portalError
                    ? 'bg-rose-500/15 text-rose-500'
                    : 'bg-emerald-500/15 text-emerald-500'
                }`}
              >
                {portalError ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1 text-xs font-semibold text-zinc-900 dark:text-white">
                {portalError ?? portalNotice}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPortalNotice(null);
                  setPortalError(null);
                }}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
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

        {/* Verified Anti-Scalper Resale Market */}
        {tab === 'resale' && (
          <div className="animate-fade-up space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  Verified Fan Resale Market
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Every listing is strictly price-capped by the organizer. Buying instantly revokes the seller&apos;s QR and mints a fresh pass for you.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> ESCROW PROTECTED
                </span>
                <button
                  type="button"
                  onClick={() => setTab('tickets')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958] active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Sell My Pass
                </button>
              </div>
            </div>

            {/* 3-Pillar Escrow Guarantee Strip */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  tone: 'bg-emerald-500/15 text-emerald-500',
                  title: 'Strict Price Cap',
                  desc: 'Sellers cannot list above the organizer’s anti-scalper ceiling.',
                },
                {
                  icon: QrCode,
                  tone: 'bg-[#FF3366]/15 text-[#FF3366]',
                  title: 'Instant QR Rotation',
                  desc: 'Old seller screenshots are revoked immediately upon transfer.',
                },
                {
                  icon: Zap,
                  tone: 'bg-amber-500/15 text-amber-500',
                  title: 'Atomic Ownership',
                  desc: 'Pass transfers straight into your My Passes wallet in one click.',
                },
              ].map(({ icon: Icon, tone, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800/80 dark:bg-[#111115]/90"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white">{title}</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {resaleListings.length === 0 ? (
              <div className="relative overflow-hidden rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center sm:p-16 dark:border-zinc-800 dark:bg-[#111115]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-20 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
                />
                <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500 ring-1 ring-emerald-500/25">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <h2 className="relative mt-4 text-lg font-extrabold text-zinc-900 dark:text-white">
                  No active resale passes right now
                </h2>
                <p className="relative mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
                  Plans changed? List any active pass from your wallet at a fair capped price, or browse live primary drops.
                </p>
                <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTab('tickets')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958]"
                  >
                    List One of My Passes <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('events')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs font-semibold text-zinc-700 transition hover:border-[#FF3366]/40 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    Explore Live Drops
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {resaleListings.map((item, idx) => {
                  const isMine = item.sellerId === user?.id;
                  const markupPct =
                    item.originalPricePaise > 0
                      ? Math.round((item.askingPricePaise / item.originalPricePaise) * 100)
                      : 100;
                  return (
                    <div
                      key={item.id}
                      style={{ animationDelay: `${Math.min(idx, 5) * 65}ms` }}
                      className="animate-fade-up group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 dark:border-zinc-800/90 dark:bg-[#111115]"
                    >
                      <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-[#FF3366]" />

                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-emerald-500/12 blur-3xl transition-opacity group-hover:opacity-100"
                      />

                      <div className="relative p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-md bg-[#FF3366]/12 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#FF3366]">
                            {item.tierName} · {item.passLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" /> ≤ {formatRupees(item.maxAllowedPricePaise)}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-extrabold tracking-tight text-zinc-900 transition-colors group-hover:text-[#FF3366] dark:text-white">
                          {item.eventTitle}
                        </h3>
                        <div className="mt-2 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF3366]" />
                            <span className="truncate">{item.venueName}, {item.city}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>{formatEventDate(item.eventStartAt)}</span>
                          </p>
                        </div>

                        <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-[11px] dark:border-zinc-800/80 dark:bg-zinc-950/60">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[10px] font-bold text-emerald-500">
                            {item.sellerName.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate text-zinc-600 dark:text-zinc-300">
                            Seller: <strong className="text-zinc-900 dark:text-white">{item.sellerName}</strong>
                          </span>
                          <span className="ml-auto font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {markupPct}% face
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-dashed border-zinc-200 bg-zinc-50/90 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                        <div>
                          <div className="font-mono text-[10px] font-semibold uppercase text-zinc-400">
                            Face {formatRupees(item.originalPricePaise)}
                          </div>
                          <div className="font-mono text-lg font-extrabold text-zinc-900 dark:text-white">
                            {formatRupees(item.askingPricePaise)}
                          </div>
                        </div>
                        {isMine ? (
                          <button
                            disabled={cancelResaleMutation.isPending}
                            onClick={() => cancelResaleMutation.mutate(item.id)}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-500/20 active:scale-95 dark:text-rose-400"
                          >
                            Cancel Listing
                          </button>
                        ) : (
                          <button
                            disabled={buyResaleMutation.isPending}
                            onClick={() => buyResaleMutation.mutate(item.id)}
                            className="group/buy relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-[#FF3366] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958] active:scale-95 disabled:opacity-50"
                          >
                            <span
                              aria-hidden="true"
                              className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                            />
                            <span className="relative">Buy Escrow Pass</span>
                            <ArrowRight className="relative h-3.5 w-3.5 transition-transform group-hover/buy:translate-x-0.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Smart Auto-Waitlist Tab */}
        {tab === 'waitlist' && (
          <div className="animate-fade-up space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  Smart Auto-Waitlist
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  When another fan&apos;s hold expires or cancels, you automatically receive a 5-minute exclusive claim offer here.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                LIVE AUTO-MATCH MONITORING
              </div>
            </div>

            {waitlistEntries.length === 0 ? (
              <div className="relative overflow-hidden rounded-3xl border border-dashed border-zinc-300 bg-white p-14 text-center dark:border-zinc-800 dark:bg-[#111115]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF3366]/10 text-[#FF3366]">
                  <Bell className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-base font-extrabold text-zinc-900 dark:text-white">
                  You aren&apos;t on any waitlists yet
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
                  Open any live event and tap <strong>Join Auto-Waitlist</strong> on your preferred tier to get instant 5-minute priority seat offers when holds release.
                </p>
                <button
                  onClick={() => setTab('events')}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#FF3366] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958]"
                >
                  Explore Live Drops <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {waitlistEntries.map((w, idx) => {
                  const isOffered = w.status === 'OFFERED';
                  return (
                    <div
                      key={w.id}
                      style={{ animationDelay: `${Math.min(idx, 5) * 65}ms` }}
                      className={`animate-fade-up group relative overflow-hidden rounded-3xl border bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:bg-[#111115] ${
                        isOffered
                          ? 'border-[#FF3366]/60 shadow-[#FF3366]/15'
                          : 'border-zinc-200/90 hover:border-amber-500/45 dark:border-zinc-800/90'
                      }`}
                    >
                      {/* Top Status Accent Bar */}
                      <div
                        className={`h-2 bg-gradient-to-r ${
                          isOffered
                            ? 'from-[#FF3366] via-amber-500 to-[#FF3366]'
                            : 'from-amber-500 via-orange-400 to-amber-500'
                        }`}
                      />

                      {/* Soft Corner Glow */}
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute -top-14 -right-14 h-40 w-40 rounded-full blur-3xl ${
                          isOffered ? 'bg-[#FF3366]/20' : 'bg-amber-500/12'
                        }`}
                      />

                      <div className="relative p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-extrabold tracking-wide ${
                                isOffered
                                  ? 'bg-[#FF3366] text-white shadow-md shadow-[#FF3366]/35'
                                  : 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400'
                              }`}
                            >
                              <span className="relative flex h-1.5 w-1.5">
                                <span
                                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                                    isOffered ? 'bg-white' : 'bg-amber-500'
                                  }`}
                                />
                                <span
                                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                                    isOffered ? 'bg-white' : 'bg-amber-500'
                                  }`}
                                />
                              </span>
                              {isOffered ? `OFFER UNLOCKED · ${w.offeredSeatLabel}` : `PRIORITY QUEUE #${w.queuePosition}`}
                            </span>
                            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {w.tierName}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">
                              TIER PRICE
                            </div>
                            <div className="font-mono text-base font-extrabold text-zinc-900 dark:text-white">
                              {formatRupees(w.tierPricePaise)}
                            </div>
                          </div>
                        </div>

                        <h3 className="mt-3.5 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white">
                          {w.eventTitle}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF3366]" />
                          {w.venueName}, {w.city}
                        </p>

                        {/* Live 3-Step Auto-Match Progress Stepper */}
                        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/70">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                              <Check className="h-3 w-3" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                1. JOINED
                              </div>
                              <div className="truncate text-[10px] text-zinc-500">FIFO #{w.queuePosition}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                isOffered
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : 'bg-amber-500/20 text-amber-500'
                              }`}
                            >
                              {isOffered ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3 animate-pulse" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`truncate font-mono text-[9px] font-bold ${
                                  isOffered
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                2. WATCHING
                              </div>
                              <div className="truncate text-[10px] text-zinc-500">
                                {isOffered ? 'Matched!' : 'Live holds'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                isOffered
                                  ? 'bg-[#FF3366]/20 text-[#FF3366]'
                                  : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800'
                              }`}
                            >
                              <Zap className="h-3 w-3" />
                            </span>
                            <div className="min-w-0">
                              <div
                                className={`truncate font-mono text-[9px] font-bold ${
                                  isOffered ? 'text-[#FF3366]' : 'text-zinc-400'
                                }`}
                              >
                                3. CLAIM
                              </div>
                              <div className="truncate text-[10px] text-zinc-500">
                                {isOffered ? '5-min lock' : 'Pending'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {isOffered && w.offerExpiresAt && (
                          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#FF3366]/30 bg-[#FF3366]/10 px-3.5 py-2 font-mono text-[11px] font-bold text-[#FF3366]">
                            <span>Exclusive hold active</span>
                            <span>Expires {new Date(w.offerExpiresAt).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/80 px-5 py-3.5 sm:px-6 dark:border-zinc-800/80 dark:bg-zinc-950/60">
                        <Link
                          to={`/events/${w.eventId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600 transition hover:text-[#FF3366] dark:text-zinc-300"
                        >
                          View Event <ArrowRight className="h-3.5 w-3.5" />
                        </Link>

                        <div className="flex items-center gap-2">
                          {isOffered && (
                            <button
                              disabled={claimOfferMutation.isPending}
                              onClick={() => claimOfferMutation.mutate(w.id)}
                              className="group/claim relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
                            >
                              <span
                                aria-hidden="true"
                                className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                              />
                              <CheckCircle2 className="relative h-3.5 w-3.5" />
                              <span className="relative">
                                {claimOfferMutation.isPending ? 'Claiming...' : 'Claim & Pay Now'}
                              </span>
                            </button>
                          )}
                          <button
                            disabled={leaveWaitlistMutation.isPending}
                            onClick={() => leaveWaitlistMutation.mutate(w.id)}
                            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-600 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-rose-400"
                          >
                            Leave Waitlist
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  Real scannable gate passes. Tap any pass to open full-screen QR mode at venue entry.
                </p>
              </div>
              {tickets.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'ACTIVE', 'RESALE_LISTED', 'USED', 'REVOKED'] as const).map((st) => {
                    const count = st === 'ALL' ? tickets.length : tickets.filter((tk) => tk.status === st).length;
                    if (st !== 'ALL' && count === 0) return null;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPassFilter(st)}
                        className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-bold transition-all active:scale-95 ${
                          passFilter === st
                            ? 'bg-[#FF3366] text-white shadow-sm shadow-[#FF3366]/30'
                            : 'border border-zinc-200 bg-white text-zinc-600 hover:border-[#FF3366]/40 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-400'
                        }`}
                      >
                        {st === 'RESALE_LISTED' ? 'RESALE' : st} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
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
                {tickets
                  .filter((tk) => passFilter === 'ALL' || tk.status === passFilter)
                  .map((t, idx) => {
                    const isActive = t.status === 'ACTIVE';
                    const isUsedOrRevoked = t.status === 'USED' || t.status === 'REVOKED';
                    const ribbonClass =
                      t.status === 'ACTIVE'
                        ? 'from-[#FF3366] via-amber-500 to-[#FF3366]'
                        : t.status === 'RESALE_LISTED'
                          ? 'from-amber-500 via-orange-400 to-amber-500'
                          : t.status === 'USED'
                            ? 'from-sky-500 via-cyan-400 to-sky-500'
                            : 'from-rose-600 via-rose-400 to-rose-600';

                    return (
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
                        className={`animate-fade-up group relative cursor-pointer overflow-hidden rounded-3xl border bg-white shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl dark:bg-[#111115] ${
                          isActive
                            ? 'border-zinc-200/90 hover:border-[#FF3366]/55 hover:shadow-[#FF3366]/12 dark:border-zinc-800/90'
                            : 'border-zinc-200/70 opacity-90 hover:opacity-100 dark:border-zinc-800/70'
                        }`}
                      >
                        {/* Top Holographic Accent Ribbon */}
                        <div className={`h-2 bg-gradient-to-r ${ribbonClass}`} />

                        {/* Soft Ambient Header Glow */}
                        <div
                          aria-hidden="true"
                          className={`pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100 ${
                            isActive ? 'bg-[#FF3366]/15 opacity-70' : 'bg-zinc-500/10 opacity-40'
                          }`}
                        />

                        {/* Top Boarding Pass Section + Real Scannable QR */}
                        <div className="relative flex items-start justify-between gap-4 border-b border-dashed border-zinc-200 p-5 sm:p-6 dark:border-zinc-700/80">
                          <span className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#09090B]" />
                          <span className="absolute -right-3 -bottom-3 h-6 w-6 rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#09090B]" />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex rounded-md bg-[#FF3366]/12 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#FF3366]">
                                {t.tierName}
                              </span>
                              <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-300">
                                {t.city}
                              </span>
                            </div>

                            <h3 className="mt-2.5 text-lg font-extrabold tracking-tight text-zinc-900 transition-colors group-hover:text-[#FF3366] dark:text-white">
                              {t.eventTitle}
                            </h3>

                            <div className="mt-2 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              <p className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF3366]" />
                                <span className="truncate">{t.venueName}</span>
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                <span>{formatEventDate(t.eventStartAt)}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-center gap-1.5">
                            <TicketQrVisual seed={t.qrTokenId} muted={isUsedOrRevoked} />
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold tracking-wider text-zinc-400 uppercase transition group-hover:text-[#FF3366]">
                              <Maximize2 className="h-2.5 w-2.5" /> Expand Pass
                            </span>
                          </div>
                        </div>

                        {/* Bottom Perforated Stub Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50/90 px-5 py-4 sm:px-6 dark:bg-zinc-950/70">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="font-mono text-[9px] font-semibold tracking-wider text-zinc-400 uppercase">
                                PASS / SEAT
                              </div>
                              <div className="mt-0.5 font-mono text-sm font-extrabold text-zinc-900 dark:text-white">
                                {t.passLabel}
                              </div>
                            </div>
                            <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-800" />
                            <div>
                              <div className="font-mono text-[9px] font-semibold tracking-wider text-zinc-400 uppercase">
                                PAID
                              </div>
                              <div className="mt-0.5 font-mono text-sm font-bold text-zinc-900 dark:text-white">
                                {formatRupees(t.pricePaise)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isActive && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setResellTicket(t);
                                  setResellPriceRupees(String(Math.round(t.pricePaise / 100)));
                                  setResellModalError(null);
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-[#FF3366]/35 bg-[#FF3366]/10 px-3 py-1 font-mono text-[10px] font-bold text-[#FF3366] transition hover:bg-[#FF3366] hover:text-white active:scale-95"
                              >
                                <RefreshCw className="h-3 w-3" /> Resell
                              </button>
                            )}
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-extrabold tracking-wide ${
                                t.status === 'ACTIVE'
                                  ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400'
                                  : t.status === 'RESALE_LISTED'
                                    ? 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400'
                                    : t.status === 'USED'
                                      ? 'bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-400'
                                      : 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/25 dark:text-rose-400'
                              }`}
                            >
                              {isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
                              {!isActive && <CheckCircle2 className="h-3 w-3" />}
                              {t.status === 'RESALE_LISTED' ? 'ON RESALE' : t.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

              <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] text-zinc-400">
                <span>TOKEN · {activePass.qrTokenId.slice(0, 18).toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activePass.qrTokenId);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {copiedToken ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedToken ? 'Copied' : 'Copy UUID'}
                </button>
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

      {/* Anti-Scalper Price-Capped Resale Listing Modal */}
      {resellTicket && (
        <div
          onClick={() => setResellTicket(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-pop w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#111115]"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  List Pass on Verified Resale
                </h3>
                <p className="text-xs text-zinc-500">
                  {resellTicket.eventTitle} · {resellTicket.passLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResellTicket(null)}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createResaleMutation.mutate();
              }}
              className="mt-5 space-y-4"
            >
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
                <div className="font-bold">Anti-Scalper Escrow Protection</div>
                <p className="mt-1 opacity-90">
                  Original face value: <strong>{formatRupees(resellTicket.pricePaise)}</strong>. Your asking price is strictly enforced against the organizer&apos;s resale cap. When sold, your old QR is immediately revoked.
                </p>
              </div>

              {resellModalError && (
                <div className="animate-slide-reveal rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  {resellModalError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Asking Price (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={resellPriceRupees}
                  onChange={(e) => {
                    setResellPriceRupees(e.target.value);
                    if (resellModalError) setResellModalError(null);
                  }}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-sm font-bold text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResellTicket(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createResaleMutation.isPending}
                  className="rounded-xl bg-[#FF3366] px-5 py-2 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:bg-[#E62958] disabled:opacity-50"
                >
                  {createResaleMutation.isPending ? 'Listing...' : 'List for Resale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
