import { Ticket, Sparkles, Clock, ShieldCheck, LogOut, Moon, Sun, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from '../components/BrandLogo';

export default function UserPortal() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Consumer Top Navbar */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800/80 dark:bg-[#09090B]/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <BrandLogo size="md" />

          <div className="hidden max-w-md flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100/80 px-4 py-2 text-xs text-zinc-500 md:flex dark:border-zinc-800 dark:bg-zinc-900">
            <Search className="h-3.5 w-3.5 text-[#FF3366]" />
            <span>Ask AI Concierge: &ldquo;Indie gigs this weekend under ₹1500...&rdquo;</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="hidden text-right sm:block">
              <div className="text-xs font-bold text-zinc-900 dark:text-white">{user?.fullName}</div>
              <div className="font-mono text-[10px] text-zinc-500">FAN · VERIFIED</div>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-rose-500/40 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Consumer Hero */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-[#09090B] p-8 text-white shadow-xl sm:p-10 dark:border-zinc-800">
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[#FF3366]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold text-amber-300">
              WELCOME, {user?.fullName?.toUpperCase()}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Discover live drops without refresh hell.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Your attendee session is protected by JWT + Redis token rotation. Phase 2 unlocks live
              event browsing, virtual waiting rooms, and 10-minute distributed seat locks.
            </p>
          </div>
        </div>

        {/* Feature Roadmap Cards */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF3366]/15 text-[#FF3366]">
              <Ticket className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-bold text-zinc-900 dark:text-white">
              Flash-Sale Seat Picker
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Interactive SVG seat maps backed by Redisson distributed locks &amp; live 10-minute
              checkout countdowns.
            </p>
            <span className="mt-4 inline-block rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              COMING IN PHASE 2
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Clock className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-bold text-zinc-900 dark:text-white">
              Smart Auto-Waitlist &amp; Resale
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Instant Kafka seat-claim alerts when locks expire + price-capped fan resale with atomic
              QR code rotation.
            </p>
            <span className="mt-4 inline-block rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              COMING IN PHASE 3
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800/80 dark:bg-[#111114]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-bold text-zinc-900 dark:text-white">
              AI Event Concierge
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Natural-language event discovery powered by Spring AI + pgvector with live adjacent-seat
              tool checks.
            </p>
            <span className="mt-4 inline-block rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              COMING IN PHASE 4
            </span>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 font-mono text-xs text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Signed in as {user?.email} · Role: {user?.role} · Status: {user?.status}
        </div>
      </main>
    </div>
  );
}
