import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Moon, Sun } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SuperAdminLoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user.role !== 'SUPER_ADMIN') {
        setError('Access denied: this portal is restricted to Platform Super Administrators.');
        return;
      }
      navigate('/super-admin', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Invalid administrator credentials.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12 text-zinc-900 transition-colors duration-200 dark:bg-[#09090B] dark:text-zinc-100">
      <button
        onClick={toggleTheme}
        title="Toggle Light / Dark theme"
        className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-2xl dark:border-zinc-800 dark:bg-[#111114]">
        <div className="flex items-center justify-between">
          <BrandLogo size="sm" subtitle="Trust & Safety" />
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <Lock className="h-3 w-3" /> RESTRICTED
          </span>
        </div>

        <h1 className="mt-6 text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Platform Control Login
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Authorized TicketDrop AI Super Administrators only. All actions are immutably audited.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ticketdrop.ai"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pr-10 pl-3.5 text-sm text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF3366] py-2.5 text-sm font-bold text-white transition hover:bg-[#E62958] disabled:opacity-50"
          >
            {submitting ? 'Verifying...' : 'Enter Platform Control'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
