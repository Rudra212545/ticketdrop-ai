import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Plus,
  Trash2,
  Rocket,
  MapPin,
  Zap,
  ChevronDown,
  Calendar,
  ShieldCheck,
  Armchair,
  TrendingUp,
  Users,
  ArrowRight,
  IndianRupee,
  Pencil,
  X,
  Search,
} from 'lucide-react';
import DashboardLayout, { type SidebarNavItem } from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import type { OrganizerSummary } from '../types/auth';
import { formatRupees, type EventSummary, type SeatingMode, type TierColorCode } from '../types/event';

interface TierDraft {
  name: string;
  priceRupees: number;
  colorCode: TierColorCode;
  rowPrefix: string;
  rowCount: number;
  seatsPerRow: number;
  capacity: number;
}

const COLOR_SWATCHES: { code: TierColorCode; bg: string; label: string }[] = [
  { code: 'VIOLET', bg: 'bg-violet-500', label: 'Violet' },
  { code: 'EMERALD', bg: 'bg-emerald-500', label: 'Emerald' },
  { code: 'SKY', bg: 'bg-sky-500', label: 'Sky' },
  { code: 'CYAN', bg: 'bg-cyan-500', label: 'Cyan' },
  { code: 'FUCHSIA', bg: 'bg-fuchsia-500', label: 'Fuchsia' },
];

export default function AdminPortal() {
  const [activeNav, setActiveNav] = useState<'overview' | 'events'>('overview');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventSummary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('CONCERT');
  const [editCity, setEditCity] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('19:30');
  const [editFlashSale, setEditFlashSale] = useState(true);
  const [editResale, setEditResale] = useState(true);
  const [editResaleCap, setEditResaleCap] = useState('1.10');
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [eventSearch, setEventSearch] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!editingEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingEvent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingEvent]);

  // Event Builder form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CONCERT');
  const [city, setCity] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [eventTime, setEventTime] = useState('19:30');
  const [seatingMode, setSeatingMode] = useState<SeatingMode>('ASSIGNED_SEAT');
  const [flashSaleEnabled, setFlashSaleEnabled] = useState(true);
  const [resaleEnabled, setResaleEnabled] = useState(true);
  const [maxResaleMultiplier, setMaxResaleMultiplier] = useState('1.10');
  const [tiers, setTiers] = useState<TierDraft[]>([
    { name: 'VIP Front Row', priceRupees: 2499, colorCode: 'VIOLET', rowPrefix: 'V', rowCount: 2, seatsPerRow: 8, capacity: 150 },
    { name: 'Gold Arena', priceRupees: 1499, colorCode: 'EMERALD', rowPrefix: 'G', rowCount: 3, seatsPerRow: 10, capacity: 500 },
  ]);

  const applyQuickSchedule = (daysAhead: number, timeStr: string) => {
    const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    setEventDate(d.toISOString().slice(0, 10));
    setEventTime(timeStr);
  };

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => (await apiClient.get<OrganizerSummary>('/admin/profile')).data,
  });

  const eventsQuery = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => (await apiClient.get<EventSummary[]>('/admin/events')).data,
  });

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        category,
        city,
        venueName,
        eventStartAt: new Date(`${eventDate}T${eventTime}`).toISOString(),
        seatingMode,
        flashSaleEnabled,
        flashSaleStartAt: flashSaleEnabled ? new Date().toISOString() : null,
        resaleEnabled,
        maxResaleMultiplier: Number(maxResaleMultiplier),
        tiers: tiers.map((t) => ({
          name: t.name,
          basePricePaise: Math.round(t.priceRupees * 100),
          colorCode: t.colorCode,
          rowPrefix: seatingMode === 'ASSIGNED_SEAT' ? t.rowPrefix : null,
          rowCount: seatingMode === 'ASSIGNED_SEAT' ? t.rowCount : null,
          seatsPerRow: seatingMode === 'ASSIGNED_SEAT' ? t.seatsPerRow : null,
          capacity: seatingMode === 'STANDING' ? t.capacity : null,
        })),
      };
      return (await apiClient.post<EventSummary>('/admin/events', payload)).data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setShowBuilder(false);
      setTitle('');
      setDescription('');
      setCity('');
      setVenueName('');
      setErrorMsg(null);
      showNotice(`Created "${created.title}" with ${created.totalSeats} generated seats!`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not create event. Check all fields.';
      setErrorMsg(msg);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (eventId: string) =>
      (await apiClient.patch<EventSummary>(`/admin/events/${eventId}/publish`)).data,
    onSuccess: (ev) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      showNotice(`"${ev.title}" is now PUBLISHED and live for fans!`);
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async () => {
      if (!editingEvent) throw new Error('No event selected');
      return (
        await apiClient.patch<EventSummary>(`/admin/events/${editingEvent.id}`, {
          title: editTitle,
          description: editDescription,
          category: editCategory,
          city: editCity,
          venueName: editVenue,
          eventStartAt: new Date(`${editDate}T${editTime}`).toISOString(),
          flashSaleEnabled: editFlashSale,
          resaleEnabled: editResale,
          maxResaleMultiplier: Number(editResaleCap),
        })
      ).data;
    },
    onSuccess: (ev) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      setEditingEvent(null);
      showNotice(`Updated "${ev.title}" cleanly (logged to Audit Trail).`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not update event.';
      setErrorMsg(msg);
    },
  });

  const openEditModal = (ev: EventSummary) => {
    const dt = new Date(ev.eventStartAt);
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString();
    setEditTitle(ev.title);
    setEditDescription(ev.description);
    setEditCategory(ev.category);
    setEditCity(ev.city);
    setEditVenue(ev.venueName);
    setEditDate(localIso.slice(0, 10));
    setEditTime(localIso.slice(11, 16));
    setEditFlashSale(ev.flashSaleEnabled);
    setEditResale(ev.resaleEnabled);
    setEditResaleCap(String(ev.maxResaleMultiplier));
    setErrorMsg(null);
    setEditingEvent(ev);
  };

  const events = eventsQuery.data ?? [];
  const filteredAdminEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter((ev) => {
      const matchesStatus = statusFilter === 'ALL' || ev.status === statusFilter;
      const matchesQuery =
        !q ||
        ev.title.toLowerCase().includes(q) ||
        ev.city.toLowerCase().includes(q) ||
        ev.venueName.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [events, statusFilter, eventSearch]);

  const publishedCount = events.filter((e) => e.status === 'PUBLISHED').length;
  const draftCount = events.filter((e) => e.status === 'DRAFT').length;
  const totalCapacity = events.reduce((acc, e) => acc + e.totalSeats, 0);
  const totalAvailable = events.reduce((acc, e) => acc + e.availableSeats, 0);
  const totalSold = Math.max(0, totalCapacity - totalAvailable);
  const sellThroughPct = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0;
  const kpiRingCircumference = 2 * Math.PI * 16;
  const kpiRingOffset = kpiRingCircumference * (1 - sellThroughPct / 100);
  const estimatedRevenuePaise = events.reduce(
    (sum, ev) =>
      sum +
      ev.tiers.reduce((tSum, t) => tSum + (t.totalSeats - t.availableSeats) * t.basePricePaise, 0),
    0,
  );
  const isApproved = profile?.approvalStatus === 'APPROVED';

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Studio Overview', icon: LayoutDashboard },
    { id: 'events', label: 'Events & Seat Maps', icon: CalendarPlus, badge: events.length },
    { id: 'ai-pricing', label: 'AI Pricing Co-Pilot', icon: Sparkles, badge: 'Phase 4', disabled: true },
    { id: 'scanner', label: 'Venue QR Scanner', icon: QrCode, badge: 'Phase 3', disabled: true },
  ];

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    createEventMutation.mutate();
  };

  const totalPreviewSeats = tiers.reduce(
    (sum, t) => sum + (seatingMode === 'STANDING' ? t.capacity : t.rowCount * t.seatsPerRow),
    0,
  );

  return (
    <DashboardLayout
      workspaceLabel="Organizer Studio"
      pageTitle={profile?.orgName ?? 'Organizer Studio'}
      pageSubtitle="Create flash-sale drops, manage seat maps, and optimize pricing with AI Co-Pilot"
      navItems={navItems}
      activeNav={activeNav}
      onSelectNav={(id) => setActiveNav(id as 'overview' | 'events')}
    >
      {toast && (
        <div className="animate-slide-reveal mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 shadow-sm dark:text-emerald-300">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> {toast}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-0.5 text-emerald-600/70 hover:text-emerald-600 dark:text-emerald-300/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-6">
          <div className="h-44 animate-pulse rounded-3xl border border-zinc-200 bg-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-900/70" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-900/60"
              />
            ))}
          </div>
        </div>
      )}
      {error && <div className="py-12 text-center text-sm text-rose-500">Could not load organizer profile.</div>}

      {profile && (
        <>
          {!isApproved && (
            <div className="animate-fade-up mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <div className="font-bold">Organization Status: {profile.approvalStatus}</div>
                <p className="mt-0.5 text-xs opacity-90">
                  Your organizer profile must be approved by a Platform Super Admin before you can
                  create or publish live events.
                </p>
              </div>
            </div>
          )}

          {activeNav === 'overview' && (
            <div className="animate-fade-up space-y-6">
              {/* Studio Command Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-900 via-[#121218] to-[#1a0d14] p-6 text-white shadow-2xl sm:p-8 dark:border-zinc-800">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_75%_80%_at_70%_30%,#000_40%,transparent_100%)]"
                />
                <div
                  aria-hidden="true"
                  className="animate-aurora pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#FF3366]/25 blur-3xl"
                />
                <div
                  aria-hidden="true"
                  className="animate-aurora-delayed pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-amber-500/18 blur-3xl"
                />

                <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                        }`}
                      >
                        {isApproved ? (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {profile.approvalStatus} PARTNER
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold text-zinc-300 backdrop-blur-sm">
                        FEE {(profile.platformFeeBps / 100).toFixed(2)}%
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
                      Welcome to {profile.orgName}
                    </h2>
                    <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-zinc-400 sm:text-sm">
                      Launch seated arenas or open-ground standing concerts, monitor live sell-through,
                      and protect fans with strict resale caps.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      disabled={!isApproved}
                      onClick={() => {
                        setSeatingMode('ASSIGNED_SEAT');
                        setActiveNav('events');
                        setShowBuilder(true);
                      }}
                      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#FF3366] px-5 py-3 text-xs font-bold text-white shadow-lg shadow-[#FF3366]/35 transition duration-300 hover:-translate-y-0.5 hover:bg-[#E62958] hover:shadow-xl hover:shadow-[#FF3366]/45 active:scale-95 disabled:opacity-40"
                    >
                      <span
                        aria-hidden="true"
                        className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      />
                      <Plus className="relative h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                      <span className="relative">Launch New Drop</span>
                    </button>
                    <button
                      onClick={() => setActiveNav('events')}
                      className="group inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15 active:scale-95"
                    >
                      All Events{' '}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Live Calculated KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div
                  style={{ animationDelay: '40ms' }}
                  className="animate-fade-up group rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/45 hover:shadow-xl hover:shadow-emerald-500/5 dark:border-zinc-800/80 dark:bg-[#111114]"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                    <span>Gross Ticket Sales</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 transition-transform duration-300 group-hover:scale-110">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
                    {formatRupees(estimatedRevenuePaise)}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">Across {events.length} total events</div>
                </div>

                <div
                  style={{ animationDelay: '90ms' }}
                  className="animate-fade-up group rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#FF3366]/45 hover:shadow-xl hover:shadow-[#FF3366]/5 dark:border-zinc-800/80 dark:bg-[#111114]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Passes Sold</div>
                      <div className="mt-2.5 flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
                          {totalSold}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">/ {totalCapacity}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">{sellThroughPct}% sell-through</div>
                    </div>

                    {/* Live Radial Sell-Through Ring */}
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          className="text-zinc-100 dark:text-zinc-800"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="#FF3366"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeDasharray={kpiRingCircumference}
                          strokeDashoffset={kpiRingOffset}
                          className="transition-[stroke-dashoffset] duration-700 ease-out"
                        />
                      </svg>
                      <TrendingUp className="absolute h-4 w-4 text-[#FF3366] transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>
                </div>

                <div
                  style={{ animationDelay: '140ms' }}
                  className="animate-fade-up group rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/45 hover:shadow-xl hover:shadow-violet-500/5 dark:border-zinc-800/80 dark:bg-[#111114]"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                    <span>Published Drops</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 transition-transform duration-300 group-hover:scale-110">
                      <Ticket className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
                    {publishedCount}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">{draftCount} draft awaiting publish</div>
                </div>

                <div
                  style={{ animationDelay: '190ms' }}
                  className="animate-fade-up group rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/45 hover:shadow-xl hover:shadow-amber-500/5 dark:border-zinc-800/80 dark:bg-[#111114]"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                    <span>Platform Fee</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 transition-transform duration-300 group-hover:scale-110">
                      <Percent className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
                    {(profile.platformFeeBps / 100).toFixed(2)}%
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Partner: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{profile.orgName}</span>
                  </div>
                </div>
              </div>

              {/* 2-Column Command Grid */}
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Left: Live Event Performance */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 lg:col-span-7 dark:border-zinc-800/80 dark:bg-[#111114]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                        Live Drops Performance
                      </h3>
                      <p className="text-xs text-zinc-500">Real-time occupancy across your venues</p>
                    </div>
                    <button
                      onClick={() => setActiveNav('events')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#FF3366] transition hover:underline"
                    >
                      Manage all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {events.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
                        No events launched yet. Use Quick Launch on the right to create your first drop!
                      </div>
                    ) : (
                      events.slice(0, 4).map((ev, idx) => {
                        const sold = ev.totalSeats - ev.availableSeats;
                        const pct = ev.totalSeats > 0 ? Math.round((sold / ev.totalSeats) * 100) : 0;
                        return (
                          <div
                            key={ev.id}
                            style={{ animationDelay: `${idx * 65}ms` }}
                            className="animate-fade-up group rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF3366]/45 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                                      ev.status === 'PUBLISHED'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {ev.status === 'PUBLISHED' && (
                                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                    )}
                                    {ev.status}
                                  </span>
                                  <span className="rounded bg-zinc-200/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                    {ev.seatingMode === 'STANDING' ? 'STANDING' : 'SEATED'}
                                  </span>
                                </div>
                                <div className="mt-1.5 truncate text-sm font-bold text-zinc-900 transition-colors group-hover:text-[#FF3366] dark:text-white">
                                  {ev.title}
                                </div>
                                <div className="mt-0.5 text-[11px] text-zinc-500">
                                  {ev.venueName}, {ev.city} · From {formatRupees(ev.minPricePaise)}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(ev)}
                                  title="Edit Event"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {ev.status === 'DRAFT' ? (
                                  <button
                                    disabled={publishMutation.isPending}
                                    onClick={() => publishMutation.mutate(ev.id)}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 active:scale-95"
                                  >
                                    Publish
                                  </button>
                                ) : (
                                  <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    {pct}% sold
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                                <span>{sold} booked</span>
                                <span>{ev.availableSeats} open</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-[#FF3366] to-amber-500 transition-all duration-700"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: Quick Launch Templates */}
                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                      Quick Launch Format
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Choose your venue style to jump straight into the builder.
                    </p>

                    <div className="mt-4 space-y-3">
                      <button
                        disabled={!isApproved}
                        onClick={() => {
                          setSeatingMode('ASSIGNED_SEAT');
                          setActiveNav('events');
                          setShowBuilder(true);
                        }}
                        className="group flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/5 active:scale-[0.99] disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 transition-transform duration-200 group-hover:scale-110">
                            <Armchair className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-white">
                              Assigned Seating Arena
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Theaters, comedy clubs &amp; numbered rows
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-violet-400" />
                      </button>

                      <button
                        disabled={!isApproved}
                        onClick={() => {
                          setSeatingMode('STANDING');
                          setActiveNav('events');
                          setShowBuilder(true);
                        }}
                        className="group flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 active:scale-[0.99] disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 transition-transform duration-200 group-hover:scale-110">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-white">
                              Open-Ground Standing Fest
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Fan Pit, VIP Lounge &amp; GA standing zones
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-emerald-400" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/80 dark:bg-[#111114]">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                      <Building2 className="h-4 w-4 text-[#FF3366]" /> Organization Details
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-zinc-500">
                      <div className="flex justify-between">
                        <span>Partner</span>
                        <span className="font-semibold text-zinc-900 dark:text-white">{profile.orgName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Account Owner</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{profile.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Resale Protection</span>
                        <span className="font-mono font-semibold text-emerald-500">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'events' && (
            <div className="animate-fade-up space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                    Your Events &amp; Seat Maps
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Create draft drops with custom tiers or standing zones, then publish to open live fan bookings.
                  </p>
                </div>
                <button
                  disabled={!isApproved}
                  onClick={() => setShowBuilder((v) => !v)}
                  className="group inline-flex items-center gap-2 rounded-xl bg-[#FF3366] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958] active:scale-95 disabled:opacity-40"
                >
                  <Plus className={`h-4 w-4 transition-transform duration-200 ${showBuilder ? 'rotate-45' : ''}`} />
                  {showBuilder ? 'Close Builder' : 'New Event Drop'}
                </button>
              </div>

              {/* Event & Seat-Map Builder Form — Production SaaS Layout */}
              {showBuilder && (
                <form
                  onSubmit={handleCreateSubmit}
                  className="animate-modal-pop overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#111114]"
                >
                  {/* Form Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div>
                      <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                        New Event &amp; Seat-Grid Configuration
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Configure venue details, anti-scalper guardrails, and auto-generated seat tiers.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF3366]/30 bg-[#FF3366]/10 px-3 py-1 font-mono text-xs font-bold text-[#FF3366]">
                      <Armchair className="h-3.5 w-3.5" /> {totalPreviewSeats} Total Seats
                    </span>
                  </div>

                  <div className="space-y-6 p-6">
                    {errorMsg && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
                        {errorMsg}
                      </div>
                    )}

                    {/* Section 1: Event Details */}
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#FF3366]/15 font-mono text-[10px] text-[#FF3366]">
                          1
                        </span>
                        Event &amp; Schedule Details
                      </div>

                      <div className="grid gap-4 md:grid-cols-12">
                        <div className="md:col-span-6">
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Event Title
                          </label>
                          <input
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter event title"
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Category
                          </label>
                          <div className="relative">
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 pr-10 pl-3.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                            >
                              <option value="CONCERT">Concert</option>
                              <option value="COMEDY">Comedy</option>
                              <option value="FESTIVAL">Festival</option>
                              <option value="SPORTS">Sports</option>
                              <option value="TECH">Tech Summit</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            City
                          </label>
                          <input
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="e.g., Pune"
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                          />
                        </div>

                        <div className="md:col-span-6">
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Venue Name
                          </label>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <input
                              required
                              value={venueName}
                              onChange={(e) => setVenueName(e.target.value)}
                              placeholder="Enter stadium, club, or arena name"
                              className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pr-3.5 pl-10 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Event Date
                          </label>
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#FF3366]" />
                            <input
                              type="date"
                              required
                              value={eventDate}
                              onChange={(e) => setEventDate(e.target.value)}
                              className="h-11 w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 pr-3 pl-10 font-mono text-xs text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Start Time
                          </label>
                          <div className="relative">
                            <Clock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#FF3366]" />
                            <input
                              type="time"
                              required
                              value={eventTime}
                              onChange={(e) => setEventTime(e.target.value)}
                              className="h-11 w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 pr-3 pl-10 font-mono text-xs text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Date Presets */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-zinc-500">Quick set:</span>
                        <button
                          type="button"
                          onClick={() => applyQuickSchedule(3, '19:30')}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                        >
                          +3 Days · 7:30 PM
                        </button>
                        <button
                          type="button"
                          onClick={() => applyQuickSchedule(7, '20:00')}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                        >
                          +1 Week · 8:00 PM
                        </button>
                        <button
                          type="button"
                          onClick={() => applyQuickSchedule(14, '18:30')}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600 transition hover:border-[#FF3366]/50 hover:text-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                        >
                          +2 Weeks · 6:30 PM
                        </button>
                      </div>

                      <div className="mt-4">
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Event Description
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe artists, lineup, gates open time, and venue guidelines"
                          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[#FF3366] focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:bg-zinc-900"
                        />
                      </div>
                    </div>

                    {/* Section 2: Drop & Anti-Scalper Controls */}
                    <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#FF3366]/15 font-mono text-[10px] text-[#FF3366]">
                          2
                        </span>
                        Drop Protection &amp; Resale Guardrails
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => setFlashSaleEnabled((v) => !v)}
                          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition ${
                            flashSaleEnabled
                              ? 'border-[#FF3366]/50 bg-[#FF3366]/5'
                              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
                              <Zap className="h-3.5 w-3.5 text-[#FF3366]" /> Flash-Sale Waiting Room
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              Admits fans through a fair virtual queue during peak drops.
                            </p>
                          </div>
                          <span
                            className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                              flashSaleEnabled ? 'bg-[#FF3366]' : 'bg-zinc-300 dark:bg-zinc-700'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                flashSaleEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setResaleEnabled((v) => !v)}
                          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition ${
                            resaleEnabled
                              ? 'border-emerald-500/50 bg-emerald-500/5'
                              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Verified Fan Resale
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              Allow safe escrow resale with automatic QR code rotation.
                            </p>
                          </div>
                          <span
                            className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                              resaleEnabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                resaleEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>

                        <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                          <label className="text-xs font-bold text-zinc-900 dark:text-white">
                            Max Resale Price Cap
                          </label>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              step="0.05"
                              min="1.00"
                              max="2.00"
                              disabled={!resaleEnabled}
                              value={maxResaleMultiplier}
                              onChange={(e) => setMaxResaleMultiplier(e.target.value)}
                              className="h-9 w-24 rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs font-bold text-zinc-900 outline-none focus:border-[#FF3366] disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                            />
                            <span className="text-[11px] text-zinc-500">
                              × face value ({Math.round(Number(maxResaleMultiplier || 1) * 100)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Venue Layout Mode + Dynamic Seat/Zone Tiers */}
                    <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#FF3366]/15 font-mono text-[10px] text-[#FF3366]">
                            3
                          </span>
                          Venue Layout &amp; {seatingMode === 'STANDING' ? 'Standing Zones' : 'Seat Tiers'}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                            <button
                              type="button"
                              onClick={() => setSeatingMode('ASSIGNED_SEAT')}
                              className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                                seatingMode === 'ASSIGNED_SEAT'
                                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                                  : 'text-zinc-500'
                              }`}
                            >
                              Assigned Seating
                            </button>
                            <button
                              type="button"
                              onClick={() => setSeatingMode('STANDING')}
                              className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                                seatingMode === 'STANDING'
                                  ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                                  : 'text-zinc-500'
                              }`}
                            >
                              Open-Ground Standing
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const nextColor = COLOR_SWATCHES[tiers.length % COLOR_SWATCHES.length].code;
                              setTiers((prev) => [
                                ...prev,
                                {
                                  name: seatingMode === 'STANDING' ? 'General Admission' : 'Silver Stand',
                                  priceRupees: 799,
                                  colorCode: nextColor,
                                  rowPrefix: 'S',
                                  rowCount: 2,
                                  seatsPerRow: 10,
                                  capacity: 1000,
                                },
                              ]);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#FF3366]/10 px-3 py-1.5 text-xs font-bold text-[#FF3366] transition hover:bg-[#FF3366]/20"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add {seatingMode === 'STANDING' ? 'Zone' : 'Tier'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {tiers.map((tier, idx) => {
                          const tierSeats =
                            seatingMode === 'STANDING' ? tier.capacity : tier.rowCount * tier.seatsPerRow;
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-2 items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 sm:grid-cols-12 dark:border-zinc-800 dark:bg-zinc-950"
                            >
                              <div className="col-span-2 sm:col-span-3">
                                <label className="block text-[11px] font-semibold text-zinc-500">
                                  {seatingMode === 'STANDING' ? 'Zone Name' : 'Tier Name'}
                                </label>
                                <input
                                  required
                                  value={tier.name}
                                  onChange={(e) =>
                                    setTiers((prev) =>
                                      prev.map((t, i) => (i === idx ? { ...t, name: e.target.value } : t)),
                                    )
                                  }
                                  className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-zinc-500">Price (₹)</label>
                                <input
                                  type="number"
                                  min={0}
                                  required
                                  value={tier.priceRupees}
                                  onChange={(e) =>
                                    setTiers((prev) =>
                                      prev.map((t, i) =>
                                        i === idx ? { ...t, priceRupees: Number(e.target.value) } : t,
                                      ),
                                    )
                                  }
                                  className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs font-semibold text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                />
                              </div>

                              {/* Organizer Custom Zone Color Swatch Picker */}
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-zinc-500">Zone Color</label>
                                <div className="mt-1 flex h-9 items-center gap-1.5">
                                  {COLOR_SWATCHES.map((sw) => (
                                    <button
                                      key={sw.code}
                                      type="button"
                                      title={sw.label}
                                      onClick={() =>
                                        setTiers((prev) =>
                                          prev.map((t, i) => (i === idx ? { ...t, colorCode: sw.code } : t)),
                                        )
                                      }
                                      className={`h-5 w-5 rounded-full ${sw.bg} transition ${
                                        tier.colorCode === sw.code
                                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900'
                                          : 'opacity-55 hover:opacity-100'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>

                              {seatingMode === 'STANDING' ? (
                                <div className="col-span-2 sm:col-span-4">
                                  <label className="block text-[11px] font-semibold text-zinc-500">
                                    Zone Capacity (Standing Passes)
                                  </label>
                                  <input
                                    type="number"
                                    min={10}
                                    max={50000}
                                    required
                                    value={tier.capacity}
                                    onChange={(e) =>
                                      setTiers((prev) =>
                                        prev.map((t, i) =>
                                          i === idx ? { ...t, capacity: Number(e.target.value) } : t,
                                        ),
                                      )
                                    }
                                    className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs font-semibold text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="sm:col-span-1">
                                    <label className="block text-[11px] font-semibold text-zinc-500">Row</label>
                                    <input
                                      required
                                      maxLength={3}
                                      value={tier.rowPrefix}
                                      onChange={(e) =>
                                        setTiers((prev) =>
                                          prev.map((t, i) => (i === idx ? { ...t, rowPrefix: e.target.value } : t)),
                                        )
                                      }
                                      className="mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 font-mono text-xs font-bold uppercase text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                    />
                                  </div>

                                  <div className="col-span-2 sm:col-span-3">
                                    <label className="block text-[11px] font-semibold text-zinc-500">
                                      Rows × Seats ({tierSeats})
                                    </label>
                                    <div className="mt-1 flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={tier.rowCount}
                                        onChange={(e) =>
                                          setTiers((prev) =>
                                            prev.map((t, i) =>
                                              i === idx ? { ...t, rowCount: Number(e.target.value) } : t,
                                            ),
                                          )
                                        }
                                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 font-mono text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                      />
                                      <span className="font-mono text-xs text-zinc-400">×</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={tier.seatsPerRow}
                                        onChange={(e) =>
                                          setTiers((prev) =>
                                            prev.map((t, i) =>
                                              i === idx ? { ...t, seatsPerRow: Number(e.target.value) } : t,
                                            ),
                                          )
                                        }
                                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 font-mono text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}

                              <div className="flex justify-end sm:col-span-1">
                                {tiers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Submit Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                      <p className="text-xs text-zinc-500">
                        Drafts stay hidden from fans until you click <strong>Publish Live</strong>.
                      </p>
                      <button
                        type="submit"
                        disabled={createEventMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#FF3366] px-6 py-3 text-xs font-bold text-white shadow-lg shadow-[#FF3366]/25 transition hover:-translate-y-0.5 hover:bg-[#E62958] disabled:opacity-50"
                      >
                        <Rocket className="h-4 w-4" />
                        {createEventMutation.isPending
                          ? 'Generating Seat Grid...'
                          : `Create Draft & Generate ${totalPreviewSeats} Seats`}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Interactive Search & Status Filter Bar */}
              {events.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="group relative w-full sm:max-w-xs">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#FF3366]" />
                    <input
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      placeholder="Filter your events..."
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white pr-8 pl-9 text-xs text-zinc-900 outline-none transition focus:border-[#FF3366] focus:ring-4 focus:ring-[#FF3366]/10 dark:border-zinc-800 dark:bg-[#111114] dark:text-white"
                    />
                    {eventSearch && (
                      <button
                        type="button"
                        onClick={() => setEventSearch('')}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition-all active:scale-95 ${
                          statusFilter === st
                            ? 'bg-[#FF3366] text-white shadow-sm shadow-[#FF3366]/30'
                            : 'border border-zinc-200 bg-white text-zinc-600 hover:border-[#FF3366]/40 dark:border-zinc-800 dark:bg-[#111114] dark:text-zinc-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Events List */}
              <div className="grid gap-4">
                {events.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
                    No events created yet. Click <strong>New Event Drop</strong> to generate your first seat map!
                  </div>
                )}
                {events.length > 0 && filteredAdminEvents.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-xs text-zinc-500 dark:border-zinc-800">
                    No events match this filter. Try clearing the search or switching status pills.
                  </div>
                )}
                {filteredAdminEvents.map((ev, idx) => {
                  const sold = ev.totalSeats - ev.availableSeats;
                  const pct = ev.totalSeats > 0 ? Math.round((sold / ev.totalSeats) * 100) : 0;
                  return (
                    <div
                      key={ev.id}
                      style={{ animationDelay: `${Math.min(idx, 5) * 60}ms` }}
                      className="animate-fade-up group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF3366]/45 hover:shadow-xl hover:shadow-[#FF3366]/5 dark:border-zinc-800 dark:bg-[#111114]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                              ev.status === 'PUBLISHED'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {ev.status === 'PUBLISHED' && (
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            )}
                            {ev.status}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                            {ev.category}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                            {ev.seatingMode === 'STANDING' ? 'STANDING' : 'SEATED'}
                          </span>
                          {ev.flashSaleEnabled && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#FF3366]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#FF3366]">
                              <Zap className="h-3 w-3" /> FLASH QUEUE
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 text-base font-bold text-zinc-900 transition-colors group-hover:text-[#FF3366] dark:text-white">
                          {ev.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-[#FF3366]" /> {ev.venueName}, {ev.city}
                          </span>
                          <span>{new Date(ev.eventStartAt).toLocaleString()}</span>
                          <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                            From {formatRupees(ev.minPricePaise)}
                          </span>
                        </div>

                        <div className="mt-3 max-w-sm">
                          <div className="flex justify-between font-mono text-[11px] text-zinc-500">
                            <span>
                              {sold} / {ev.totalSeats} booked ({pct}%)
                            </span>
                            <span>{ev.availableSeats} open</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-[#FF3366] to-amber-500 transition-all duration-700"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(ev)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:-translate-y-0.5 hover:border-[#FF3366]/50 hover:text-[#FF3366] active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        {ev.status === 'DRAFT' && (
                          <button
                            disabled={publishMutation.isPending}
                            onClick={() => publishMutation.mutate(ev.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
                          >
                            <Rocket className="h-3.5 w-3.5" /> Publish Live
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Guarded Edit Event Modal (Safe fields editable; seating layout locked to protect sold tickets) */}
      {editingEvent && (
        <div
          onClick={() => setEditingEvent(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-pop max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#111114]"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  Edit Event Details
                </h3>
                <p className="text-xs text-zinc-500">
                  Venue mode ({editingEvent.seatingMode === 'STANDING' ? 'Open-Ground Standing' : 'Assigned Seating'}) and existing tiers are locked to protect booked passes.
                </p>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateEventMutation.mutate();
              }}
              className="mt-5 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Event Title
                  </label>
                  <input
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 pr-9 pl-3.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="CONCERT">Concert</option>
                      <option value="COMEDY">Comedy</option>
                      <option value="FESTIVAL">Festival</option>
                      <option value="SPORTS">Sports</option>
                      <option value="TECH">Tech Summit</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    City
                  </label>
                  <input
                    required
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Venue Name
                  </label>
                  <input
                    required
                    value={editVenue}
                    onChange={(e) => setEditVenue(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                <label className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editFlashSale}
                    onChange={(e) => setEditFlashSale(e.target.checked)}
                    className="accent-[#FF3366]"
                  />
                  Flash-Sale Queue
                </label>
                <label className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editResale}
                    onChange={(e) => setEditResale(e.target.checked)}
                    className="accent-[#FF3366]"
                  />
                  Allow Resale
                </label>
                <label className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
                  Max Cap:
                  <input
                    type="number"
                    step="0.05"
                    min="1.00"
                    max="2.00"
                    disabled={!editResale}
                    value={editResaleCap}
                    onChange={(e) => setEditResaleCap(e.target.value)}
                    className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateEventMutation.isPending}
                  className="rounded-xl bg-[#FF3366] px-5 py-2 text-xs font-bold text-white shadow-md shadow-[#FF3366]/20 transition hover:bg-[#E62958] disabled:opacity-50"
                >
                  {updateEventMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
