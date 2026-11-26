import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Moon, Settings, Sun, type LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from './BrandLogo';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

interface DashboardLayoutProps {
  workspaceLabel: string;
  pageTitle: string;
  pageSubtitle?: string;
  navItems: SidebarNavItem[];
  activeNav: string;
  onSelectNav: (id: string) => void;
  children: ReactNode;
}

export default function DashboardLayout({
  workspaceLabel,
  pageTitle,
  pageSubtitle,
  navItems,
  activeNav,
  onSelectNav,
  children,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Left Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-[#0D0D10] lg:flex">
        <div className="flex h-16 items-center border-b border-zinc-200 px-5 dark:border-zinc-800/80">
          <BrandLogo size="sm" subtitle={workspaceLabel} />
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => !item.disabled && onSelectNav(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#FF3366]/10 text-[#FF3366] dark:bg-[#FF3366]/15'
                    : item.disabled
                      ? 'cursor-not-allowed text-zinc-400 opacity-60 dark:text-zinc-600'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      isActive
                        ? 'bg-[#FF3366] text-white'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800/80">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="truncate text-xs font-semibold text-zinc-900 dark:text-white">
              {user?.fullName}
            </div>
            <div className="truncate font-mono text-[11px] text-zinc-500">{user?.email}</div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <Link
                to="/settings"
                className="flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-[#FF3366]/40 hover:text-[#FF3366] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-rose-500/40 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-rose-400"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-zinc-200 bg-white/85 px-4 backdrop-blur sm:px-6 dark:border-zinc-800/80 dark:bg-[#09090B]/85">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-zinc-900 sm:text-base dark:text-white">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="hidden truncate text-xs text-zinc-500 sm:block">{pageSubtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Gateway Live
            </span>

            <button
              onClick={toggleTheme}
              title="Toggle Light / Dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <Link
              to="/settings"
              title="Account Settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-[#FF3366]/40 hover:text-[#FF3366] lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </header>

        {/* Mobile Nav Pills */}
        <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2.5 lg:hidden dark:border-zinc-800 dark:bg-[#0D0D10]">
          {navItems
            .filter((n) => !n.disabled)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectNav(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-[#FF3366] text-white'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

