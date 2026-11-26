import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ImageUp,
  Keyboard,
  QrCode,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import type { EventSummary, VerifyQrResponse } from '../types/event';

interface VenueQrScannerProps {
  events: EventSummary[];
  onErrorNotice: (msg: string) => void;
}

const READER_ELEMENT_ID = 'ticketdrop-live-qr-reader';

export default function VenueQrScanner({ events, onErrorNotice }: VenueQrScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [scannerEventId, setScannerEventId] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VerifyQrResponse | null>(null);
  const [scanHistory, setScanHistory] = useState<VerifyQrResponse[]>([]);

  const qrInstanceRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ token: string; at: number }>({ token: '', at: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerEventIdRef = useRef(scannerEventId);
  scannerEventIdRef.current = scannerEventId;

  const verifyMutation = useMutation({
    mutationFn: async (tokenId: string) =>
      (
        await apiClient.post<VerifyQrResponse>('/admin/tickets/verify-qr', {
          qrTokenId: tokenId.trim(),
          eventId: scannerEventIdRef.current || null,
        })
      ).data,
    onSuccess: (res) => {
      setScanResult(res);
      setScanHistory((prev) => [res, ...prev].slice(0, 20));
      setQrInput('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'QR verification failed. Please retry.';
      onErrorNotice(msg);
    },
  });

  const handleDecodedToken = (decodedText: string) => {
    const clean = decodedText.trim();
    if (!clean) return;
    const now = Date.now();
    // 3-second cooldown for identical token so camera doesn't spam verification
    if (lastScannedRef.current.token === clean && now - lastScannedRef.current.at < 3000) {
      return;
    }
    lastScannedRef.current = { token: clean, at: now };
    verifyMutation.mutate(clean);
  };

  const stopCamera = async () => {
    const instance = qrInstanceRef.current;
    if (!instance) {
      setCameraActive(false);
      return;
    }
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignore cleanup errors on already-stopped camera
    } finally {
      qrInstanceRef.current = null;
      setCameraActive(false);
      setCameraStarting(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraStarting(true);
    try {
      await stopCamera();
      const html5Qr = new Html5Qrcode(READER_ELEMENT_ID);
      qrInstanceRef.current = html5Qr;
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => handleDecodedToken(decodedText),
        () => {
          // Per-frame scan misses are normal while positioning QR
        },
      );
      setCameraActive(true);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      setCameraError(
        raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('notallowed')
          ? 'Camera permission denied. Allow webcam access in your browser bar, or use Image Upload / Manual Token.'
          : 'No active camera found or camera is busy. You can scan from an uploaded QR image or paste the UUID manually.',
      );
      setCameraActive(false);
      qrInstanceRef.current = null;
    } finally {
      setCameraStarting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    try {
      const wasActive = cameraActive;
      if (wasActive) await stopCamera();
      const tempScanner = new Html5Qrcode(READER_ELEMENT_ID);
      const decoded = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      handleDecodedToken(decoded);
    } catch {
      setCameraError('Could not detect a valid QR code in that image. Try a clearer screenshot of the pass.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Stop webcam cleanly on unmount or mode switch
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'camera' && cameraActive) {
      void stopCamera();
    }
  }, [mode, cameraActive]);

  const admittedCount = scanHistory.filter((s) => s.valid).length;
  const deniedCount = scanHistory.length - admittedCount;

  return (
    <div className="animate-fade-up space-y-6">
      {/* Top Gate Command Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/80 dark:bg-[#111115]">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            SESSION SCANS
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-zinc-900 dark:text-white">
            {scanHistory.length}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            ADMITTED
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {admittedCount}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            DENIED / REVOKED
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {deniedCount}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Live Camera & Manual Gate Scanner */}
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl lg:col-span-7 dark:border-zinc-800 dark:bg-[#111115]">
          <div className="h-1.5 bg-gradient-to-r from-[#FF3366] via-amber-500 to-emerald-500" />

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF3366]/15 text-[#FF3366]">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                    Venue Gate QR Scanner
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Real-time cryptographic verification &amp; instant revoked-pass check.
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setMode('camera')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    mode === 'camera'
                      ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" /> Camera
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    mode === 'manual'
                      ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Keyboard className="h-3.5 w-3.5" /> Manual UUID
                </button>
              </div>
            </div>

            {/* Event Scope Selector */}
            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Gate Event Scope (Optional)
              </label>
              <div className="relative">
                <select
                  value={scannerEventId}
                  onChange={(e) => setScannerEventId(e.target.value)}
                  className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 pr-10 pl-3.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                >
                  <option value="">All My Events</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.status})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>
            </div>

            {/* Camera Viewfinder Mode */}
            {mode === 'camera' && (
              <div className="mt-5 space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
                  {/* Html5Qrcode mounts video inside this div */}
                  <div
                    id={READER_ELEMENT_ID}
                    className={`w-full overflow-hidden ${cameraActive ? 'min-h-[270px]' : 'h-0'}`}
                  />

                  {cameraActive && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-56 w-56 rounded-2xl">
                        <span className="absolute top-0 left-0 h-7 w-7 rounded-tl-xl border-t-4 border-l-4 border-[#FF3366]" />
                        <span className="absolute top-0 right-0 h-7 w-7 rounded-tr-xl border-t-4 border-r-4 border-[#FF3366]" />
                        <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-[#FF3366]" />
                        <span className="absolute right-0 bottom-0 h-7 w-7 rounded-br-xl border-r-4 border-b-4 border-[#FF3366]" />
                        <div className="animate-scan-laser absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#FF3366] to-transparent shadow-[0_0_12px_#FF3366]" />
                      </div>
                    </div>
                  )}

                  {!cameraActive && (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF3366]/15 text-[#FF3366] ring-1 ring-[#FF3366]/30">
                        <Camera className="h-7 w-7" />
                      </div>
                      <h3 className="mt-4 text-sm font-extrabold text-white">
                        Ready to Scan Attendee Passes
                      </h3>
                      <p className="mt-1 max-w-xs text-xs text-zinc-400">
                        Point your webcam or phone camera at any fan&apos;s QR pass, or upload a pass screenshot.
                      </p>

                      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          disabled={cameraStarting}
                          onClick={() => void startCamera()}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#FF3366] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#FF3366]/30 transition hover:-translate-y-0.5 hover:bg-[#E62958] disabled:opacity-50"
                        >
                          <Camera className="h-4 w-4" />
                          {cameraStarting ? 'Starting Camera...' : 'Start Live Camera'}
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          <ImageUp className="h-4 w-4" /> Scan Image
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {cameraActive && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Camera Live — Hold QR pass steady inside frame
                    </span>
                    <button
                      type="button"
                      onClick={() => void stopCamera()}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-rose-500"
                    >
                      <CameraOff className="h-3.5 w-3.5" /> Stop
                    </button>
                  </div>
                )}

                {cameraError && (
                  <div className="animate-slide-reveal rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {cameraError}
                  </div>
                )}
              </div>
            )}

            {/* Manual UUID Entry Mode */}
            {mode === 'manual' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!qrInput.trim()) return;
                  verifyMutation.mutate(qrInput);
                }}
                className="mt-5 space-y-3"
              >
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Pass QR Token UUID
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    required
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Paste copied QR Token UUID..."
                    className="h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 font-mono text-xs text-zinc-900 outline-none focus:border-[#FF3366] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={verifyMutation.isPending}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#FF3366] px-5 text-xs font-bold text-white shadow-md shadow-[#FF3366]/25 transition hover:bg-[#E62958] disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {verifyMutation.isPending ? 'Verifying...' : 'Verify & Admit'}
                  </button>
                </div>
              </form>
            )}

            {/* Live Verification Result Hero Card */}
            {scanResult && (
              <div
                key={scanResult.scannedAt}
                className={`animate-modal-pop mt-5 overflow-hidden rounded-2xl border p-5 ${
                  scanResult.valid
                    ? 'border-emerald-500/45 bg-emerald-500/10'
                    : 'border-rose-500/45 bg-rose-500/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-extrabold ${
                      scanResult.valid
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
                    }`}
                  >
                    {scanResult.valid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {scanResult.outcome}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {new Date(scanResult.scannedAt).toLocaleTimeString()}
                  </span>
                </div>

                <p className="mt-2.5 text-sm font-extrabold text-zinc-900 dark:text-white">
                  {scanResult.message}
                </p>

                {scanResult.attendeeName && (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-zinc-200/60 bg-white/80 p-3 text-xs dark:border-zinc-800 dark:bg-black/35">
                    <div>
                      <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">ATTENDEE</div>
                      <div className="truncate font-bold text-zinc-900 dark:text-white">
                        {scanResult.attendeeName}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">TIER</div>
                      <div className="truncate font-bold text-[#FF3366]">{scanResult.tierName}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] font-semibold uppercase text-zinc-400">PASS</div>
                      <div className="truncate font-mono font-bold text-zinc-900 dark:text-white">
                        {scanResult.passLabel}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Session Entry Log */}
        <div className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-5 dark:border-zinc-800 dark:bg-[#111115]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                Recent Gate Scans
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">Live verification feed for this session</p>
            </div>
            {scanHistory.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setScanHistory([]);
                  setScanResult(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 transition hover:border-rose-500/40 hover:text-rose-500 dark:border-zinc-800"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto">
            {scanHistory.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
                <AlertTriangle className="h-6 w-6 text-zinc-400" />
                <p className="mt-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  No passes scanned yet
                </p>
                <p className="mt-1 max-w-[230px] text-[11px] leading-relaxed text-zinc-500">
                  Start the live camera to scan a fan&apos;s QR pass, or switch to Manual UUID mode.
                </p>
              </div>
            ) : (
              scanHistory.map((item, i) => (
                <div
                  key={`${item.scannedAt}-${i}`}
                  className="animate-slide-reveal flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/70"
                >
                  <div className="min-w-0">
                    <div className="truncate font-bold text-zinc-900 dark:text-white">
                      {item.attendeeName ?? 'Unrecognized Pass'}
                      {item.passLabel ? ` · ${item.passLabel}` : ''}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                      <span>{item.outcome}</span>
                      <span>·</span>
                      <span>{new Date(item.scannedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] font-extrabold ${
                      item.valid
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {item.valid ? 'ADMITTED' : 'DENIED'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

