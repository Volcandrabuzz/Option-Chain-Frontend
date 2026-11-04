import React, { useState, useEffect, useRef } from 'react';
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
  Sliders,
  TrendingUp,
  BarChart2,
  Percent,
  Compass,
  Zap
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
}

type MetricType = 'ltp' | 'coi' | 'vol' | 'delta' | 'iv' | 'gamma';

const STRIKE_COLORS = [
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f43f5e', // Rose
  '#38bdf8', // Sky
  '#ec4899', // Pink
  '#eab308', // Yellow
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
}) => {
  const [metric, setMetric] = useState<MetricType>('ltp');
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [data, setData] = useState<MultiStrikeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customStrikeInput, setCustomStrikeInput] = useState<string>('');

  const chartRef = useRef<any>(null);

  const loadData = async () => {
    if (selectedStrikes.length === 0) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchMultiStrike(indexName, selectedStrikes, side, expiry, timeframe);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch multi-strike comparison');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [indexName, selectedStrikes, side, expiry, timeframe]);

  const resetZoom = () => {
    if (chartRef.current?.resetZoom) chartRef.current.resetZoom();
  };

  const handleAddCustomStrike = () => {
    const s = Number(customStrikeInput.trim());
    if (s && !selectedStrikes.includes(s)) {
      onAddStrike(s);
      setCustomStrikeInput('');
    }
  };

  // Quick preset handlers
  const handleApplyAtmOffset = (offset: number) => {
    if (!atmStrike) return;
    const sorted = [...availableStrikes].sort((a, b) => a - b);
    const atmIdx = sorted.findIndex((s) => s === atmStrike);
    if (atmIdx === -1) return;

    const start = Math.max(0, atmIdx - offset);
    const end = Math.min(sorted.length, atmIdx + offset + 1);
    const subset = sorted.slice(start, end);
    subset.forEach((s) => {
      if (!selectedStrikes.includes(s)) onAddStrike(s);
    });
  };

  const exportCSV = () => {
    if (!data || !data.timestamps.length) return;
    const timestamps = data.timestamps;
    const headers = ['Timestamp', ...data.strikes.map((s) => `${s} ${side} (${metric.toUpperCase()})`)];
    const rows = timestamps.map((t, idx) => {
      const row = [t];
      data.strikes.forEach((s) => {
        const seriesData = data.series[String(s)]?.[metric];
        row.push(seriesData && seriesData[idx] !== undefined ? String(seriesData[idx]) : '');
      });
      return row;
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${indexName}_MultiStrike_${metric}_${side}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getMetricTitle = () => {
    switch (metric) {
      case 'ltp':
        return 'Option Last Traded Price (LTP ₹)';
      case 'coi':
        return 'Change in Open Interest (COI)';
      case 'vol':
        return 'Total Traded Volume';
      case 'delta':
        return 'Delta Sensitivity (Δ)';
      case 'iv':
        return 'Implied Volatility (IV %)';
      case 'gamma':
        return 'Gamma Sensitivity (Γ)';
      default:
        return 'Metric';
    }
  };

  // Build Chart.js dataset
  const chartData = {
    labels: data?.timestamps || [],
    datasets: (data?.strikes || []).map((s, idx) => {
      const color = STRIKE_COLORS[idx % STRIKE_COLORS.length];
      const seriesValues = data?.series[String(s)]?.[metric] || [];
      return {
        label: `${s} ${side}`,
        data: seriesValues,
        borderColor: color,
        backgroundColor: `${color}15`,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 5,
      };
    }),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#cbd5e1',
          font: { size: 11, family: 'monospace', weight: 'bold' as const },
        },
      },
      title: {
        display: true,
        text: `Multi-Strike Comparison: ${getMetricTitle()} (${side})`,
        color: '#f8fafc',
        font: { size: 14, weight: 'bold' as const },
      },
      tooltip: {
        backgroundColor: '#090d16',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#60a5fa',
        bodyColor: '#e2e8f0',
        padding: 8,
      },
      zoom: {
        pan: { enabled: true, mode: 'x' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const },
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
      },
      y: {
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        title: {
          display: true,
          text: getMetricTitle(),
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' as const },
        },
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-slate-200 space-y-4">
      {/* Top Header & Strike Selection Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-400" />
            Level 3: Multi-Strike Matrix
          </span>

          {/* Side Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs ml-2">
            <button
              onClick={() => onSelectSide('CE')}
              className={`px-2.5 py-0.5 font-bold rounded ${
                side === 'CE' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-slate-800'
              }`}
            >
              CALLS (CE)
            </button>
            <button
              onClick={() => onSelectSide('PE')}
              className={`px-2.5 py-0.5 font-bold rounded ${
                side === 'PE' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-slate-800'
              }`}
            >
              PUTS (PE)
            </button>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-semibold">Presets:</span>
          <button
            onClick={() => handleApplyAtmOffset(1)}
            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold"
          >
            ATM ± 1
          </button>
          <button
            onClick={() => handleApplyAtmOffset(2)}
            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold"
          >
            ATM ± 2
          </button>
          <button
            onClick={() => handleApplyAtmOffset(3)}
            className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold"
          >
            ATM ± 3
          </button>
        </div>
      </div>

      {/* Selected Strike Chips & Strike Adder */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-400 font-semibold mr-1">Compared Strikes:</span>

        {selectedStrikes.length === 0 ? (
          <span className="text-xs text-slate-500 italic">
            No strikes selected. Pick from the chain below or enter a strike.
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
                <span
                  style={{ backgroundColor: color }}
                  className="w-2 h-2 rounded-full inline-block"
                />
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

        {/* Input to add strike */}
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
      </div>

      {/* Metric Selector Tabs & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
        {/* Metric buttons */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'ltp', label: '📈 LTP', title: 'Last Traded Price' },
            { id: 'coi', label: '📊 Change in OI', title: 'Cumulative Change in OI' },
            { id: 'vol', label: '🌊 Volume', title: 'Total Traded Volume' },
            { id: 'delta', label: '🎯 Delta (Δ)', title: 'Directional Sensitivity' },
            { id: 'iv', label: '📉 IV (%)', title: 'Implied Volatility' },
            { id: 'gamma', label: '⚡ Gamma (Γ)', title: 'Gamma Sensitivity' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id as MetricType)}
              title={m.title}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                metric === m.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Timeframe & Action buttons */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            {['1m', '3m', '5m', '15m', '30m'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 font-bold rounded ${
                  timeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={resetZoom}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-all"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={exportCSV}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-all"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 min-h-[420px] h-[450px]">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold">Synchronizing multi-strike time-series curves...</p>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-rose-400 text-xs">
            {error}
          </div>
        ) : selectedStrikes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <Layers className="w-8 h-8 text-slate-600 mb-2" />
            <p>Select 2 or more strikes from the Level 1 Option Chain to compare them side-by-side.</p>
          </div>
        ) : (
          <Line ref={chartRef} data={chartData} options={chartOptions as any} />
        )}
      </div>
    </div>
  );
};

