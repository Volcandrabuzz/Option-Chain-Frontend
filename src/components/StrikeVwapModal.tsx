/**
 * StrikeVwapModal.tsx
 *
 * Full-screen popup for a single strike+side showing:
 *  - 30-sec OHLC candlestick chart (pure SVG, no extra lib needed)
 *  - VWAP line overlay on the same chart
 *  - Live LTP vs VWAP header badge
 *
 * Opens when a user clicks any row in OptionStrikeSignalTable.
 * Updates live as new socket data arrives (parent passes updated payload).
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VwapCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
}

export interface StrikeVwapEntry {
  candles: VwapCandle[];
  ltp: number;
  vwap: number | null;
}

// keyed as "25000_CE" / "25000_PE"
export type StrikeVwapPayload = Record<string, StrikeVwapEntry>;

export interface SelectedStrike {
  strike: number;
  side: 'CE' | 'PE';
}

interface StrikeVwapModalProps {
  selected: SelectedStrike | null;       // which strike+side is open
  vwapData: StrikeVwapPayload;           // full payload from backend
  onClose: () => void;
  selectedIndex?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt2(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v as number)) return '—';
  return (v as number).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortTime(ts: string): string {
  // NSE timestamp: "01-Nov-2026 09:16:00" → "09:16:00"
  if (!ts) return '';
  const parts = ts.split(' ');
  return parts[1] ?? ts;
}

// ─── SVG Candlestick + VWAP Chart ────────────────────────────────────────────

const CHART_PADDING = { top: 20, right: 16, bottom: 48, left: 72 };

interface CandleChartProps {
  candles: VwapCandle[];
  width: number;
  height: number;
}

const CandleChart: React.FC<CandleChartProps> = ({ candles, width, height }) => {
  if (!candles || candles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Waiting for first 30-sec candle (needs 3 fetches)…
      </div>
    );
  }

  const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Price range across candles + VWAP
  const allPrices: number[] = [];
  candles.forEach(c => {
    allPrices.push(c.high, c.low, c.open, c.close, c.vwap);
  });
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad = (rawMax - rawMin) * 0.08 || rawMax * 0.01 || 1;
  const priceMin = rawMin - pad;
  const priceMax = rawMax + pad;
  const priceRange = priceMax - priceMin;

  const toY = (price: number) =>
    CHART_PADDING.top + innerH - ((price - priceMin) / priceRange) * innerH;

  // X positions: evenly spaced candles
  const candleCount = candles.length;
  const candleW = Math.max(4, Math.min(24, (innerW / (candleCount + 1)) * 0.65));
  const step = innerW / (candleCount + 1);

  const xOf = (i: number) => CHART_PADDING.left + step * (i + 1);

  // Y grid lines (5 levels)
  const gridLevels = 5;
  const yGridLines = Array.from({ length: gridLevels }, (_, i) => {
    const frac = i / (gridLevels - 1);
    const price = priceMin + frac * priceRange;
    const y = toY(price);
    return { y, price };
  });

  // VWAP line points
  const vwapPoints = candles
    .map((c, i) => `${xOf(i)},${toY(c.vwap)}`)
    .join(' ');

  // X-axis labels: show every N to avoid clutter
  const labelEvery = Math.max(1, Math.ceil(candleCount / 8));

  return (
    <svg
      width={width}
      height={height}
      className="select-none overflow-visible"
    >
      {/* Grid lines */}
      {yGridLines.map(({ y, price }, i) => (
        <g key={i}>
          <line
            x1={CHART_PADDING.left}
            y1={y}
            x2={CHART_PADDING.left + innerW}
            y2={y}
            stroke="#374151"
            strokeWidth={0.75}
            strokeDasharray="4,4"
          />
          <text
            x={CHART_PADDING.left - 6}
            y={y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#9CA3AF"
            fontFamily="monospace"
          >
            {price.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const cx = xOf(i);
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#22c55e' : '#ef4444';
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(1.5, bodyBot - bodyTop);
        const wickTop = toY(c.high);
        const wickBot = toY(c.low);

        return (
          <g key={i}>
            {/* High-Low wick */}
            <line
              x1={cx}
              y1={wickTop}
              x2={cx}
              y2={wickBot}
              stroke={color}
              strokeWidth={1.5}
            />
            {/* Open-Close body */}
            <rect
              x={cx - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={bodyH}
              fill={isGreen ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'}
              stroke={color}
              strokeWidth={1}
              rx={1}
            />
          </g>
        );
      })}

      {/* VWAP line */}
      {candles.length > 1 && (
        <polyline
          points={vwapPoints}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.95}
        />
      )}
      {/* VWAP dots */}
      {candles.map((c, i) => (
        <circle
          key={i}
          cx={xOf(i)}
          cy={toY(c.vwap)}
          r={3}
          fill="#f59e0b"
          stroke="#1f2937"
          strokeWidth={1.5}
        />
      ))}

      {/* X-axis labels */}
      {candles.map((c, i) => {
        if (i % labelEvery !== 0 && i !== candles.length - 1) return null;
        return (
          <text
            key={i}
            x={xOf(i)}
            y={CHART_PADDING.top + innerH + 28}
            textAnchor="middle"
            fontSize={9}
            fill="#6B7280"
            fontFamily="monospace"
          >
            {shortTime(c.time)}
          </text>
        );
      })}

      {/* Axis borders */}
      <line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top}
        x2={CHART_PADDING.left}
        y2={CHART_PADDING.top + innerH}
        stroke="#4B5563"
        strokeWidth={1}
      />
      <line
        x1={CHART_PADDING.left}
        y1={CHART_PADDING.top + innerH}
        x2={CHART_PADDING.left + innerW}
        y2={CHART_PADDING.top + innerH}
        stroke="#4B5563"
        strokeWidth={1}
      />
    </svg>
  );
};

// ─── Main Modal Component ─────────────────────────────────────────────────────

export const StrikeVwapModal: React.FC<StrikeVwapModalProps> = ({
  selected,
  vwapData,
  onClose,
  selectedIndex = 'NIFTY',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [activeSide, setActiveSide] = React.useState<'CE' | 'PE'>(selected?.side ?? 'CE');

  useEffect(() => {
    if (selected) {
      setActiveSide(selected.side);
    }
  }, [selected]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Scroll chart to right-most candle whenever new data arrives
  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.scrollLeft = chartContainerRef.current.scrollWidth;
    }
  });

  const currentSide = activeSide;
  const entry = useMemo<StrikeVwapEntry | null>(() => {
    if (!selected) return null;
    const key = `${selected.strike}_${currentSide}`;
    return vwapData[key] ?? null;
  }, [selected, currentSide, vwapData]);

  if (!selected) return null;

  const candles = entry?.candles ?? [];
  const ltp = entry?.ltp ?? null;
  const vwap = entry?.vwap ?? (candles.length > 0 ? candles[candles.length - 1].vwap : null);

  const ltpAboveVwap =
    ltp !== null && vwap !== null
      ? ltp > vwap
        ? 'above'
        : ltp < vwap
        ? 'below'
        : 'equal'
      : null;

  const isCe = currentSide === 'CE';
  const sideColor = isCe ? 'text-blue-400' : 'text-green-400';
  const sideBg   = isCe ? 'bg-blue-500/20 border-blue-500/40' : 'bg-green-500/20 border-green-500/40';

  // Chart sizing — fill the modal content area
  const CHART_W = Math.max(600, candles.length * 36 + 160);
  const CHART_H = 340;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div className="relative w-full max-w-5xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            {/* CE / PE Side Toggle */}
            <div className="flex items-center p-0.5 rounded-lg bg-gray-800 border border-gray-700">
              <button
                type="button"
                onClick={() => setActiveSide('CE')}
                className={`px-3 py-1 rounded-md text-xs font-black transition-all ${
                  currentSide === 'CE'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                CE (Call)
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('PE')}
                className={`px-3 py-1 rounded-md text-xs font-black transition-all ${
                  currentSide === 'PE'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                PE (Put)
              </button>
            </div>

            <h2 className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {selectedIndex}
              </span>
              <span>Strike</span>{' '}
              <span className="text-yellow-300 font-mono">
                {selected.strike.toLocaleString('en-IN')}
              </span>
            </h2>
            <span className="text-xs text-gray-400 hidden sm:inline">30-sec Candles + VWAP</span>
          </div>

          {/* LTP vs VWAP badges */}
          <div className="flex items-center gap-3 mr-10">
            {/* LTP */}
            <div className="flex flex-col items-center bg-gray-800 rounded-lg px-4 py-2 border border-gray-600 min-w-[90px]">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">LTP</span>
              <span className="text-lg font-extrabold text-white font-mono">
                {ltp !== null ? fmt2(ltp) : '—'}
              </span>
            </div>

            {/* Arrow / Direction */}
            {ltpAboveVwap === 'above' && (
              <div className="flex flex-col items-center gap-0.5">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400">ABOVE</span>
              </div>
            )}
            {ltpAboveVwap === 'below' && (
              <div className="flex flex-col items-center gap-0.5">
                <TrendingDown className="h-6 w-6 text-rose-400" />
                <span className="text-[10px] font-bold text-rose-400">BELOW</span>
              </div>
            )}
            {ltpAboveVwap === 'equal' && (
              <div className="flex flex-col items-center gap-0.5">
                <Minus className="h-6 w-6 text-yellow-400" />
                <span className="text-[10px] font-bold text-yellow-400">AT VWAP</span>
              </div>
            )}

            {/* VWAP */}
            <div className="flex flex-col items-center bg-gray-800 rounded-lg px-4 py-2 border border-amber-500/40 min-w-[90px]">
              <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">VWAP</span>
              <span className="text-lg font-extrabold text-amber-300 font-mono">
                {vwap !== null ? fmt2(vwap) : '—'}
              </span>
            </div>

            {/* Diff */}
            {ltp !== null && vwap !== null && (
              <div className="flex flex-col items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-600 min-w-[80px]">
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Diff</span>
                <span className={`text-base font-extrabold font-mono ${ltp > vwap ? 'text-emerald-400' : ltp < vwap ? 'text-rose-400' : 'text-yellow-400'}`}>
                  {ltp > vwap ? '+' : ''}{fmt2(ltp - vwap)}
                </span>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Chart area ── */}
        <div className="flex-1 overflow-auto p-4">
          {candles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 gap-4">
              <div className="h-10 w-10 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
              <div className="text-center">
                <p className="text-gray-300 font-semibold">Waiting for first 30-sec candle</p>
                <p className="text-gray-500 text-sm mt-1">
                  Candles form every 3 NSE fetches (≈ 30 seconds).
                  <br />
                  Keep this window open and data will appear automatically.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex items-center gap-5 text-[11px] text-gray-400 mb-3 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-3 rounded-sm bg-green-500/80 border border-green-500" />
                  Bullish candle (Close ≥ Open)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 h-3 rounded-sm bg-red-500/80 border border-red-500" />
                  Bearish candle (Close &lt; Open)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-8 h-0.5 bg-amber-400 rounded" />
                  VWAP line
                </span>
                <span className="ml-auto text-gray-500 font-mono">
                  {candles.length} candle{candles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Scrollable chart */}
              <div
                ref={chartContainerRef}
                className="overflow-x-auto bg-gray-950 rounded-xl border border-gray-700/60"
              >
                <CandleChart
                  candles={candles}
                  width={CHART_W}
                  height={CHART_H}
                />
              </div>

              {/* Candle table (last 8 rows) */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Recent Candles
                </h4>
                <div className="overflow-x-auto rounded-lg border border-gray-700/60">
                  <table className="w-full text-xs font-mono text-center">
                    <thead className="bg-gray-800 text-gray-300 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2 px-3 text-left">Time</th>
                        <th className="py-2 px-3">Open</th>
                        <th className="py-2 px-3">High</th>
                        <th className="py-2 px-3">Low</th>
                        <th className="py-2 px-3">Close</th>
                        <th className="py-2 px-3 text-amber-400">VWAP</th>
                        <th className="py-2 px-3">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/80">
                      {[...candles].reverse().slice(0, 8).map((c, i) => {
                        const bull = c.close >= c.open;
                        return (
                          <tr key={i} className={i === 0 ? 'bg-gray-800/60' : ''}>
                            <td className="py-1.5 px-3 text-left text-gray-400">{shortTime(c.time)}</td>
                            <td className="py-1.5 px-3 text-gray-200">{fmt2(c.open)}</td>
                            <td className="py-1.5 px-3 text-emerald-400">{fmt2(c.high)}</td>
                            <td className="py-1.5 px-3 text-rose-400">{fmt2(c.low)}</td>
                            <td className={`py-1.5 px-3 font-bold ${bull ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {fmt2(c.close)}
                            </td>
                            <td className="py-1.5 px-3 text-amber-300 font-bold">{fmt2(c.vwap)}</td>
                            <td className="py-1.5 px-3 text-gray-300">
                              {c.volume > 0 ? c.volume.toLocaleString('en-IN') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-2.5 border-t border-gray-700 bg-gray-900/80 rounded-b-2xl shrink-0 flex items-center justify-between text-[11px] text-gray-500">
          <span>Click anywhere outside or press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> to close</span>
          <span>Updates live every 30 sec</span>
        </div>
      </div>
    </div>
  );
};

export default StrikeVwapModal;

