import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../lib/api';
import {
  formatRupees,
  type BookingResponse,
  type LockSeatsResponse,
  type QueueStatusResponse,
  type SeatDto,
  type SeatMapResponse,
  type TierSummary,
  type WaitlistEntryResponse,
} from '../types/event';

const CATEGORY_COVERS: Record<string, string> = {
  CONCERT: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=80',
  COMEDY: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1400&q=80',
  FESTIVAL: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80',
  SPORTS: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1400&q=80',
  TECH: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1400&q=80',
};

const COLOR_MAP: Record<string, { dot: string; border: string; seatOpen: string }> = {
  VIOLET: {
    dot: 'bg-violet-400',
    border: 'border-violet-500/40',
    seatOpen:
      'bg-violet-500/15 text-violet-700 border-violet-500/50 border-b-violet-500 hover:bg-violet-500/30 dark:text-violet-200',
  },
  EMERALD: {
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/40',
    seatOpen:
      'bg-emerald-500/15 text-emerald-700 border-emerald-500/50 border-b-emerald-500 hover:bg-emerald-500/30 dark:text-emerald-200',
  },
  SKY: {
    dot: 'bg-sky-400',
    border: 'border-sky-500/40',
    seatOpen:
      'bg-sky-500/15 text-sky-700 border-sky-500/50 border-b-sky-500 hover:bg-sky-500/30 dark:text-sky-200',
  },
  CYAN: {
    dot: 'bg-cyan-400',
    border: 'border-cyan-500/40',
    seatOpen:
      'bg-cyan-500/15 text-cyan-700 border-cyan-500/50 border-b-cyan-500 hover:bg-cyan-500/30 dark:text-cyan-200',
  },
  FUCHSIA: {
    dot: 'bg-fuchsia-400',
    border: 'border-fuchsia-500/40',
    seatOpen:
      'bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/50 border-b-fuchsia-500 hover:bg-fuchsia-500/30 dark:text-fuchsia-200',
  },
};

function getTierPalette(colorCode?: string) {
  return COLOR_MAP[(colorCode || 'VIOLET').toUpperCase()] ?? COLOR_MAP.VIOLET;
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

interface TierSection {
  tier: TierSummary;
  palette: { dot: string; border: string; seatOpen: string };
  rows: [string, SeatDto[]][];
}

export default function EventBookingPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [standingQty, setStandingQty] = useState<Record<string, number>>({});
  const [hydratedOnce, setHydratedOnce] = useState(false);
  const [focusedTierId, setFocusedTierId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredSeat, setHoveredSeat] = useState<SeatDto | null>(null);
  const [queueState, setQueueState] = useState<QueueStatusResponse | null>(null);
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [toastPopup, setToastPopup] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string } | null>(null);
  const [paymentDeclinedModal, setPaymentDeclinedModal] = useState<string | null>(null);
  const [offerModalEntry, setOfferModalEntry] = useState<WaitlistEntryResponse | null>(null);
  const [dismissedOfferIds, setDismissedOfferIds] = useState<Set<string>>(new Set());
  const [offerRemainingSec, setOfferRemainingSec] = useState<number>(0);

  const showPopup = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setToastPopup({ type, title, message });
  };

  useEffect(() => {
    if (!toastPopup) return;
    const t = setTimeout(() => setToastPopup(null), 5000);
    return () => clearTimeout(t);
  }, [toastPopup]);

  const seatMapQuery = useQuery({
    queryKey: ['seatmap', eventId],
    queryFn: async () => (await apiClient.get<SeatMapResponse>(`/events/${eventId}/seatmap`)).data,
    refetchInterval: 15000,
    enabled: Boolean(eventId),
  });

  // Real-time Server-Sent Events (SSE) subscription for instant (<50ms) seat & waitlist sync
  useEffect(() => {
    if (!eventId) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
    const es = new EventSource(`${baseUrl}/events/${eventId}/seatmap/stream`);
    es.addEventListener('seat-update', () => {
      queryClient.invalidateQueries({ queryKey: ['seatmap', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
    });
    return () => es.close();
  }, [eventId, queryClient]);

  useEffect(() => {
    if (!seatMapQuery.data || hydratedOnce) return;
    const myHeld = seatMapQuery.data.seats.filter((s) => s.lockedByCurrentUser).map((s) => s.id);
    if (myHeld.length > 0) setSelectedIds(myHeld);
    setHydratedOnce(true);
  }, [seatMapQuery.data, hydratedOnce]);

  useEffect(() => {
    if (!booking || booking.status !== 'PENDING_PAYMENT') {
      setRemainingSec(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(booking.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSec(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [booking]);

  const joinQueueMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post<QueueStatusResponse>(`/events/${eventId}/queue/join`)).data,
    onSuccess: (data) => {
      setQueueState(data);
    },
    onError: (err: unknown) => {
      showPopup('error', 'Queue Error', (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not join queue');
    },
  });

  useEffect(() => {
    if (!seatMapQuery.data?.event.flashSaleEnabled) return;
    if (queueState?.admitted) return;

    if (!queueState && !joinQueueMutation.isPending) {
      joinQueueMutation.mutate();
      return;
    }

    if (queueState && !queueState.admitted) {
      const poll = setInterval(() => {
        if (!joinQueueMutation.isPending) joinQueueMutation.mutate();
      }, 3000);
      return () => clearInterval(poll);
    }
  }, [seatMapQuery.data?.event.flashSaleEnabled, queueState, joinQueueMutation.isPending]);

  const confirmSeatsMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = crypto.randomUUID();
      if (data?.event.seatingMode === 'STANDING') {
        const items = Object.entries(standingQty)
          .filter(([, q]) => q > 0)
          .map(([tierId, quantity]) => ({ tierId, quantity }));
        return (
          await apiClient.post<BookingResponse>(
            '/bookings/standing/checkout',
            { eventId, items },
            { headers: { 'Idempotency-Key': idempotencyKey } },
          )
        ).data;
      }

      const lockRes = (
        await apiClient.post<LockSeatsResponse>(`/events/${eventId}/seats/lock`, {
          seatIds: selectedIds,
        })
      ).data;

      return (
        await apiClient.post<BookingResponse>(
          '/bookings/checkout',
          { eventId, seatIds: lockRes.lockedSeatIds },
          { headers: { 'Idempotency-Key': idempotencyKey } },
        )
      ).data;
    },
    onSuccess: (data) => {
      setBooking(data);
      showPopup('info', 'Reserved for 10 Minutes', 'Complete payment before the timer expires to mint your QR passes.');
      queryClient.invalidateQueries({ queryKey: ['seatmap', eventId] });
    },
    onError: (err: unknown) => {
      showPopup(
        'error',
        'Selection Unavailable',
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'One or more selected seats were just taken. Please pick different seats.',
      );
      queryClient.invalidateQueries({ queryKey: ['seatmap', eventId] });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (simulateFailure: boolean) =>
      (
        await apiClient.post<BookingResponse>(`/bookings/${booking!.id}/confirm-payment`, {
          simulateFailure,
        })
      ).data,
    onSuccess: (data) => {
      setBooking(data);
      setPaymentDeclinedModal(null);
      showPopup('success', 'Payment Confirmed!', 'Your verified QR passes are ready in My Passes.');
      queryClient.invalidateQueries({ queryKey: ['seatmap', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Your payment was declined by the bank. Your seats are still safely held—retry payment before the timer expires.';
      setPaymentDeclinedModal(detail);
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post<BookingResponse>(`/bookings/${booking!.id}/cancel`)).data,
    onSuccess: () => {
      setBooking(null);
      setPaymentDeclinedModal(null);
      setSelectedIds([]);
      setStandingQty({});
      showPopup('info', 'Order Cancelled', 'Your seats/passes have been released back to the venue.');
      queryClient.invalidateQueries({ queryKey: ['seatmap', eventId] });
    },
  });

  const myWaitlistQuery = useQuery({
    queryKey: ['my-waitlist'],
    queryFn: async () => (await apiClient.get<WaitlistEntryResponse[]>('/waitlist/me')).data,
    refetchInterval: 5000,
  });

  const joinedTierMap = useMemo(() => {
    const map = new Map<string, WaitlistEntryResponse>();
    for (const entry of myWaitlistQuery.data ?? []) {
      if (entry.eventId === eventId && (entry.status === 'WAITING' || entry.status === 'OFFERED')) {
        map.set(entry.tierId, entry);
      }
    }
    return map;
  }, [myWaitlistQuery.data, eventId]);

  // Automatically pop up the Waitlist Offer Modal if an OFFERED pass arrives while user is on this page!
  useEffect(() => {
    if (booking) return;
    for (const entry of joinedTierMap.values()) {
      if (entry.status === 'OFFERED' && !dismissedOfferIds.has(entry.id)) {
        setOfferModalEntry(entry);
        return;
      }
    }
  }, [joinedTierMap, dismissedOfferIds, booking]);

  useEffect(() => {
    if (!offerModalEntry?.offerExpiresAt) {
      setOfferRemainingSec(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(offerModalEntry.offerExpiresAt!).getTime() - Date.now()) / 1000));
      setOfferRemainingSec(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [offerModalEntry]);

  const joinWaitlistMutation = useMutation({
    mutationFn: async (tierId: string) =>
      apiClient.post('/waitlist', { eventId, tierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
      showPopup('success', 'Joined Auto-Waitlist', "You'll get an instant 5-minute claim popup the moment a hold releases.");
    },
    onError: (err: unknown) => {
      showPopup('error', 'Waitlist Error', (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not join waitlist');
    },
  });

  const leaveWaitlistMutation = useMutation({
    mutationFn: async (entryId: string) => apiClient.delete(`/waitlist/${entryId}`),
    onSuccess: () => {
      setOfferModalEntry(null);
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
      showPopup('info', 'Removed from Waitlist', 'You have left the waitlist for this tier.');
    },
    onError: (err: unknown) => {
      showPopup('error', 'Waitlist Error', (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not leave waitlist');
    },
  });

  const claimOfferOnPageMutation = useMutation({
    mutationFn: async (entryId: string) =>
      (await apiClient.post<BookingResponse>(`/waitlist/${entryId}/claim`)).data,
    onSuccess: (claimedBooking) => {
      setOfferModalEntry(null);
      setBooking(claimedBooking);
      showPopup('success', 'Waitlist Offer Claimed!', 'Complete payment below to mint your verified QR pass.');
      queryClient.invalidateQueries({ queryKey: ['my-waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['seatmap', eventId] });
    },
    onError: (err: unknown) => {
      showPopup('error', 'Claim Failed', (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Offer could not be claimed.');
    },
  });

  const data = seatMapQuery.data;

  const tierSections: TierSection[] = useMemo(() => {
    if (!data) return [];
    const sortedTiers = [...data.event.tiers].sort((a, b) => b.basePricePaise - a.basePricePaise);
    return sortedTiers.map((tier) => {
      const tierSeats = data.seats.filter((s) => s.tierId === tier.id);
      const rowMap = new Map<string, SeatDto[]>();
      for (const seat of tierSeats) {
        const list = rowMap.get(seat.rowLabel) ?? [];
        list.push(seat);
        rowMap.set(seat.rowLabel, list);
      }
      const rows = Array.from(rowMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([label, seats]) => [label, seats.sort((x, y) => x.seatNumber - y.seatNumber)] as [string, SeatDto[]]);
      return {
        tier,
        palette: getTierPalette(tier.colorCode),
        rows,
      };
    });
  }, [data]);

  const isStanding = data?.event.seatingMode === 'STANDING';
  const totalStandingPasses = Object.values(standingQty).reduce((a, b) => a + b, 0);

  const adjustStandingQty = (tier: TierSummary, delta: number) => {
    if (booking) return;
    setStandingQty((prev) => {
      const current = prev[tier.id] ?? 0;
      const next = current + delta;
      if (next < 0) return prev;
      if (delta > 0 && (totalStandingPasses >= 6 || next > tier.availableSeats)) return prev;
      return { ...prev, [tier.id]: next };
    });
  };

  const toggleSeat = (seat: SeatDto) => {
    if (booking) return;
    if (seat.status !== 'AVAILABLE' && !seat.lockedByCurrentUser) return;
    setSelectedIds((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      if (prev.length >= 6) return prev;
      return [...prev, seat.id];
    });
  };

  const selectedSeats = useMemo(
    () => (data?.seats ?? []).filter((s) => selectedIds.includes(s.id)),
    [data, selectedIds],
  );
  const standingItems = useMemo(
    () =>
      (data?.event.tiers ?? [])
        .filter((t) => (standingQty[t.id] ?? 0) > 0)
        .map((t) => ({ tier: t, qty: standingQty[t.id] })),
    [data, standingQty],
  );
  const selectedCount = isStanding ? totalStandingPasses : selectedSeats.length;
  const selectedSubtotal = isStanding
    ? standingItems.reduce((acc, i) => acc + i.tier.basePricePaise * i.qty, 0)
    : selectedSeats.reduce((acc, s) => acc + s.pricePaise, 0);

  const needsQueue = Boolean(data?.event.flashSaleEnabled && !queueState?.admitted);
  const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const secs = String(remainingSec % 60).padStart(2, '0');
  const coverImage = data ? CATEGORY_COVERS[data.event.category.toUpperCase()] ?? CATEGORY_COVERS.CONCERT : CATEGORY_COVERS.CONCERT;

  return (
    <div className="min-h-screen bg-zinc-50 pb-24 text-zinc-900 transition-colors duration-200 lg:pb-12 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/user"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Drops</span>
            </Link>
            <BrandLogo size="sm" />
          </div>

          <div className="flex items-center gap-2">
            {booking && booking.status === 'PENDING_PAYMENT' && (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF3366]/30 bg-[#FF3366]/10 px-3 py-1.5 font-mono text-[11px] font-bold text-[#FF3366] tabular-nums sm:text-xs">
                <Clock className="h-3.5 w-3.5" /> Pay in {mins}:{secs}
              </div>
            )}
            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {seatMapQuery.isLoading && (
          <div className="py-16 text-center text-sm text-zinc-500">Loading interactive venue map...</div>
        )}

        {data && (
          <>
            {/* Cinematic Event Strip with Interactive Tier Filter Pills */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-[#09090B] text-white shadow-xl dark:border-zinc-800">
              <img
                src={coverImage}
                alt={data.event.title}
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/85 to-[#09090B]/55" />

              <div className="relative z-10 flex flex-col justify-between gap-5 p-5 sm:p-7 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/15 px-2.5 py-0.5 font-mono text-[10px] font-bold backdrop-blur">
                      {data.event.category}
                    </span>
                    {data.event.flashSaleEnabled && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FF3366] px-2.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        <Zap className="h-3 w-3" /> FLASH DROP
                      </span>
                    )}
                    {data.event.resaleEnabled && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 backdrop-blur">
                        <ShieldCheck className="h-3 w-3" /> RESALE CAPPED{' '}
                        {Math.round(data.event.maxResaleMultiplier * 100)}%
                      </span>
                    )}
                  </div>
                  <h1 className="mt-2.5 text-xl font-extrabold tracking-tight sm:text-2xl">
                    {data.event.title}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-300">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#FF3366]" /> {data.event.venueName},{' '}
                      {data.event.city}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-400" />{' '}
                      {formatEventDate(data.event.eventStartAt)}
                    </span>
                  </div>
                </div>

                {/* Clickable Tier Highlight Pills */}
                <div className="flex flex-wrap gap-2">
                  {tierSections.map(({ tier, palette }) => {
                    const isFocused = focusedTierId === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setFocusedTierId((prev) => (prev === tier.id ? null : tier.id))}
                        className={`rounded-xl border px-3.5 py-2 text-left text-xs backdrop-blur-md transition ${
                          isFocused
                            ? 'border-[#FF3366] bg-[#FF3366]/20 text-white ring-2 ring-[#FF3366]/40'
                            : 'border-white/15 bg-black/45 text-zinc-200 hover:border-white/35'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
                          {tier.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-zinc-300">
                          <strong className="text-white">{formatRupees(tier.basePricePaise)}</strong> ·{' '}
                          {tier.availableSeats} open
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Automatic Fair Queue */}
            {needsQueue ? (
              <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-10 text-center sm:p-12 dark:border-zinc-800 dark:bg-[#111114]">
                <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-[#FF3366]/15 text-[#FF3366]">
                  <Users className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-zinc-900 dark:text-white">
                  {queueState && !queueState.admitted
                    ? `You're #${queueState.position} in the Fair Queue`
                    : 'Securing Your Spot in the Drop...'}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                  {queueState && !queueState.admitted
                    ? `Currently ${queueState.totalInQueue} fans waiting. You'll enter the seat map automatically—no need to refresh.`
                    : 'Checking live venue capacity and admitting you automatically.'}
                </p>
              </div>
            ) : booking?.status === 'CONFIRMED' ? (
              <div className="mt-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center sm:p-10">
                <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
                <h2 className="mt-4 text-2xl font-extrabold text-zinc-900 dark:text-white">
                  Booking Confirmed!
                </h2>
                <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  Reference: {booking.paymentRef} · Paid {formatRupees(booking.totalAmountPaise)}
                </p>
                <button
                  onClick={() => navigate('/user')}
                  className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-500"
                >
                  Open My Passes
                </button>
              </div>
            ) : (
              /* Interactive Arena Map OR Open-Ground Standing Zones + Order Summary */
              <div className="mt-6 grid items-start gap-6 lg:grid-cols-12">
                {isStanding ? (
                  /* Open-Ground Standing Festival Zones UI */
                  <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-8 sm:p-8 dark:border-zinc-800 dark:bg-[#111114]">
                    <div className="mb-8 flex flex-col items-center">
                      <div className="w-full max-w-md">
                        <svg viewBox="0 0 400 48" className="w-full overflow-visible">
                          <defs>
                            <linearGradient id="stageArcStanding" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#FF3366" stopOpacity="0.15" />
                              <stop offset="50%" stopColor="#FF3366" stopOpacity="1" />
                              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.2" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 16 36 Q 200 0 384 36"
                            fill="none"
                            stroke="url(#stageArcStanding)"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="-mt-4 text-center font-mono text-[10px] font-extrabold tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
                          MAIN STAGE · OPEN-GROUND STANDING
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {tierSections.map(({ tier, palette }) => {
                        const qty = standingQty[tier.id] ?? 0;
                        const pctOpen =
                          tier.totalSeats > 0 ? Math.round((tier.availableSeats / tier.totalSeats) * 100) : 0;
                        const soldOut = tier.availableSeats <= 0;
                        return (
                          <div
                            key={tier.id}
                            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 transition ${
                              qty > 0
                                ? 'border-[#FF3366] bg-[#FF3366]/5 shadow-md shadow-[#FF3366]/10'
                                : `${palette.border} bg-zinc-50/70 dark:bg-zinc-950/70`
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5">
                                <span className={`h-3 w-3 rounded-full ${palette.dot}`} />
                                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                                  {tier.name}
                                </h3>
                                <span className="rounded-md bg-zinc-200/70 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  STANDING ZONE
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-3 font-mono text-xs">
                                <span className="text-base font-extrabold text-[#FF3366]">
                                  {formatRupees(tier.basePricePaise)}
                                </span>
                                <span className="text-zinc-500">
                                  {soldOut ? 'Sold Out' : `${tier.availableSeats} of ${tier.totalSeats} passes left`}
                                </span>
                              </div>
                              <div className="mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  style={{ width: `${pctOpen}%` }}
                                  className={`h-full rounded-full ${palette.dot}`}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={qty === 0 || Boolean(booking)}
                                onClick={() => adjustStandingQty(tier, -1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition hover:border-[#FF3366] disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center font-mono text-base font-extrabold text-zinc-900 dark:text-white">
                                {qty}
                              </span>
                              <button
                                type="button"
                                disabled={soldOut || totalStandingPasses >= 6 || qty >= tier.availableSeats || Boolean(booking)}
                                onClick={() => adjustStandingQty(tier, 1)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3366] text-white shadow-sm transition hover:bg-[#E62958] disabled:opacity-35"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:col-span-8 dark:border-zinc-800 dark:bg-[#111114]">
                  {/* Top Map Toolbar: Live Hover Inspector + Zoom Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-4 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="flex items-center gap-2 text-xs">
                      <Sparkles className="h-3.5 w-3.5 text-[#FF3366]" />
                      {hoveredSeat ? (
                        <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                          {hoveredSeat.tierName} · Row {hoveredSeat.rowLabel} Seat {hoveredSeat.seatNumber} ·{' '}
                          <span className="text-[#FF3366]">{formatRupees(hoveredSeat.pricePaise)}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500">
                          Hover or tap any colored seat to inspect &amp; select
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        title="Zoom out"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-11 text-center font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        title="Zoom in"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      {zoom !== 1 && (
                        <button
                          type="button"
                          onClick={() => setZoom(1)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:text-[#FF3366]"
                          title="Reset zoom"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subtle Stage Spotlight Cone */}
                  <div className="pointer-events-none absolute top-14 left-1/2 h-44 w-96 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#FF3366]/15 via-amber-500/5 to-transparent blur-2xl" />

                  <div className="relative overflow-x-auto p-5 sm:p-8">
                    <div
                      style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                      className="min-w-[460px] transition-transform duration-200"
                    >
                      {/* Curved Illuminated Arena Stage */}
                      <div className="mb-8 flex flex-col items-center">
                        <div className="relative w-full max-w-md">
                          <svg viewBox="0 0 400 48" className="w-full overflow-visible">
                            <defs>
                              <linearGradient id="stageArc" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#FF3366" stopOpacity="0.15" />
                                <stop offset="50%" stopColor="#FF3366" stopOpacity="1" />
                                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.2" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M 16 36 Q 200 0 384 36"
                              fill="none"
                              stroke="url(#stageArc)"
                              strokeWidth="4.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M 32 42 Q 200 10 368 42"
                              fill="none"
                              stroke="url(#stageArc)"
                              strokeWidth="16"
                              strokeOpacity="0.14"
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="-mt-4 text-center font-mono text-[10px] font-extrabold tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
                            MAIN STAGE
                          </div>
                        </div>
                      </div>

                      {/* Price-Ordered Tier Sections with Distinct Zone Colors */}
                      <div className="space-y-8">
                        {tierSections.map(({ tier, palette, rows }) => {
                          const dimmed = focusedTierId !== null && focusedTierId !== tier.id;
                          return (
                            <div
                              key={tier.id}
                              className={`space-y-3 transition-opacity duration-200 ${
                                dimmed ? 'opacity-30' : 'opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800/80" />
                                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1 font-mono text-[11px] font-bold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                                  <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
                                  {tier.name} · {formatRupees(tier.basePricePaise)}
                                </div>
                                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800/80" />
                              </div>

                              <div className="flex flex-col items-center gap-2.5">
                                {rows.map(([rowLabel, rowSeats]) => {
                                  const mid = Math.ceil(rowSeats.length / 2);
                                  const leftBlock = rowSeats.slice(0, mid);
                                  const rightBlock = rowSeats.slice(mid);
                                  return (
                                    <div key={rowLabel} className="flex items-center gap-2.5 sm:gap-3">
                                      <span className="w-7 text-right font-mono text-[11px] font-bold text-zinc-400">
                                        {rowLabel}
                                      </span>

                                      <div className="flex items-center gap-1.5">
                                        {leftBlock.map((seat) => {
                                          const isSelected = selectedIds.includes(seat.id);
                                          const isAvailable =
                                            seat.status === 'AVAILABLE' || seat.lockedByCurrentUser;
                                          const isHeldByOther = seat.status === 'LOCKED' && !seat.lockedByCurrentUser;
                                          return (
                                            <button
                                              key={seat.id}
                                              type="button"
                                              disabled={!isAvailable || Boolean(booking)}
                                              onMouseEnter={() => setHoveredSeat(seat)}
                                              onMouseLeave={() => setHoveredSeat(null)}
                                              onClick={() => toggleSeat(seat)}
                                              title={
                                                isHeldByOther
                                                  ? `${seat.rowLabel}-${seat.seatNumber} · Temporarily held by another fan`
                                                  : `${seat.rowLabel}-${seat.seatNumber} · ${seat.tierName} (${formatRupees(seat.pricePaise)})`
                                              }
                                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-t-xl rounded-b-md border border-b-[3px] font-mono text-[11px] font-bold transition-all duration-150 ${
                                                isSelected
                                                  ? 'scale-105 border-[#FF3366] border-b-[#B91C45] bg-[#FF3366] text-white shadow-lg shadow-[#FF3366]/35'
                                                  : isAvailable
                                                    ? `${palette.seatOpen} hover:-translate-y-0.5`
                                                    : isHeldByOther
                                                      ? 'cursor-not-allowed border-dashed border-amber-400/80 border-b-amber-500/80 bg-amber-500/15 text-amber-500 dark:text-amber-300'
                                                      : 'cursor-not-allowed border-zinc-200 bg-zinc-200/70 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-600'
                                              }`}
                                            >
                                              {isHeldByOther ? <Lock className="h-3.5 w-3.5" /> : seat.seatNumber}
                                            </button>
                                          );
                                        })}

                                        {/* Center Arena Aisle */}
                                        {rightBlock.length > 0 && <div className="w-5 shrink-0 sm:w-7" />}

                                        {rightBlock.map((seat) => {
                                          const isSelected = selectedIds.includes(seat.id);
                                          const isAvailable =
                                            seat.status === 'AVAILABLE' || seat.lockedByCurrentUser;
                                          const isHeldByOther = seat.status === 'LOCKED' && !seat.lockedByCurrentUser;
                                          return (
                                            <button
                                              key={seat.id}
                                              type="button"
                                              disabled={!isAvailable || Boolean(booking)}
                                              onMouseEnter={() => setHoveredSeat(seat)}
                                              onMouseLeave={() => setHoveredSeat(null)}
                                              onClick={() => toggleSeat(seat)}
                                              title={
                                                isHeldByOther
                                                  ? `${seat.rowLabel}-${seat.seatNumber} · Temporarily held by another fan`
                                                  : `${seat.rowLabel}-${seat.seatNumber} · ${seat.tierName} (${formatRupees(seat.pricePaise)})`
                                              }
                                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-t-xl rounded-b-md border border-b-[3px] font-mono text-[11px] font-bold transition-all duration-150 ${
                                                isSelected
                                                  ? 'scale-105 border-[#FF3366] border-b-[#B91C45] bg-[#FF3366] text-white shadow-lg shadow-[#FF3366]/35'
                                                  : isAvailable
                                                    ? `${palette.seatOpen} hover:-translate-y-0.5`
                                                    : isHeldByOther
                                                      ? 'cursor-not-allowed border-dashed border-amber-400/80 border-b-amber-500/80 bg-amber-500/15 text-amber-500 dark:text-amber-300'
                                                      : 'cursor-not-allowed border-zinc-200 bg-zinc-200/70 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-600'
                                              }`}
                                            >
                                              {isHeldByOther ? <Lock className="h-3.5 w-3.5" /> : seat.seatNumber}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <span className="w-7 font-mono text-[11px] font-bold text-zinc-400">
                                        {rowLabel}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Legend Bar */}
                  <div className="flex flex-wrap items-center justify-center gap-5 border-t border-zinc-200 bg-zinc-50/70 px-4 py-4 font-mono text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60">
                    {tierSections.map(({ tier, palette }) => (
                      <span key={tier.id} className="flex items-center gap-1.5">
                        <span className={`h-3 w-3 rounded-t-md rounded-b-xs ${palette.dot}`} />
                        {tier.name}
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-t-md rounded-b-xs bg-[#FF3366]" /> Selected
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-t-md rounded-b-xs border border-dashed border-amber-400 bg-amber-500/15 text-amber-400">
                        <Lock className="h-2.5 w-2.5" />
                      </span>
                      Held by Another Fan
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-t-md rounded-b-xs bg-zinc-300 dark:bg-zinc-800" /> Booked
                    </span>
                  </div>
                </div>
                )}

                {/* Desktop & Payment Sticky Order Summary */}
                <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-24 lg:col-span-4 dark:border-zinc-800 dark:bg-[#111114]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">
                      {booking ? 'Complete Payment' : 'Order Summary'}
                    </h2>
                    {selectedCount > 0 && !booking && (
                      <span className="rounded-full bg-[#FF3366]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#FF3366]">
                        {selectedCount} / 6
                      </span>
                    )}
                  </div>

                  {!booking ? (
                    <>
                      <div className="mt-4 space-y-2 text-xs">
                        {selectedCount === 0 ? (
                          <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center dark:border-zinc-800">
                            <Ticket className="mx-auto h-6 w-6 text-zinc-400" />
                            <p className="mt-2 text-xs text-zinc-500">
                              {isStanding
                                ? 'Select up to 6 standing zone passes using + / -.'
                                : 'Tap up to 6 available seats on the arena map to reserve them.'}
                            </p>
                          </div>
                        ) : isStanding ? (
                          standingItems.map(({ tier, qty }) => (
                            <div
                              key={tier.id}
                              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-mono dark:border-zinc-800 dark:bg-zinc-950"
                            >
                              <div>
                                <div className="text-xs font-bold text-zinc-900 dark:text-white">
                                  {tier.name} × {qty}
                                </div>
                                <div className="text-[10px] text-zinc-500">Standing Pass</div>
                              </div>
                              <span className="font-bold text-zinc-900 dark:text-white">
                                {formatRupees(tier.basePricePaise * qty)}
                              </span>
                            </div>
                          ))
                        ) : (
                          selectedSeats.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 font-mono dark:border-zinc-800 dark:bg-zinc-950"
                            >
                              <div>
                                <div className="text-xs font-bold text-zinc-900 dark:text-white">
                                  {s.rowLabel}-{s.seatNumber}
                                </div>
                                <div className="text-[10px] text-zinc-500">{s.tierName}</div>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-zinc-900 dark:text-white">
                                  {formatRupees(s.pricePaise)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleSeat(s)}
                                  className="rounded-md p-1 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-5 flex justify-between border-t border-zinc-200 pt-4 font-mono text-sm font-extrabold dark:border-zinc-800">
                        <span>Subtotal</span>
                        <span className="text-zinc-900 dark:text-white">
                          {formatRupees(selectedSubtotal)}
                        </span>
                      </div>

                      <button
                        disabled={selectedCount === 0 || confirmSeatsMutation.isPending}
                        onClick={() => confirmSeatsMutation.mutate()}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3366] py-3 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/20 transition hover:-translate-y-0.5 hover:bg-[#E62958] disabled:translate-y-0 disabled:opacity-40"
                      >
                        {confirmSeatsMutation.isPending
                          ? 'Reserving...'
                          : isStanding
                            ? 'Confirm Passes'
                            : 'Confirm Seats'}
                        {!confirmSeatsMutation.isPending && <ArrowRight className="h-4 w-4" />}
                      </button>

                      <p className="mt-3 text-center text-[11px] text-zinc-500">
                        Seats are held exclusively for 10 minutes once confirmed.
                      </p>

                      {/* Smart Auto-Waitlist Join Section */}
                      {tierSections.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                              Smart Auto-Waitlist
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-amber-500">
                              5-MIN AUTO-OFFER
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Waiting for better seats or a sold-out tier? Get auto-offered the instant a hold expires.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {tierSections.map(({ tier }) => {
                              const existingEntry = joinedTierMap.get(tier.id);
                              if (existingEntry) {
                                if (existingEntry.status === 'OFFERED') {
                                  return (
                                    <button
                                      key={tier.id}
                                      type="button"
                                      onClick={() => setOfferModalEntry(existingEntry)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF3366]/50 bg-[#FF3366] px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-[#FF3366]/30 transition hover:bg-[#E62958]"
                                    >
                                      <Sparkles className="h-3 w-3 shrink-0" />
                                      Claim {tier.name} Offer!
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    key={tier.id}
                                    type="button"
                                    disabled={leaveWaitlistMutation.isPending}
                                    onClick={() => leaveWaitlistMutation.mutate(existingEntry.id)}
                                    title="Click to leave waitlist"
                                    className="group inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-500 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-rose-400"
                                  >
                                    <CheckCircle2 className="h-3 w-3 shrink-0 group-hover:hidden" />
                                    <X className="hidden h-3 w-3 shrink-0 group-hover:block" />
                                    <span>
                                      {tier.name} · Waitlisted (#{existingEntry.queuePosition})
                                    </span>
                                  </button>
                                );
                              }
                              return (
                                <button
                                  key={tier.id}
                                  type="button"
                                  disabled={joinWaitlistMutation.isPending}
                                  onClick={() => joinWaitlistMutation.mutate(tier.id)}
                                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                                >
                                  + Join {tier.name}
                                </button>
                              );
                            })}
                          </div>
                          {joinedTierMap.size > 0 && (
                            <p className="mt-2 text-[11px] font-semibold text-emerald-500">
                              You&apos;re on the waitlist! Manage or claim offers in your{' '}
                              <Link to="/user" className="underline hover:text-emerald-400">
                                Fan Dashboard
                              </Link>
                              .
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="rounded-xl border border-[#FF3366]/25 bg-[#FF3366]/10 px-3.5 py-2.5 text-center font-mono text-xs font-bold text-[#FF3366] tabular-nums">
                        Seats reserved · Pay within {mins}:{secs}
                      </div>

                      <div className="flex justify-between pt-1">
                        <span className="text-zinc-500">Tickets Subtotal</span>
                        <span className="font-mono font-semibold">{formatRupees(booking.subtotalPaise)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Convenience Fee</span>
                        <span className="font-mono font-semibold">{formatRupees(booking.platformFeePaise)}</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-200 pt-3 font-mono text-base font-extrabold dark:border-zinc-800">
                        <span>Total Payable</span>
                        <span className="text-[#FF3366]">{formatRupees(booking.totalAmountPaise)}</span>
                      </div>

                      <button
                        disabled={confirmPaymentMutation.isPending || cancelBookingMutation.isPending}
                        onClick={() => confirmPaymentMutation.mutate(false)}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {confirmPaymentMutation.isPending ? 'Processing...' : 'Pay Now & Get Passes'}
                      </button>

                      <button
                        disabled={confirmPaymentMutation.isPending || cancelBookingMutation.isPending}
                        onClick={() => confirmPaymentMutation.mutate(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Simulate Bank Decline (Keep Lock & Retry)
                      </button>

                      <button
                        disabled={confirmPaymentMutation.isPending || cancelBookingMutation.isPending}
                        onClick={() => cancelBookingMutation.mutate()}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel Order &amp; Release Seats
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Sticky Bottom Checkout Bar */}
      {!needsQueue && !booking && selectedCount > 0 && (
        <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-[#111114]/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase text-zinc-500">
                {selectedCount} {isStanding ? 'Pass' : 'Seat'}
                {selectedCount > 1 ? (isStanding ? 'es' : 's') : ''}
              </div>
              <div className="font-mono text-base font-extrabold text-zinc-900 dark:text-white">
                {formatRupees(selectedSubtotal)}
              </div>
            </div>
            <button
              disabled={confirmSeatsMutation.isPending}
              onClick={() => confirmSeatsMutation.mutate()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#FF3366] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#FF3366]/25"
            >
              {confirmSeatsMutation.isPending ? 'Reserving...' : isStanding ? 'Confirm Passes' : 'Confirm Seats'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {/* Auto-Waitlist Exclusive Offer Popup Modal */}
      {offerModalEntry && (
        <div
          onClick={() => {
            setDismissedOfferIds((prev) => new Set(prev).add(offerModalEntry.id));
            setOfferModalEntry(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-pop w-full max-w-md overflow-hidden rounded-3xl border border-[#FF3366]/40 bg-white shadow-2xl dark:bg-[#111115]"
          >
            <div className="h-2 bg-gradient-to-r from-[#FF3366] via-amber-500 to-[#FF3366]" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3366]/15 px-3 py-1 font-mono text-[10px] font-extrabold text-[#FF3366]">
                  <Sparkles className="h-3 w-3" /> EXCLUSIVE WAITLIST OFFER
                </div>
                <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 font-mono text-xs font-extrabold text-amber-600 tabular-nums dark:text-amber-400">
                  {String(Math.floor(offerRemainingSec / 60)).padStart(2, '0')}:
                  {String(offerRemainingSec % 60).padStart(2, '0')} left
                </span>
              </div>

              <h3 className="mt-4 text-xl font-extrabold text-zinc-900 dark:text-white">
                Your {isStanding ? 'Pass' : 'Seat'} Just Unlocked!
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                A hold just released on <strong>{offerModalEntry.eventTitle}</strong>. We locked it exclusively for you for 5 minutes.
              </p>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase text-zinc-400">OFFERED PASS</div>
                    <div className="mt-0.5 text-sm font-extrabold text-zinc-900 dark:text-white">
                      {offerModalEntry.offeredSeatLabel ?? offerModalEntry.tierName}
                    </div>
                    <div className="text-xs text-zinc-500">{offerModalEntry.tierName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] font-semibold uppercase text-zinc-400">PRICE</div>
                    <div className="font-mono text-lg font-extrabold text-[#FF3366]">
                      {formatRupees(offerModalEntry.tierPricePaise)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={claimOfferOnPageMutation.isPending}
                  onClick={() => claimOfferOnPageMutation.mutate(offerModalEntry.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3366] py-3 text-sm font-bold text-white shadow-lg shadow-[#FF3366]/30 transition hover:bg-[#E62958] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {claimOfferOnPageMutation.isPending ? 'Claiming...' : 'Claim & Proceed to Payment'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={leaveWaitlistMutation.isPending}
                    onClick={() => leaveWaitlistMutation.mutate(offerModalEntry.id)}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                  >
                    Decline Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedOfferIds((prev) => new Set(prev).add(offerModalEntry.id));
                      setOfferModalEntry(null);
                    }}
                    className="rounded-xl border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Decide Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Declined Popup Modal (BookMyShow-style Keep Lock & Retry) */}
      {paymentDeclinedModal && (
        <div
          onClick={() => setPaymentDeclinedModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-pop w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/40 bg-white shadow-2xl dark:bg-[#111115]"
          >
            <div className="h-2 bg-gradient-to-r from-amber-500 to-rose-500" />
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                    Payment Declined by Bank
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {paymentDeclinedModal}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Your hold is still protected
                </span>
                <span className="font-mono font-extrabold tabular-nums">
                  {mins}:{secs} left
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={confirmPaymentMutation.isPending}
                  onClick={() => confirmPaymentMutation.mutate(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirmPaymentMutation.isPending ? 'Retrying...' : 'Retry Payment Now'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentDeclinedModal(null)}
                    className="rounded-xl border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={cancelBookingMutation.isPending}
                    onClick={() => cancelBookingMutation.mutate()}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                  >
                    Cancel &amp; Release
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Toast Popup for All Alerts */}
      {toastPopup && (
        <div className="animate-slide-reveal fixed right-4 bottom-20 z-50 w-[calc(100vw-2rem)] max-w-sm lg:bottom-6">
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
              toastPopup.type === 'success'
                ? 'border-emerald-500/40 bg-white/95 dark:bg-[#111115]/95'
                : toastPopup.type === 'error'
                  ? 'border-rose-500/40 bg-white/95 dark:bg-[#111115]/95'
                  : 'border-[#FF3366]/40 bg-white/95 dark:bg-[#111115]/95'
            }`}
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                toastPopup.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : toastPopup.type === 'error'
                    ? 'bg-rose-500/15 text-rose-500'
                    : 'bg-[#FF3366]/15 text-[#FF3366]'
              }`}
            >
              {toastPopup.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : toastPopup.type === 'error' ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                {toastPopup.title}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {toastPopup.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToastPopup(null)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
