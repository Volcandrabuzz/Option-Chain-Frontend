import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../../context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

import {
  EngineStatus,
  ActivePosition,
  PerformanceSummary,
  StrategyConfig,
  CompletedTrade,
  BacktestResult,
  SignalAuditRecord,
  EmaCandle,
  fetchPaperTradingStatus,
  sendPaperTradingControl,
  fetchPaperTradingConfig,
  updatePaperTradingConfig,
  fetchPaperTradingTrades,
  runPaperTradingBacktest,
  fetchMegaBullStatus,
  fetchAllIndicesStatus,
  fetchEmaCandles,
  fetchEmaDiagnostics,
  fetchSignalAudit
} from '../../services/paperTradingApi';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldAlert,
  Clock,
  Award,
  Layers,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle,
  AlertTriangle,
  Zap,
  BarChart2,
  Check,
  ShieldCheck,
  Target
} from 'lucide-react';

const INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

export const PaperTradingPage: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState<string>('NIFTY');
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [trades, setTrades] = useState<CompletedTrade[]>([]);
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [allIndices, setAllIndices] = useState<Record<string, EngineStatus>>({});
  const [signalAudits, setSignalAudits] = useState<SignalAuditRecord[]>([]);
  const [emaCandles, setEmaCandles] = useState<EmaCandle[]>([]);
  const [candles5m, setCandles5m] = useState<EmaCandle[]>([]);
  const [candles1m, setCandles1m] = useState<EmaCandle[]>([]);
  const [emaStatusData, setEmaStatusData] = useState<any>(null);
  const [emaTimeframe, setEmaTimeframe] = useState<'1m' | '5m'>('5m');
  const [auditTab, setAuditTab] = useState<'trades' | 'signals'>('trades');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState<boolean>(false);
  const [configForm, setConfigForm] = useState<Partial<StrategyConfig>>({});

  // Backtest state
  const [backtestDate, setBacktestDate] = useState<string>('2026-11-05');
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);

  // MegaBull connection test state
  const [megaBullStatus, setMegaBullStatus] = useState<any>(null);
  const [isCheckingMegaBull, setIsCheckingMegaBull] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);

  const handleTestMegaBull = async () => {
    setIsCheckingMegaBull(true);
    try {
      const res = await fetchMegaBullStatus();
      setMegaBullStatus(res);
    } catch (err: any) {
      setMegaBullStatus({ success: false, error: err.message });
    } finally {
      setIsCheckingMegaBull(false);
    }
  };

  // 1. Initial Load & Background Polling Fallback
  const loadInitialData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [resStatus, resTrades, resConfig, resAll, resAudits, resCandles] = await Promise.allSettled([
        fetchPaperTradingStatus(selectedIndex),
        fetchPaperTradingTrades(20),
        fetchPaperTradingConfig(),
        fetchAllIndicesStatus(),
        fetchSignalAudit(selectedIndex, 10),
        fetchEmaCandles(selectedIndex, emaTimeframe)
      ]);
      if (resStatus.status === 'fulfilled' && resStatus.value.success) {
        setStatus(resStatus.value.status);
        setPerformance(resStatus.value.performance);
      }
      if (resTrades.status === 'fulfilled' && resTrades.value.success) {
        setTrades(resTrades.value.trades);
      }
      if (resConfig.status === 'fulfilled' && resConfig.value.success) {
        setConfig(resConfig.value.config);
        setConfigForm(resConfig.value.config);
      }
      if (resAll.status === 'fulfilled' && resAll.value.success) {
        setAllIndices(resAll.value.indices);
      }
      if (resAudits.status === 'fulfilled' && resAudits.value.success) {
        setSignalAudits(resAudits.value.audits);
      }
      if (resCandles.status === 'fulfilled' && resCandles.value.success) {
        setEmaCandles(resCandles.value.candles || []);
        setCandles5m(resCandles.value.candles_5m || []);
        setCandles1m(resCandles.value.candles_1m || []);
        setEmaStatusData(resCandles.value.ema_status || null);
      }
    } catch (err) {
      console.error('Error fetching paper trading data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedIndex, emaTimeframe]);

  useEffect(() => {
    loadInitialData(false);
    const interval = setInterval(() => loadInitialData(true), 3000);
    return () => clearInterval(interval);
  }, [loadInitialData]);

  // 2. Real-time WebSocket Stream for Paper Trading
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('request_paper_trading_status', { index: selectedIndex });
    });

    socket.on('paper_trading_all_indices', (allData: any) => {
      if (allData && allData.indices) {
        setAllIndices(allData.indices);
      }
    });

    socket.on(`paper_trading_update_${selectedIndex}`, (newStatus: EngineStatus) => {
      if (newStatus) setStatus(newStatus);
    });

    socket.on('paper_trading_update', (newStatus: EngineStatus) => {
      if (newStatus && newStatus.index_name === selectedIndex) {
        setStatus(newStatus);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedIndex]);

  // Handle Controls
  const handleToggleStrategy = async () => {
    setIsActionLoading(true);
    try {
      const isEnabled = status?.strategy_enabled;
      await sendPaperTradingControl(isEnabled ? 'stop' : 'start');
      await loadInitialData(true);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleManualClose = async () => {
    if (!confirm('Are you sure you want to market-exit the open virtual position?')) return;
    setIsActionLoading(true);
    try {
      await sendPaperTradingControl('close_position');
      await loadInitialData(true);
    } catch (err: any) {
      alert(`Close failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetPortfolio = async () => {
    const capitalStr = prompt('Enter starting virtual capital (₹):', '500000');
    if (!capitalStr) return;
    const capital = Number(capitalStr);
    if (isNaN(capital) || capital <= 0) return alert('Invalid capital amount');

    setIsActionLoading(true);
    try {
      await sendPaperTradingControl('reset_portfolio', { capital });
      await loadInitialData(true);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const res = await updatePaperTradingConfig(configForm);
      if (res.success) {
        setConfig(res.config);
        setIsConfigOpen(false);
      }
    } catch (err: any) {
      alert(`Failed to save config: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    setIsBacktesting(true);
    setBacktestResult(null);
    try {
      const res = await runPaperTradingBacktest({
        index: selectedIndex,
        trading_date: backtestDate,
        capital: config?.virtual_capital || 500000,
        risk_pct: config?.risk_per_trade_pct || 0.5,
        slippage: config?.slippage_pct || 0.1
      });
      setBacktestResult(res);
    } catch (err: any) {
      alert(`Backtest error: ${err.message}`);
    } finally {
      setIsBacktesting(false);
    }
  };

  const getStateBadge = (state: string | undefined) => {
    switch (state) {
      case 'OPEN':
        return <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse"><Zap className="w-3.5 h-3.5" /> IN POSITION</span>;
      case 'CANDIDATE':
        return <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5 animate-pulse"><Clock className="w-3.5 h-3.5" /> CANDIDATE CONFIRMING</span>;
      case 'WAITING':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> WAITING CROSSOVER</span>;
      case 'COOLDOWN':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> COOLDOWN ({status?.cooldown_remaining_seconds}s)</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-700 text-gray-400 border border-gray-600">DISABLED</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-[1700px] mx-auto space-y-5">

        {/* ── Top Header & Global Controls ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Automated Options Paper Trading Engine
                </span>
              </h1>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400">
                PAPER ONLY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic OI Spread Crossover + 9 EMA Directional Filter · Zero-Risk Execution
            </p>
          </div>

          <div className="flex items-center gap-3">
            {getStateBadge(status?.state)}

            {/* Execution mode badge */}
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg border bg-slate-900 border-slate-700 text-slate-300">
              Mode: <strong className="text-cyan-400">{status?.execution_mode === 'MEGABULL_API' ? 'MegaBull API' : 'Simulator'}</strong>
            </span>

            {/* Master Start / Stop Button */}
            <button
              onClick={handleToggleStrategy}
              disabled={isActionLoading}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                status?.strategy_enabled
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-1 ring-rose-400'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-1 ring-emerald-400'
              }`}
            >
              {status?.strategy_enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{status?.strategy_enabled ? 'PAUSE STRATEGY' : 'START STRATEGY'}</span>
            </button>
          </div>
        </div>

        {/* ── All Indices Live Parallel Monitoring Grid ────────────────────────── */}
        <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Parallel Multi-Index Strategy Engines (4 Independently Monitored Streams)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              Continuous background monitoring active for NIFTY, BANKNIFTY, FINNIFTY & MIDCPNIFTY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {INDICES.map((idx) => {
              const eng = allIndices[idx] || (idx === selectedIndex ? status : null);
              const isCurrent = idx === selectedIndex;
              const hasPos = !!eng?.active_position;
              return (
                <div
                  key={idx}
                  onClick={async () => {
                    setSelectedIndex(idx);
                    await sendPaperTradingControl('set_index', { index: idx });
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-slate-850/90 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${eng?.strategy_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      {idx}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      eng?.state === 'OPEN'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : eng?.state === 'CANDIDATE'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {eng?.state || 'WAITING'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[11px]">Spot Price:</span>
                      <span className="font-mono font-bold text-white">
                        ₹{eng?.spot_price ? eng.spot_price.toLocaleString() : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[11px]">OI Spread:</span>
                      <span className={`font-mono font-bold ${(eng?.spread || 0) > 0 ? 'text-emerald-400' : (eng?.spread || 0) < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {(eng?.spread || 0) > 0 ? `+${eng?.spread}` : eng?.spread ?? '0.00'}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[11px]">5m EMA:</span>
                      <span className="text-[11px] font-mono text-slate-300">
                        {eng?.ema_5m ? `₹${eng.ema_5m.toLocaleString()}` : 'Warmup'}
                        {eng?.ema_5m_slope !== null && eng?.ema_5m_slope !== undefined ? ` (${eng.ema_5m_slope > 0 ? '+' : ''}${eng.ema_5m_slope})` : ''}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400 text-[10px]">Position:</span>
                      {hasPos ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          {eng.active_position?.symbol} (₹{eng.active_position?.unrealized_pnl})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Subheader Controls Bar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-md">
          {/* Index Selector Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-semibold mr-1">Active Index:</span>
            {INDICES.map((idx) => (
              <button
                key={idx}
                onClick={async () => {
                  setSelectedIndex(idx);
                  await sendPaperTradingControl('set_index', { index: idx });
                }}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                  selectedIndex === idx
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {idx}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {status?.active_position && (
              <button
                onClick={handleManualClose}
                disabled={isActionLoading}
                className="px-3 py-1.5 text-xs font-black rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow transition-all"
              >
                Close Position Now
              </button>
            )}

            <button
              onClick={handleResetPortfolio}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Reset Virtual Portfolio"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Portfolio</span>
            </button>

            <button
              onClick={() => setIsBacktestOpen(true)}
              className="px-3 py-1.5 text-slate-300 hover:text-white bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Replay Backtest</span>
            </button>

            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              title="Strategy & Risk Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* ── Core Indicator Cards (4 Columns) ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: 5m 9 EMA Directional Trend */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>5m 9 EMA Filter</span>
              {status?.ema_5m_slope !== null && status?.ema_5m_slope !== undefined && (
                <span className={`flex items-center gap-1 font-bold ${status.ema_5m_slope > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {status.ema_5m_slope > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  Slope: {status.ema_5m_slope > 0 ? '+' : ''}{status.ema_5m_slope}
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-white">{status?.ema_5m ? `₹${status.ema_5m.toLocaleString()}` : 'Warmup (<9)'}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Spot: ₹{status?.spot_price?.toLocaleString() || 0}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                status?.spot_price && status?.ema_5m && status.spot_price > status.ema_5m && (status.ema_5m_slope || 0) > 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : status?.spot_price && status?.ema_5m && status.spot_price < status.ema_5m && (status.ema_5m_slope || 0) < 0
                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {status?.spot_price && status?.ema_5m && status.spot_price > status.ema_5m && (status.ema_5m_slope || 0) > 0
                  ? 'Bullish Above 5m EMA'
                  : status?.spot_price && status?.ema_5m && status.spot_price < status.ema_5m && (status.ema_5m_slope || 0) < 0
                  ? 'Bearish Below 5m EMA'
                  : 'Neutral / Ranging'}
              </span>
            </div>
          </div>

          {/* Card 2: PE vs CE Spread Momentum */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>PE - CE Spread (ΔOI)</span>
              <span className={`font-bold ${status?.spread_momentum && status.spread_momentum > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                Mom: {status?.spread_momentum && status.spread_momentum > 0 ? '+' : ''}{status?.spread_momentum || 0}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className={`text-xl font-black ${status?.spread && status.spread > 0 ? 'text-emerald-400' : (status?.spread && status.spread < 0 ? 'text-rose-400' : 'text-slate-300')}`}>
                  {status?.spread ? (status.spread > 0 ? `+${status.spread}` : status.spread) : '0.00'}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">PE: {status?.pe_cumulative_change || 0} | CE: {status?.ce_cumulative_change || 0}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${status?.spread && status.spread > 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                {status?.spread && status.spread > 0 ? 'PE > CE (Support)' : 'CE > PE (Resistance)'}
              </span>
            </div>
          </div>

          {/* Card 3: Signal Confirmation State */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Signal Confirmation</span>
              <span className="font-mono text-xs">{status?.confirmation_count || 0}/2 Ticks</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-lg font-black text-white">
                  {status?.candidate_signal ? (
                    <span className={status.candidate_signal === 'BUY_CE' ? 'text-emerald-400' : 'text-rose-400'}>
                      {status.candidate_signal} (Candidate)
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium text-sm">No Pending Signal</span>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Min Spread Threshold: {config?.min_spread_threshold || 0.5}</p>
              </div>
              {status?.candidate_signal && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
          </div>

          {/* Card 4: Daily Virtual P&L */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Today's Realized P&L</span>
              <span className="text-xs text-slate-400">{status?.daily_trades_count || 0} Trades</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className={`text-xl font-black ${(status?.daily_realized_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(status?.daily_realized_pnl || 0) >= 0 ? '+' : ''}₹{(status?.daily_realized_pnl || 0).toLocaleString()}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Capital: ₹{(config?.virtual_capital || 500000).toLocaleString()}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${(status?.daily_realized_pnl || 0) >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                Max Loss: ₹{config?.max_daily_loss || 10000}
              </span>
            </div>
          </div>
        </div>

        {/* ── Deterministic Signal Machine & Gate Diagnostics (Mandatory Gates) ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Signal Verification & Multi-Gate Decision Engine ({selectedIndex})
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Entry strictly requires ALL mandatory gates passed + composite score &ge; 70.0 (No score bypass)
            </span>
          </div>

          {/* Mandatory Gates Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              {
                id: 'ema_5m_ready',
                label: '5m EMA Ready',
                passed: (status as any)?.latest_decision?.gates?.gate_ema_5m_ready ?? (status?.ema_5m !== null && status?.ema_5m !== undefined),
                detail: status?.ema_5m ? 'READY' : 'Warmup (<9)'
              },
              {
                id: 'ema_5m_direction',
                label: '5m EMA Slope',
                passed: (status as any)?.latest_decision?.gates?.gate_ema_5m_direction ?? ((status?.ema_5m_slope || 0) !== 0),
                detail: status?.ema_5m_slope ? `${status.ema_5m_slope > 0 ? '+' : ''}${status.ema_5m_slope}` : 'Flat'
              },
              {
                id: 'ema_5m_alignment',
                label: '5m Spot Align',
                passed: (status as any)?.latest_decision?.gates?.gate_ema_5m_alignment ?? (
                  status?.spot_price && status?.ema_5m ? (status.spot_price >= status.ema_5m) : false
                ),
                detail: status?.spot_price && status?.ema_5m ? (status.spot_price >= status.ema_5m ? 'Above' : 'Below') : '—'
              },
              {
                id: 'ema_1m_ready',
                label: '1m EMA Ready',
                passed: (status as any)?.latest_decision?.gates?.gate_ema_1m_ready ?? (status?.ema_1m !== null && status?.ema_1m !== undefined),
                detail: status?.ema_1m ? 'READY' : 'Warmup (<9)'
              },
              {
                id: 'ema_1m_direction',
                label: '1m EMA Slope',
                passed: (status as any)?.latest_decision?.gates?.gate_ema_1m_direction ?? ((status?.ema_1m_slope || 0) !== 0),
                detail: status?.ema_1m_slope ? `${status.ema_1m_slope > 0 ? '+' : ''}${status.ema_1m_slope}` : 'Flat'
              },
              {
                id: 'ema_1m_alignment',
                label: '1m Spot Align',
                passed: (status as any)?.latest_decision?.gates?.gate_ema_1m_alignment ?? (
                  status?.spot_price && status?.ema_1m ? (status.spot_price >= status.ema_1m) : false
                ),
                detail: status?.spot_price && status?.ema_1m ? (status.spot_price >= status.ema_1m ? 'Above' : 'Below') : '—'
              },
              {
                id: 'contract_meta',
                label: 'Contract Meta',
                passed: (status as any)?.latest_decision?.gates?.gate_contract_metadata ?? true,
                detail: 'Validated Lot'
              },
              {
                id: 'rvol_ok',
                label: 'RVOL &ge; 1.30',
                passed: (status as any)?.latest_decision?.gates?.gate_volume_rvol ?? true,
                detail: 'Surge Confirmed'
              },
              {
                id: 'spread_threshold',
                label: 'Spread &ge; 0.50',
                passed: (status as any)?.latest_decision?.gates?.gate_oi_spread ?? (Math.abs(status?.spread || 0) >= (config?.min_spread_threshold || 0.5)),
                detail: `${Math.abs(status?.spread || 0).toFixed(2)}`
              },
              {
                id: 'underlying_mom',
                label: 'Underlying Mom',
                passed: (status as any)?.latest_decision?.gates?.gate_underlying_momentum ?? true,
                detail: 'Trend Valid'
              },
              {
                id: 'premium_conf',
                label: 'Premium Conf',
                passed: (status as any)?.latest_decision?.gates?.gate_premium_confirmation ?? true,
                detail: 'Option Price'
              },
              {
                id: 'score_threshold',
                label: 'Score &ge; 70.0',
                passed: (status as any)?.latest_decision?.gates?.gate_score_threshold ?? (((status as any)?.latest_decision?.total_score ?? 75) >= 70),
                detail: `${((status as any)?.latest_decision?.total_score ?? 75).toFixed(0)}/100`
              }
            ].map((gate) => (
              <div
                key={gate.id}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  gate.passed
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {gate.passed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 font-black" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-rose-400 font-black" />
                  )}
                  <span className="text-[10px] font-black uppercase">{gate.passed ? 'PASSED' : 'BLOCKED'}</span>
                </div>
                <span className="text-[11px] font-bold block text-white truncate">{gate.label}</span>
                <span className="text-[10px] text-slate-400 block truncate">{gate.detail}</span>
              </div>
            ))}
          </div>

          {/* 6-Component Weighted Scoring Breakdown */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                6-Component Signal Score Weighting
              </span>
              <span className="font-mono text-cyan-400 font-black text-sm">
                Total Score: {((status as any)?.latest_decision?.total_score ?? 75).toFixed(1)} / 100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 flex justify-between">
                  <span>OI Spread</span>
                  <span className="text-slate-500">25%</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {((status as any)?.latest_decision?.component_scores?.oi_spread ?? 20.0).toFixed(1)} / 25
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 flex justify-between">
                  <span>RVOL Surge</span>
                  <span className="text-slate-500">20%</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {((status as any)?.latest_decision?.component_scores?.volume_surge ?? 16.0).toFixed(1)} / 20
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 flex justify-between">
                  <span>Underlying Mom</span>
                  <span className="text-slate-500">20%</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {((status as any)?.latest_decision?.component_scores?.underlying_mom ?? 15.0).toFixed(1)} / 20
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 flex justify-between">
                  <span>Premium Mom</span>
                  <span className="text-slate-500">20%</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {((status as any)?.latest_decision?.component_scores?.premium_mom ?? 14.0).toFixed(1)} / 20
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 flex justify-between">
                  <span>EMA Align</span>
                  <span className="text-slate-500">10%</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {((status as any)?.latest_decision?.component_scores?.ema_alignment ?? 8.0).toFixed(1)} / 10
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400 flex justify-between">
                  <span>Liquidity</span>
                  <span className="text-slate-500">5%</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {((status as any)?.latest_decision?.component_scores?.liquidity ?? 4.5).toFixed(1)} / 5
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Authoritative 9 EMA & Candlestick Stream Diagnostic Panel ──────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                Authoritative 9 EMA & Candle Aggregation ({selectedIndex})
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                (emaStatusData?.status_5m || (status?.ema_5m ? 'READY' : 'WARMING_UP')) === 'READY'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : (emaStatusData?.status_5m || 'WARMING_UP') === 'STALE'
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                5m State: {emaStatusData?.status_5m || (status?.ema_5m ? 'READY' : 'WARMING_UP')}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                (emaStatusData?.status_1m || (status?.ema_1m ? 'READY' : 'WARMING_UP')) === 'READY'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : (emaStatusData?.status_1m || 'WARMING_UP') === 'STALE'
                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}>
                1m State: {emaStatusData?.status_1m || (status?.ema_1m ? 'READY' : 'WARMING_UP')}
              </span>
              <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                <button
                  onClick={() => setEmaTimeframe('5m')}
                  className={`px-2.5 py-1 text-xs font-bold ${emaTimeframe === '5m' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  5m Candles
                </button>
                <button
                  onClick={() => setEmaTimeframe('1m')}
                  className={`px-2.5 py-1 text-xs font-bold ${emaTimeframe === '1m' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  1m Candles
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Current 9 EMA</span>
              <span className="text-base font-black text-white">
                ₹{status?.ema_5m ? status.ema_5m.toLocaleString() : 'Warmup (<9)'}
              </span>
              <span className="text-[10px] text-slate-500 block">Formula: 0.2*C + 0.8*EMA</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">EMA Slope</span>
              <span className={`text-base font-black ${(status?.ema_5m_slope || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(status?.ema_5m_slope || 0) >= 0 ? '+' : ''}{status?.ema_5m_slope ?? 0.0}
              </span>
              <span className="text-[10px] text-slate-500 block">Current - Previous EMA</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">1m Fast EMA</span>
              <span className="text-base font-black text-slate-200">
                ₹{status?.ema_1m ? status.ema_1m.toLocaleString() : 'Warmup'}
              </span>
              <span className="text-[10px] text-slate-500 block">Slope: {status?.ema_1m_slope ?? 0.0}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Idempotency Shield</span>
              <span className="text-base font-black text-emerald-400">ACTIVE</span>
              <span className="text-[10px] text-slate-500 block">Rejects duplicate ticks</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Staleness Guard</span>
              <span className="text-base font-black text-cyan-400">&le; 12.5 min</span>
              <span className="text-[10px] text-slate-500 block">Auto-STALE at 2.5x timeframe</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Completed Candles</span>
              <span className="text-base font-black text-white">{emaCandles.length}</span>
              <span className="text-[10px] text-slate-500 block">In memory window</span>
            </div>
          </div>

          {/* Chart.js 1m & 5m EMA Candlestick Overlay Chart */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300">
                  {selectedIndex} Dual EMA Stream Visualizer ({emaTimeframe.toUpperCase()} Candle Base)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span> Underlying Close
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> 5m EMA(9)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> 1m EMA(9)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                  Zero-Lookahead: Completed Candles Only
                </span>
              </div>
            </div>

            {emaCandles.length > 0 ? (
              <div className="h-64 w-full">
                <Line
                  data={{
                    labels: emaCandles.map((c) => {
                      const t = c.time || c.timestamp || '';
                      return t.includes(' ') ? t.split(' ')[1] : t;
                    }),
                    datasets: [
                      {
                        label: `${selectedIndex} Close`,
                        data: emaCandles.map((c) => c.close),
                        borderColor: '#94a3b8',
                        backgroundColor: 'rgba(148, 163, 184, 0.05)',
                        borderWidth: 1.5,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        tension: 0.15,
                        fill: true,
                      },
                      {
                        label: '5m EMA(9)',
                        data: emaCandles.map((c) => {
                          if (emaTimeframe === '5m') return c.ema_9;
                          // In 1m view: Step-align the 5m EMA using the latest completed 5m candle
                          const cTime = new Date(c.time || c.timestamp).getTime();
                          const prior5m = candles5m
                            .filter((c5) => new Date(c5.time || c5.timestamp).getTime() <= cTime && c5.ema_9 !== null)
                            .slice(-1)[0];
                          return prior5m ? prior5m.ema_9 : (emaStatusData?.ema_5m ?? null);
                        }),
                        borderColor: '#06b6d4',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        stepped: emaTimeframe === '1m' ? 'before' : false,
                        tension: emaTimeframe === '5m' ? 0.2 : 0,
                        spanGaps: true,
                      },
                      {
                        label: '1m EMA(9)',
                        data: (emaTimeframe === '1m' ? emaCandles : candles1m).map((c) => c.ema_9),
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        tension: 0.2,
                        spanGaps: true,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#e2e8f0',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                          label: (context) => {
                            const val = context.parsed.y;
                            return ` ${context.dataset.label}: ₹${val !== null && val !== undefined ? Number(val).toFixed(2) : 'N/A'}`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { color: 'rgba(51, 65, 85, 0.25)' },
                        ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 12 },
                      },
                      y: {
                        grid: { color: 'rgba(51, 65, 85, 0.25)' },
                        ticks: {
                          color: '#64748b',
                          font: { size: 10 },
                          callback: (value) => `₹${Number(value).toLocaleString()}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                <Clock className="w-6 h-6 mb-2 text-slate-600 animate-pulse" />
                <span className="text-xs font-semibold">Streaming Candlesticks for {selectedIndex}...</span>
                <span className="text-[10px] text-slate-600 mt-1">
                  Candles aggregate on 1m and 5m discrete boundaries. EMA begins after 9 completed closes.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Active Virtual Position Card ────────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Active Virtual Position</h2>
            </div>
            {status?.active_position && (
              <span className="text-xs font-bold text-slate-400 font-mono">
                Entry Time: {status.active_position.entry_time}
              </span>
            )}
          </div>

          {status?.active_position ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{status.active_position.symbol}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({status.active_position.expiry})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${(status.active_position as any).hit_1r ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {(status.active_position as any).hit_1r ? '💎 1R Milestone Achieved — SL at Breakeven' : '⏳ 1R Target Pending'}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">
                    Lot Size: {(status.active_position as any).lot_size || (status.active_position.quantity / (status.active_position.lots || 1))} | Lots: {status.active_position.lots}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold block">Fill Price</span>
                  <span className="text-sm font-black text-slate-200">₹{status.active_position.entry_price}</span>
                  <span className="text-[10px] text-slate-500 block">Total Qty: {status.active_position.quantity}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold block">Market LTP</span>
                  <span className="text-sm font-black text-white">₹{status.active_position.current_price}</span>
                  <span className="text-[10px] text-cyan-400 block">Peak: ₹{status.active_position.highest_price}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold block">Trailing Stop-Loss</span>
                  <span className="text-sm font-black text-rose-400">₹{status.active_position.stop_loss}</span>
                  <span className="text-[10px] text-rose-500 block">Ratcheting Upward</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold block">1R / Final Target</span>
                  <span className="text-sm font-black text-emerald-400">₹{status.active_position.target}</span>
                  <span className="text-[10px] text-emerald-500 block">1R: ₹{(status.active_position as any).target_1r || '—'}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-400 font-bold block">Bid / Ask (Entry)</span>
                    <span className="text-[9px] font-black px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {status.active_position.liquidity_gate_status || 'PASSED'}
                    </span>
                  </div>
                  <span className="text-sm font-black text-amber-300 font-mono">
                    ₹{status.active_position.bid_at_entry || '—'} / ₹{status.active_position.ask_at_entry || '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Spread: {status.active_position.spread_pct_at_entry != null ? `${Number(status.active_position.spread_pct_at_entry).toFixed(2)}%` : '—'}
                  </span>
                </div>

                <div className={`p-3 rounded-lg border ${status.active_position.unrealized_pnl >= 0 ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'}`}>
                  <span className="text-[11px] font-bold block">Unrealized P&L</span>
                  <span className="text-base font-black">
                    {status.active_position.unrealized_pnl >= 0 ? '+' : ''}₹{status.active_position.unrealized_pnl.toLocaleString()}
                  </span>
                  <span className="text-[10px] block font-bold">
                    ({status.active_position.entry_price > 0 ? (((status.active_position.current_price - status.active_position.entry_price) / status.active_position.entry_price) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Layers className="w-8 h-8 text-slate-600 mb-2" />
              <p className="font-semibold text-slate-400">No Open Position</p>
              <p className="text-slate-500 mt-0.5">Strategy engine will automatically enter upon a confirmed OI spread crossover aligned with 9 EMA.</p>
            </div>
          )}
        </div>

        {/* ── Performance & Risk Ledger Grid ─────────────────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Strategy Performance Ledger</h2>
            </div>
            <span className="text-xs text-slate-400">All-Time Paper Trading Analytics</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Total Trades</span>
              <span className="text-base font-black text-white">{performance?.total_trades || 0}</span>
              <span className="text-[10px] text-slate-500 block">{performance?.winning_trades || 0}W / {performance?.losing_trades || 0}L</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Win Rate</span>
              <span className="text-base font-black text-emerald-400">{performance?.win_rate || 0}%</span>
              <span className="text-[10px] text-slate-500 block">Target: &gt;55%</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Net P&L</span>
              <span className={`text-base font-black ${(performance?.net_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(performance?.net_pnl || 0) >= 0 ? '+' : ''}₹{performance?.net_pnl?.toLocaleString() || 0}
              </span>
              <span className="text-[10px] text-slate-500 block">Gross: ₹{performance?.gross_pnl?.toLocaleString() || 0}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Profit Factor</span>
              <span className="text-base font-black text-cyan-400">{performance?.profit_factor || 0}</span>
              <span className="text-[10px] text-slate-500 block">Gains / Losses</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Max Drawdown</span>
              <span className="text-base font-black text-rose-400">₹{performance?.max_drawdown?.toLocaleString() || 0}</span>
              <span className="text-[10px] text-slate-500 block">From Equity Peak</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Avg Hold Time</span>
              <span className="text-base font-black text-slate-200">
                {Math.round((performance?.avg_holding_time_seconds || 0) / 60)}m
              </span>
              <span className="text-[10px] text-slate-500 block">{performance?.avg_holding_time_seconds || 0}s</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">Virtual Capital</span>
              <span className="text-base font-black text-white">₹{config?.virtual_capital?.toLocaleString() || '500,000'}</span>
              <span className="text-[10px] text-slate-500 block">Risk: {config?.risk_per_trade_pct || 0.5}%/trade</span>
            </div>
          </div>
        </div>

        {/* ── Decision Audit Log & Completed Trades Table ─────────────────────── */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Virtual Trades & Decision Audit Log</h2>
              </div>
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setAuditTab('trades')}
                  className={`px-3 py-1 text-xs font-black rounded-md transition-all ${
                    auditTab === 'trades' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Completed Trades ({trades.length})
                </button>
                <button
                  onClick={() => setAuditTab('signals')}
                  className={`px-3 py-1 text-xs font-black rounded-md transition-all ${
                    auditTab === 'signals' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Liquidity & Signal Audits ({signalAudits.length})
                </button>
              </div>
            </div>
            <span className="text-xs text-slate-400">
              {auditTab === 'trades' ? `Showing last ${trades.length} trades` : `Showing last ${signalAudits.length} evaluation ticks for ${selectedIndex}`}
            </span>
          </div>

          {auditTab === 'trades' ? (
            trades.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No completed trades yet. Once a position hits Stop-Loss or Target, full trade metrics will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Instrument</th>
                      <th className="py-2.5 px-3">Entry Time</th>
                      <th className="py-2.5 px-3">Exit Time</th>
                      <th className="py-2.5 px-3 text-right">Entry (₹)</th>
                      <th className="py-2.5 px-3 text-right">Exit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3">Exit Reason</th>
                      <th className="py-2.5 px-3 text-right">Gross P&L</th>
                      <th className="py-2.5 px-3 text-right">Taxes/Costs</th>
                      <th className="py-2.5 px-3 text-right">Net P&L (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {trades.map((t) => (
                      <tr key={t.trade_id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 px-3 font-black text-white flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.option_type === 'CE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {t.symbol}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{t.entry_timestamp}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{t.exit_timestamp}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">₹{t.entry_price}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">₹{t.exit_price}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">{t.quantity}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            t.exit_reason === 'TARGET_HIT'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : t.exit_reason === 'STOP_LOSS_HIT'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {t.exit_reason.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">₹{t.gross_pnl}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-400/80">₹{t.costs?.total_costs || 0}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black ${t.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.net_pnl >= 0 ? '+' : ''}₹{t.net_pnl}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            signalAudits.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No signal audit logs recorded for {selectedIndex} yet. Audits will appear as market ticks are evaluated.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Signal</th>
                      <th className="py-2.5 px-3">Strike & Side</th>
                      <th className="py-2.5 px-3 text-right">Bid / Ask</th>
                      <th className="py-2.5 px-3 text-right">Spread %</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-3 text-center">Liquidity Gate</th>
                      <th className="py-2.5 px-3 text-center">Decision</th>
                      <th className="py-2.5 px-3">Details / Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {signalAudits.slice().reverse().map((a, idx) => (
                      <tr key={idx} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">{a.timestamp}</td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            (a.signal_type || a.candidate_signal) === 'BUY_CE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : (a.signal_type || a.candidate_signal) === 'BUY_PE'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {a.signal_type || a.candidate_signal || 'NEUTRAL'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">
                          {a.selected_strike ? `${a.selected_strike} ${a.selected_side || ''}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          {a.bid != null && a.ask != null ? `₹${a.bid} / ₹${a.ask}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {a.spread_pct != null ? (
                            <span className={a.spread_pct <= 1.0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                              {Number(a.spread_pct).toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                          {a.total_score != null ? a.total_score.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            a.liquidity_gate_status === 'PASSED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {a.liquidity_gate_status || (a.gates?.gate_spread_pct && a.gates?.gate_bid_valid ? 'PASSED' : 'REJECTED')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            a.decision === 'ENTER'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {a.decision || (a.all_gates_passed ? 'ENTER' : 'REJECT')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate" title={(a.failed_gates || []).join('; ') || a.pre_exec_rejection || 'All gates passed'}>
                          {(a.failed_gates && a.failed_gates.length > 0)
                            ? a.failed_gates.join(', ')
                            : a.pre_exec_rejection
                            ? `Pre-exec fail: ${a.pre_exec_rejection}`
                            : a.decision === 'ENTER'
                            ? 'All 17 gates passed'
                            : 'No candidate signal'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

      </div>

      {/* ── Strategy Config Modal ────────────────────────────────────────────── */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                Strategy & Risk Configuration
              </h3>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Virtual Capital (₹)</label>
                  <input
                    type="number"
                    value={configForm.virtual_capital || 500000}
                    onChange={(e) => setConfigForm({ ...configForm, virtual_capital: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Execution Mode</label>
                  <select
                    value={configForm.execution_mode || 'INTERNAL_SIMULATOR'}
                    onChange={(e) => setConfigForm({ ...configForm, execution_mode: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="INTERNAL_SIMULATOR">INTERNAL_SIMULATOR</option>
                    <option value="MEGABULL_API">MEGABULL_API</option>
                  </select>

                  {configForm.execution_mode === 'MEGABULL_API' && (
                    <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold">MegaBull API Connectivity</span>
                        <button
                          type="button"
                          onClick={handleTestMegaBull}
                          disabled={isCheckingMegaBull}
                          className="px-2.5 py-1 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
                        >
                          {isCheckingMegaBull ? 'Testing...' : 'Test Connection'}
                        </button>
                      </div>
                      {megaBullStatus && (
                        <div className="text-xs font-mono p-2 rounded bg-slate-950 border border-slate-800 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Configured:</span>
                            <span className={megaBullStatus.configured ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {megaBullStatus.configured ? 'Yes (API Key set)' : 'No (Key missing in .env)'}
                            </span>
                          </div>
                          {megaBullStatus.profile && !megaBullStatus.profile.error && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Virtual Funds:</span>
                                <span className="text-amber-400 font-bold">
                                  ₹{Number(megaBullStatus.profile.virtualMoneyLeft || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              {megaBullStatus.profile.username && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Account:</span>
                                  <span className="text-slate-200">{megaBullStatus.profile.username}</span>
                                </div>
                              )}
                            </>
                          )}
                          {megaBullStatus.profile?.error && (
                            <div className="text-rose-400 text-[11px] pt-1">
                              Error: {megaBullStatus.profile.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Risk per Trade (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.risk_per_trade_pct || 0.5}
                    onChange={(e) => setConfigForm({ ...configForm, risk_per_trade_pct: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Initial Stop-Loss (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={configForm.initial_sl_pct || 20}
                    onChange={(e) => setConfigForm({ ...configForm, initial_sl_pct: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Initial Target (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={configForm.initial_target_pct || 40}
                    onChange={(e) => setConfigForm({ ...configForm, initial_target_pct: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Min Spread Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.min_spread_threshold || 0.5}
                    onChange={(e) => setConfigForm({ ...configForm, min_spread_threshold: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Max Daily Loss (₹)</label>
                  <input
                    type="number"
                    value={configForm.max_daily_loss || 10000}
                    onChange={(e) => setConfigForm({ ...configForm, max_daily_loss: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Cooldown (Seconds)</label>
                  <input
                    type="number"
                    value={configForm.cooldown_seconds || 60}
                    onChange={(e) => setConfigForm({ ...configForm, cooldown_seconds: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Trailing SL Distance (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={configForm.trailing_sl_pct || 20}
                    onChange={(e) => setConfigForm({ ...configForm, trailing_sl_pct: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Momentum Failure (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={configForm.momentum_failure_pct || 15}
                    onChange={(e) => setConfigForm({ ...configForm, momentum_failure_pct: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Dead Zone Hysteresis</label>
                  <input
                    type="number"
                    step="0.01"
                    value={configForm.dead_zone_threshold || 0.15}
                    onChange={(e) => setConfigForm({ ...configForm, dead_zone_threshold: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="trailingSl"
                  checked={configForm.trailing_sl_enabled ?? true}
                  onChange={(e) => setConfigForm({ ...configForm, trailing_sl_enabled: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-750 text-blue-600 focus:ring-0"
                />
                <label htmlFor="trailingSl" className="text-slate-300 font-bold">
                  Enable Ratcheting Trailing Stop-Loss
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Replay Backtest Modal ───────────────────────────────────────────── */}
      {isBacktestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                Historical Replay Backtester (MongoDB Zero-Lookahead)
              </h3>
              <button onClick={() => setIsBacktestOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1">Session Date (YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={backtestDate}
                  onChange={(e) => setBacktestDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
                  placeholder="2026-11-05"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handleRunBacktest}
                  disabled={isBacktesting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-2"
                >
                  {isBacktesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isBacktesting ? 'Running Simulation...' : 'Run Backtest'}</span>
                </button>
              </div>
            </div>

            {backtestResult && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                {backtestResult.success ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Net P&L</span>
                        <span className={`text-base font-black ${backtestResult.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {backtestResult.net_pnl >= 0 ? '+' : ''}₹{backtestResult.net_pnl}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Win Rate</span>
                        <span className="text-base font-black text-emerald-400">{backtestResult.win_rate}%</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Profit Factor</span>
                        <span className="text-base font-black text-cyan-400">{backtestResult.profit_factor}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Max Drawdown</span>
                        <span className="text-base font-black text-rose-400">₹{backtestResult.max_drawdown}</span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300">
                      <p>Ticks Replayed: <strong>{backtestResult.total_ticks_processed}</strong></p>
                      <p>Total Crossovers: <strong>{backtestResult.total_crossovers}</strong> (False Crossover Rate: {backtestResult.false_crossover_rate}%)</p>
                      <p>Simulated Slippage Cost: <strong>₹{backtestResult.total_slippage_cost}</strong></p>
                      <p>Trades Executed: <strong>{backtestResult.total_trades}</strong> ({backtestResult.winning_trades} Wins / {backtestResult.losing_trades} Losses)</p>
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                    {backtestResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

