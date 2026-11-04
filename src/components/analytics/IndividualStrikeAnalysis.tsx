import React, { useState, useEffect, useRef } from 'react';
import {
  StrikeAnalysisResponse,
  StrikeTimePoint,
  fetchStrikeAnalysis
} from '../../services/analyticsApi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line, Bar } from 'react-chartjs-2';
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  RotateCcw,
  Sliders,
  TrendingUp,
  Activity,
  Layers,
  Percent,
  Compass,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

interface IndividualStrikeAnalysisProps {
  indexName: string;
  strike: number;
  side: 'CE' | 'PE';
  expiry: string;
  onClose?: () => void;
  availableStrikes?: number[];
  onSelectStrike?: (strike: number) => void;
  onSelectSide?: (side: 'CE' | 'PE') => void;
}

type GraphTab =
  | 'ALL'
  | 'LTP_OI'
  | 'LTP_VOL'
  | 'LTP_DELTA'
  | 'LTP_IV'
  | 'OI_VOL'
  | 'DELTA_GAMMA'
  | 'SPOT_LTP';

export const IndividualStrikeAnalysis: React.FC<IndividualStrikeAnalysisProps> = ({
  indexName,
  strike,
  side,
  expiry,
  onClose,
  availableStrikes = [],
  onSelectStrike,
  onSelectSide,
}) => {
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [activeTab, setActiveTab] = useState<GraphTab>('LTP_OI');
  const [data, setData] = useState<StrikeAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // References to charts for reset zoom
  const chartRefs = useRef<{ [key: string]: any }>({});

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchStrikeAnalysis(indexName, strike, side, expiry, timeframe);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load strike time-series data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [indexName, strike, side, expiry, timeframe]);

  const series = data?.series || [];
  const latestPoint = series.length > 0 ? series[series.length - 1] : null;

  const resetAllZooms = () => {
    Object.values(chartRefs.current).forEach((chart) => {
      if (chart?.resetZoom) chart.resetZoom();
    });
  };

  const exportCSV = () => {
    if (!series.length) return;
    const headers = [
      'Timestamp',
      'LTP',
      'OI',
      'Change_in_OI',
      'Interval_OI_Change',
      'Volume',
      'Interval_Volume',
      'Avg_Volume_20',
      'RVOL',
      'Delta',
      'Gamma',
      'Theta',
      'Vega',
      'IV',
      'Underlying_Spot',
    ];
    const rows = series.map((pt) => [
      pt.t,
      pt.ltp,
      pt.oi,
      pt.coi,
      pt.icoi,
      pt.vol,
      pt.ivol,
      pt.avg_volume || 0,
      pt.rvol || 1,
      pt.delta,
      pt.gamma,
      pt.theta,
      pt.vega,
      pt.iv,
      pt.spot,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${indexName}_${strike}_${side}_${expiry}_${timeframe}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Base chart styling
  const labels = series.map((p) => p.t);

  const commonOptions = (title: string, y1Title: string, y2Title?: string) => ({
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
        text: title,
        color: '#f8fafc',
        font: { size: 13, weight: 'bold' as const },
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
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x' as const,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: y1Title,
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' as const },
        },
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
      },
      ...(y2Title
        ? {
            y1: {
              type: 'linear' as const,
              display: true,
              position: 'right' as const,
              title: {
                display: true,
                text: y2Title,
                color: '#f59e0b',
                font: { size: 11, weight: 'bold' as const },
              },
              ticks: { color: '#f59e0b', font: { size: 10 } },
              grid: { drawOnChartArea: false },
            },
          }
        : {}),
    },
  });

  // Graph 1: LTP vs Change in OI (Dual Axis)
  const dataGraph1 = {
    labels,
    datasets: [
      {
        label: `${side} LTP (₹)`,
        data: series.map((p) => p.ltp),
        borderColor: side === 'CE' ? '#10b981' : '#f43f5e',
        backgroundColor: side === 'CE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
        yAxisID: 'y',
        tension: 0.2,
        pointRadius: 2,
      },
      {
        label: 'Change in OI',
        data: series.map((p) => p.coi),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        yAxisID: 'y1',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  // Graph 2: LTP vs Volume (Line + Histogram + RVOL)
  const dataGraph2 = {
    labels,
    datasets: [
      {
        type: 'line' as const,
        label: `${side} LTP (₹)`,
        data: series.map((p) => p.ltp),
        borderColor: '#06b6d4',
        backgroundColor: 'transparent',
        yAxisID: 'y',
        tension: 0.2,
        pointRadius: 2,
      },
      {
        type: 'line' as const,
        label: '20-MA Vol',
        data: series.map((p) => p.avg_volume || 0),
        borderColor: '#f59e0b',
        borderDash: [4, 4],
        backgroundColor: 'transparent',
        yAxisID: 'y1',
        pointRadius: 0,
      },
      {
        type: 'bar' as const,
        label: 'Interval Volume',
        data: series.map((p) => p.ivol),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        yAxisID: 'y1',
      },
    ],
  };

  // Graph 3: LTP vs Delta (Directional Sensitivity)
  const dataGraph3 = {
    labels,
    datasets: [
      {
        label: `${side} LTP (₹)`,
        data: series.map((p) => p.ltp),
        borderColor: '#10b981',
        yAxisID: 'y',
        tension: 0.2,
        pointRadius: 2,
      },
      {
        label: 'Delta (Δ)',
        data: series.map((p) => p.delta),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        yAxisID: 'y1',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  // Graph 4: LTP vs IV (Implied Volatility Expansion / Contraction)
  const dataGraph4 = {
    labels,
    datasets: [
      {
        label: `${side} LTP (₹)`,
        data: series.map((p) => p.ltp),
        borderColor: '#06b6d4',
        yAxisID: 'y',
        tension: 0.2,
        pointRadius: 2,
      },
      {
        label: 'Implied Volatility (IV %)',
        data: series.map((p) => p.iv),
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        yAxisID: 'y1',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  // Graph 5: Interval OI Change vs Interval Volume
  const dataGraph5 = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Interval OI Change (ΔOI)',
        data: series.map((p) => p.icoi),
        backgroundColor: series.map((p) => (p.icoi >= 0 ? '#10b981' : '#f43f5e')),
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Interval Volume',
        data: series.map((p) => p.ivol),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        yAxisID: 'y1',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  // Graph 6: Delta vs Gamma (Second-Order Sensitivity Profile)
  const dataGraph6 = {
    labels,
    datasets: [
      {
        label: 'Delta (Δ)',
        data: series.map((p) => p.delta),
        borderColor: '#8b5cf6',
        yAxisID: 'y',
        tension: 0.2,
        pointRadius: 2,
      },
      {
        label: 'Gamma (Γ)',
        data: series.map((p) => p.gamma),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        yAxisID: 'y1',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  // Graph 7: Underlying Spot vs Option LTP
  const dataGraph7 = {
    labels,
    datasets: [
      {
        label: `${indexName} Spot (₹)`,
        data: series.map((p) => p.spot),
        borderColor: '#38bdf8',
        yAxisID: 'y',
        tension: 0.2,
        pointRadius: 2,
      },
      {
        label: `${strike} ${side} LTP (₹)`,
        data: series.map((p) => p.ltp),
        borderColor: side === 'CE' ? '#10b981' : '#f43f5e',
        backgroundColor: side === 'CE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
        yAxisID: 'y1',
        tension: 0.2,
        pointRadius: 2,
      },
    ],
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col ${
        isFullscreen ? 'fixed inset-2 z-50 overflow-hidden' : 'relative w-full mb-6'
      }`}
    >
      {/* Top Header Bar */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Title & Key Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white tracking-wide">
              {indexName} {strike} {side}
            </span>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
              Exp: {expiry}
            </span>
          </div>

          {/* Quick Strike Switcher if provided */}
          {availableStrikes.length > 0 && onSelectStrike && (
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-xs">
              <span className="text-slate-400">Strike:</span>
              <select
                value={strike}
                onChange={(e) => onSelectStrike(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
              >
                {availableStrikes.map((s) => (
                  <option key={s} value={s} className="bg-slate-900 text-slate-200">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Side Switcher */}
          {onSelectSide && (
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-xs">
              <button
                onClick={() => onSelectSide('CE')}
                className={`px-2 py-0.5 font-bold rounded ${
                  side === 'CE' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-slate-800'
                }`}
              >
                CE
              </button>
              <button
                onClick={() => onSelectSide('PE')}
                className={`px-2 py-0.5 font-bold rounded ${
                  side === 'PE' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-slate-800'
                }`}
              >
                PE
              </button>
            </div>
          )}
        </div>

        {/* Action Controls: Timeframe, Reset Zoom, CSV, Fullscreen, Close */}
        <div className="flex items-center gap-2">
          {/* Timeframe buttons */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            {['1m', '3m', '5m', '15m', '30m'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 font-bold rounded transition-all ${
                  timeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={resetAllZooms}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={exportCSV}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
              title="Close Analysis"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Quantitative Snapshot Bar */}
      {latestPoint && (
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs font-mono">
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">LTP (₹)</span>
            <span className="font-bold text-slate-100">{latestPoint.ltp.toFixed(2)}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Open Interest</span>
            <span className="font-bold text-slate-100">{latestPoint.oi.toLocaleString('en-IN')}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Chg in OI</span>
            <span
              className={`font-bold ${
                latestPoint.coi >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {latestPoint.coi >= 0 ? `+${latestPoint.coi.toLocaleString('en-IN')}` : latestPoint.coi.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Volume / RVOL</span>
            <span className="font-bold text-slate-100">
              {latestPoint.vol.toLocaleString('en-IN')} <span className="text-amber-400">({latestPoint.rvol || 1}x)</span>
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Delta / Gamma</span>
            <span className="font-bold text-slate-100">
              Δ {latestPoint.delta.toFixed(2)} | Γ {latestPoint.gamma.toFixed(5)}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">IV (%) / Vega</span>
            <span className="font-bold text-pink-400">
              {latestPoint.iv.toFixed(1)}% | ν {latestPoint.vega.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Underlying Spot</span>
            <span className="font-bold text-blue-400">{latestPoint.spot.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Tab Navigation for 7 Graphs */}
      <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-950">
        {[
          { id: 'LTP_OI', label: '1. LTP vs Chg OI' },
          { id: 'LTP_VOL', label: '2. LTP vs Volume' },
          { id: 'LTP_DELTA', label: '3. LTP vs Delta' },
          { id: 'LTP_IV', label: '4. LTP vs IV' },
          { id: 'OI_VOL', label: '5. ΔOI vs Volume' },
          { id: 'DELTA_GAMMA', label: '6. Delta vs Gamma' },
          { id: 'SPOT_LTP', label: '7. Spot vs Option LTP' },
          { id: 'ALL', label: '📊 View All 7' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as GraphTab)}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all ${
              activeTab === tab.id
                ? 'bg-slate-900 text-blue-400 border-t-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart Canvas Container */}
      <div className="p-4 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="min-h-[350px] flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold">Generating multi-timeframe analytics series...</p>
          </div>
        ) : error ? (
          <div className="min-h-[350px] flex items-center justify-center text-rose-400 text-xs">
            {error}
          </div>
        ) : series.length === 0 ? (
          <div className="min-h-[350px] flex items-center justify-center text-slate-500 text-xs">
            No time-series data points recorded yet for this strike. Waiting for market updates.
          </div>
        ) : (
          <div className={activeTab === 'ALL' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'w-full'}>
            {/* Graph 1: LTP vs Change in OI */}
            {(activeTab === 'LTP_OI' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Line
                  ref={(ref) => { chartRefs.current['g1'] = ref; }}
                  data={dataGraph1}
                  options={commonOptions('Graph 1: LTP vs Change in OI (Dual Axis)', `${side} LTP (₹)`, 'Change in OI')}
                />
              </div>
            )}

            {/* Graph 2: LTP vs Volume */}
            {(activeTab === 'LTP_VOL' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Line
                  ref={(ref) => { chartRefs.current['g2'] = ref; }}
                  data={dataGraph2}
                  options={commonOptions('Graph 2: LTP vs Volume (Histogram & 20-MA)', `${side} LTP (₹)`, 'Interval Volume')}
                />
              </div>
            )}

            {/* Graph 3: LTP vs Delta */}
            {(activeTab === 'LTP_DELTA' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Line
                  ref={(ref) => { chartRefs.current['g3'] = ref; }}
                  data={dataGraph3}
                  options={commonOptions('Graph 3: LTP vs Delta (Directional Sensitivity)', `${side} LTP (₹)`, 'Delta (Δ)')}
                />
              </div>
            )}

            {/* Graph 4: LTP vs IV */}
            {(activeTab === 'LTP_IV' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Line
                  ref={(ref) => { chartRefs.current['g4'] = ref; }}
                  data={dataGraph4}
                  options={commonOptions('Graph 4: LTP vs IV (Volatility Expansion/Contraction)', `${side} LTP (₹)`, 'Implied Volatility (IV %)')}
                />
              </div>
            )}

            {/* Graph 5: Interval OI Change vs Volume */}
            {(activeTab === 'OI_VOL' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Bar
                  ref={(ref) => { chartRefs.current['g5'] = ref; }}
                  data={dataGraph5 as any}
                  options={commonOptions('Graph 5: Interval OI Change vs Interval Volume', 'Interval ΔOI', 'Interval Volume')}
                />
              </div>
            )}

            {/* Graph 6: Delta vs Gamma */}
            {(activeTab === 'DELTA_GAMMA' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Line
                  ref={(ref) => { chartRefs.current['g6'] = ref; }}
                  data={dataGraph6}
                  options={commonOptions('Graph 6: Delta vs Gamma (Second-Order Sensitivity)', 'Delta (Δ)', 'Gamma (Γ)')}
                />
              </div>
            )}

            {/* Graph 7: Underlying Spot vs Option LTP */}
            {(activeTab === 'SPOT_LTP' || activeTab === 'ALL') && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 min-h-[340px] h-[360px]">
                <Line
                  ref={(ref) => { chartRefs.current['g7'] = ref; }}
                  data={dataGraph7}
                  options={commonOptions(`Graph 7: ${indexName} Spot vs Option LTP`, `${indexName} Spot`, `${side} LTP (₹)`)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

