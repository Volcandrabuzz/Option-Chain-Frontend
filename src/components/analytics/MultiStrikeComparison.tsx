import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MultiStrikeResponse,
  fetchMultiStrike
} from '../../services/analyticsApi';
import { Line } from 'react-chartjs-2';
import {
  Layers,
  Plus,
  X,
  RotateCcw,
  Download,
  LayoutGrid,
  Square
} from 'lucide-react';

interface MultiStrikeComparisonProps {
  indexName: string;
  selectedStrikes: number[];
  onRemoveStrike: (strike: number) => void;
  onAddStrike: (strike: number) => void;
  availableStrikes: number[];
  expiry: string;
  side: 'CE' | 'PE';
  onSelectSide: (side: 'CE' | 'PE') => void;
  atmStrike?: number;
  onReplaceStrikes: (strikes: number[]) => void;
}

type MetricType = 'ltp' | 'coi' | 'vol' | 'delta' | 'iv' | 'gamma';
type ViewMode = 'single' | 'all-graphs';

const STRIKE_COLORS = [
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f43f5e', // Rose
  '#38bdf8', // Sky
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#a3e635', // Lime
  '#fb923c', // Orange
  '#818cf8', // Indigo
  '#34d399', // Green
];

const ALL_METRICS: { id: MetricType; label: string; shortLabel: string; color: string }[] = [
  { id: 'ltp',   label: 'Last Traded Price (LTP ₹)',      shortLabel: '📈 LTP',         color: '#60a5fa' },
  { id: 'coi',   label: 'Change in Open Interest (COI)',   shortLabel: '📊 Change OI',   color: '#34d399' },
  { id: 'vol',   label: 'Total Traded Volume',             shortLabel: '🌊 Volume',      color: '#a78bfa' },
  { id: 'delta', label: 'Delta Sensitivity (Δ)',           shortLabel: '🎯 Delta',       color: '#fbbf24' },
  { id: 'iv',    label: 'Implied Volatility (IV %)',       shortLabel: '📉 IV %',        color: '#f87171' },
  { id: 'gamma', label: 'Gamma Sensitivity (Γ)',           shortLabel: '⚡ Gamma',       color: '#38bdf8' },
];

export const MultiStrikeComparison: React.FC<MultiStrikeComparisonProps> = ({
  indexName,
  selectedStrikes,
  onRemoveStrike,
  onAddStrike,
  availableStrikes,
  expiry,
  side,
  onSelectSide,
  atmStrike,
  onReplaceStrikes,
}) => {
  const [metric, setMetric] = useState<MetricType>('ltp');
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [data, setData] = useState<MultiStrikeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customStrikeInput, setCustomStrikeInput] = useState<string>('');

  const chartRef = useRef<any>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Keep charts readable and requests bounded: 10 ITM + ATM + 10 OTM.
  const MAX_STRIKES = 21;

  const loadData = useCallback(async (silent = false) => {
    if (selectedStrikes.length === 0) { setData(null); return; }
    if (!silent) setIsLoading(true);
    setError(null);
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const requestId = ++requestIdRef.current;
    try {
      const res = await fetchMultiStrike(indexName, selectedStrikes, side, expiry, timeframe, controller.signal);
      if (requestId === requestIdRef.current) setData(res);
    } catch (err: any) {
      if (err.name !== 'AbortError' && requestId === requestIdRef.current && !silent) {
        setError(err.message || 'Failed to fetch multi-strike comparison');
      }
    } finally {
      if (!silent && requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [expiry, indexName, selectedStrikes, side, timeframe]);

  useEffect(() => {
    loadData(false);
    const interval = setInterval(() => loadData(true), 5000);
    return () => {
      clearInterval(interval);
      requestAbortRef.current?.abort();
    };
  }, [loadData]);

  const resetZoom = () => { if (chartRef.current?.resetZoom) chartRef.current.resetZoom(); };

  const handleAddCustomStrike = () => {
    const s = Number(customStrikeInput.trim());
    if (s && !selectedStrikes.includes(s) && selectedStrikes.length < MAX_STRIKES) {
      onAddStrike(s);
      setCustomStrikeInput('');
    }
  };

  // ── Preset handlers ──────────────────────────────────────────────────────────
  const handleApplyAtmOffset = (offset: number) => {
    if (!atmStrike) return;
    const sorted = [...availableStrikes].sort((a, b) => a - b);
    const atmIdx = sorted.findIndex((s) => s === atmStrike);
    if (atmIdx === -1) return;

    const start = Math.max(0, atmIdx - offset);
    const end = Math.min(sorted.length, atmIdx + offset + 1);
    // One parent state update avoids a render/request for every strike.
    onReplaceStrikes(sorted.slice(start, end));
  };

  // ── CSV export ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data || !data.timestamps.length) return;
    const metricsToExport = viewMode === 'all-graphs' ? ALL_METRICS.map(m => m.id) : [metric];
    const headers = ['Timestamp', ...data.strikes.flatMap((s) =>
      metricsToExport.map((m) => `${s} ${side} (${m.toUpperCase()})`)
    )];
    const rows = data.timestamps.map((t, idx) => {
      const row = [t];
      data.strikes.forEach((s) => {
        metricsToExport.forEach((m) => {
          const val = data.series[String(s)]?.[m as MetricType]?.[idx];
          row.push(val !== undefined && val !== null ? String(val) : '');
        });
      });
      return row;
    });
    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${indexName}_MultiStrike_${side}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Chart builders ───────────────────────────────────────────────────────────
  const buildDatasets = (m: MetricType) =>
    (data?.strikes || []).map((s, idx) => {
      const color = STRIKE_COLORS[idx % STRIKE_COLORS.length];
      return {
        label: `${s} ${side}`,
        data: data?.series[String(s)]?.[m] || [],
        borderColor: color,
        backgroundColor: `${color}18`,
        tension: 0.2,
        pointRadius: 1,
        pointHoverRadius: 4,
        borderWidth: 1.5,
      };
    });

  const buildOptions = (title: string, yLabel: string, compact = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: !compact,
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          font: { size: compact ? 9 : 11, family: 'monospace', weight: 'bold' as const },
          boxWidth: compact ? 10 : 14,
          padding: compact ? 6 : 10,
        },
      },
      title: {
        display: true,
        text: title,
        color: '#f8fafc',
        font: { size: compact ? 11 : 13, weight: 'bold' as const },
        padding: { bottom: compact ? 4 : 8 },
      },
      tooltip: {
        backgroundColor: '#090d16',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#60a5fa',
        bodyColor: '#e2e8f0',
        padding: 6,
      },
      zoom: {
        pan: { enabled: !compact, mode: 'x' as const },
        zoom: { wheel: { enabled: !compact }, pinch: { enabled: !compact }, mode: 'x' as const },
      },
    },
    scales: {
      x: {
        // Match the strike deep-dive charts so Chart.js can auto-skip labels
        // at a readable density instead of forcing rotated/truncated timestamps.
        ticks: compact
          ? { color: '#64748b', font: { size: 8 }, maxTicksLimit: 6 }
          : { color: '#64748b', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
      },
      y: {
        ticks: { color: '#94a3b8', font: { size: compact ? 8 : 10 }, maxTicksLimit: compact ? 5 : 8 },
        grid: { color: 'rgba(51,65,85,0.2)' },
        title: {
          display: !compact,
          text: yLabel,
          color: '#94a3b8',
          font: { size: 10, weight: 'bold' as const },
        },
      },
    },
  });

  // ── Empty / loading states ───────────────────────────────────────────────────
  const isEmpty = selectedStrikes.length === 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-slate-200 space-y-4">

      {/* ── Header row ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-400" />
            Level 3: Multi-Strike Matrix
          </span>

          {/* CE / PE toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs ml-2">
            <button
              onClick={() => onSelectSide('CE')}
              className={`px-2.5 py-0.5 font-bold rounded ${side === 'CE' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-slate-800'}`}
            >
              CALLS (CE)
            </button>
            <button
              onClick={() => onSelectSide('PE')}
              className={`px-2.5 py-0.5 font-bold rounded ${side === 'PE' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-slate-800'}`}
            >
              PUTS (PE)
            </button>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('single')}
            title="One chart for selected metric"
            className={`flex items-center gap-1 px-2.5 py-1 font-bold rounded transition-all ${viewMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Square className="w-3 h-3" />
            Single Chart
          </button>
          <button
            onClick={() => setViewMode('all-graphs')}
            title="Show all 6 metrics simultaneously"
            className={`flex items-center gap-1 px-2.5 py-1 font-bold rounded transition-all ${viewMode === 'all-graphs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <LayoutGrid className="w-3 h-3" />
            All Graphs
          </button>
        </div>
      </div>

      {/* ── Strike preset row ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-400 font-semibold shrink-0">Quick Select:</span>

        {[
          { label: 'ATM ± 1', val: 1 },
          { label: 'ATM ± 2', val: 2 },
          { label: 'ATM ± 3', val: 3 },
          { label: 'ATM ± 5', val: 5 },
          { label: 'ATM ± 10', val: 10 },
        ].map(({ label, val }) => (
          <button
            key={val}
            onClick={() => handleApplyAtmOffset(val)}
            disabled={!atmStrike}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {label}
          </button>
        ))}

        {selectedStrikes.length > 0 && (
          <button
            onClick={() => onReplaceStrikes([])}
            className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 rounded text-xs text-rose-300 font-bold ml-auto transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* ── Selected strike chips + add input ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-400 font-semibold mr-1 shrink-0">
          Compared Strikes ({selectedStrikes.length}/{MAX_STRIKES}; max 10 ITM + ATM + 10 OTM):
        </span>

        {selectedStrikes.length === 0 ? (
          <span className="text-xs text-slate-500 italic">
            No strikes selected. Use presets above or enter a strike number.
          </span>
        ) : (
          selectedStrikes.map((s, idx) => {
            const color = STRIKE_COLORS[idx % STRIKE_COLORS.length];
            return (
              <span
                key={s}
                style={{ borderColor: color, color }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-black rounded-lg border bg-slate-900 shadow-sm"
              >
                <span style={{ backgroundColor: color }} className="w-2 h-2 rounded-full inline-block" />
                {s} {side}
                <button
                  onClick={() => onRemoveStrike(s)}
                  className="hover:text-white transition-colors ml-0.5"
                  title="Remove strike"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}

        {/* Add custom strike input */}
        {selectedStrikes.length < MAX_STRIKES && (
          <div className="flex items-center gap-1 ml-auto">
            <input
              type="number"
              placeholder="Add Strike..."
              value={customStrikeInput}
              onChange={(e) => setCustomStrikeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomStrike()}
              className="w-28 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAddCustomStrike}
              className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              title="Add Strike"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Controls: metric tabs + timeframe + actions ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
        {/* Metric tabs — only relevant in single-chart mode */}
        <div className="flex flex-wrap items-center gap-1">
          {viewMode === 'all-graphs' ? (
            <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5" /> Showing all 6 metrics simultaneously
            </span>
          ) : (
            ALL_METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                  metric === m.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {m.shortLabel}
              </button>
            ))
          )}
        </div>

        {/* Timeframe + action buttons */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            {['1m', '3m', '5m', '15m', '30m'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 font-bold rounded ${timeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tf}
              </button>
            ))}
          </div>

          {viewMode === 'single' && (
            <button
              onClick={resetZoom}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-all"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={exportCSV}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-all"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Chart area ───────────────────────────────────────────────────────── */}
      {isLoading && !data ? (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-[420px] flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold">Synchronizing multi-strike time-series curves...</p>
        </div>
      ) : error ? (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-40 flex items-center justify-center text-rose-400 text-xs">
          {error}
        </div>
      ) : isEmpty ? (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-[420px] flex flex-col items-center justify-center text-slate-500 text-xs">
          <Layers className="w-8 h-8 text-slate-600 mb-2" />
          <p>Select 2 or more strikes using presets above or the Level 1 chain checkboxes.</p>
        </div>
      ) : viewMode === 'single' ? (
        /* ── Single chart ── */
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-[460px] relative">
          {isLoading && (
            <span className="absolute right-3 top-3 z-10 rounded bg-slate-900/90 border border-slate-700 px-2 py-1 text-[10px] font-semibold text-blue-300">
              Updating chart…
            </span>
          )}
          <Line
            ref={chartRef}
            data={{
              labels: data?.timestamps || [],
              datasets: buildDatasets(metric),
            }}
            options={buildOptions(
              `Multi-Strike: ${ALL_METRICS.find(m => m.id === metric)?.label} (${side})`,
              ALL_METRICS.find(m => m.id === metric)?.label || '',
              false
            ) as any}
          />
        </div>
      ) : (
        /* ── All-graphs grid (2 × 3) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ALL_METRICS.map((m) => (
            <div
              key={m.id}
              className="bg-slate-950 p-3 rounded-xl border border-slate-800 h-[280px] relative group"
            >
              {/* Click to expand to single-chart mode for this metric */}
              <button
                onClick={() => { setMetric(m.id); setViewMode('single'); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 hover:text-blue-400 font-bold bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded z-10"
                title="Expand this chart"
              >
                Expand ↗
              </button>
              <Line
                data={{
                  labels: data?.timestamps || [],
                  datasets: buildDatasets(m.id),
                }}
                options={buildOptions(m.shortLabel, m.shortLabel, true) as any}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
