/**
 * Paper Trading API Client for Automated F&O Options System.
 * Interacts with /api/paper-trading endpoints.
 */

export interface ActivePosition {
  position_id: string;
  index: string;
  expiry: string;
  strike: number;
  option_type: 'CE' | 'PE';
  symbol: string;
  signal_timestamp: string;
  entry_time: string;
  entry_price: number;
  current_price: number;
  highest_price: number;
  quantity: number;
  lots: number;
  stop_loss: number;
  target: number;
  status: 'OPEN' | 'CLOSED';
  unrealized_pnl: number;
  delta_at_entry?: number;
  gamma_at_entry?: number;
  spread_at_entry?: number;
  ema_5m_at_entry?: number;
  bid_at_entry?: number;
  ask_at_entry?: number;
  bid_qty_at_entry?: number;
  ask_qty_at_entry?: number;
  spread_pct_at_entry?: number;
  liquidity_gate_status?: string;
}

export interface EngineStatus {
  index_name: string;
  state: 'WAITING' | 'CANDIDATE' | 'OPEN' | 'COOLDOWN' | 'DISABLED';
  strategy_enabled: boolean;
  execution_mode: 'INTERNAL_SIMULATOR' | 'MEGABULL_API';
  virtual_capital: number;
  spot_price: number;
  ema_5m: number | null;
  ema_5m_slope: number | null;
  ema_1m: number | null;
  ema_1m_slope: number | null;
  spread: number;
  spread_momentum: number;
  pe_cumulative_change: number;
  ce_cumulative_change: number;
  candidate_signal: 'BUY_CE' | 'BUY_PE' | null;
  confirmation_count: number;
  active_position: ActivePosition | null;
  daily_trades_count: number;
  daily_realized_pnl: number;
  cooldown_remaining_seconds: number;
  timestamp: string;
}

export interface PerformanceSummary {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  net_pnl: number;
  gross_pnl: number;
  profit_factor: number;
  max_drawdown: number;
  avg_holding_time_seconds: number;
}

export interface StrategyConfig {
  config_key: string;
  strategy_enabled: boolean;
  active_index: string;
  execution_mode: 'INTERNAL_SIMULATOR' | 'MEGABULL_API';
  virtual_capital: number;
  risk_per_trade_pct: number;
  initial_sl_pct: number;
  initial_target_pct: number;
  trailing_sl_pct?: number;
  momentum_failure_pct?: number;
  dead_zone_threshold?: number;
  max_simultaneous_positions: number;
  max_daily_loss: number;
  max_daily_trades: number;
  cooldown_seconds: number;
  slippage_pct: number;
  min_spread_threshold: number;
  confirmation_ticks: number;
  trailing_sl_enabled: boolean;
  eod_squareoff_time: string;
}

export interface CompletedTrade {
  trade_id: string;
  position_id: string;
  index: string;
  expiry: string;
  strike: number;
  option_type: 'CE' | 'PE';
  symbol: string;
  signal_timestamp: string;
  entry_timestamp: string;
  exit_timestamp: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  lots: number;
  stop_loss: number;
  target: number;
  exit_reason: string;
  gross_pnl: number;
  net_pnl: number;
  costs: {
    brokerage: number;
    stt: number;
    exchange_charges: number;
    gst: number;
    total_costs: number;
  };
  holding_time_seconds: number;
  execution_mode: string;
  decision_metrics?: {
    spread_at_entry?: number;
    ema_5m_at_entry?: number;
    delta_at_entry?: number;
    gamma_at_entry?: number;
  };
}

export interface BacktestResult {
  success: boolean;
  index_name: string;
  trading_date: string;
  total_ticks_processed: number;
  starting_capital: number;
  ending_capital: number;
  net_pnl: number;
  gross_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  profit_factor: number;
  expectancy: number;
  max_drawdown: number;
  total_crossovers: number;
  false_crossover_rate: number;
  total_slippage_cost: number;
  trades: any[];
  error?: string;
}

export const fetchPaperTradingStatus = async (index?: string): Promise<{ success: boolean; status: EngineStatus; performance: PerformanceSummary }> => {
  const url = new URL('/api/paper-trading/status', window.location.origin);
  if (index) url.searchParams.set('index', index);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
  return res.json();
};

export const sendPaperTradingControl = async (action: string, payload: Record<string, any> = {}): Promise<any> => {
  const res = await fetch('/api/paper-trading/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) throw new Error(`Control action failed: ${res.status}`);
  return res.json();
};

export const fetchPaperTradingConfig = async (): Promise<{ success: boolean; config: StrategyConfig }> => {
  const res = await fetch('/api/paper-trading/config');
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  return res.json();
};

export const updatePaperTradingConfig = async (updates: Partial<StrategyConfig>): Promise<{ success: boolean; config: StrategyConfig }> => {
  const res = await fetch('/api/paper-trading/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Config update failed: ${res.status}`);
  return res.json();
};

export const fetchPaperTradingTrades = async (limit: number = 50): Promise<{ success: boolean; total: number; trades: CompletedTrade[] }> => {
  const res = await fetch(`/api/paper-trading/trades?limit=${limit}`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json();
};

export const runPaperTradingBacktest = async (params: { index: string; trading_date: string; capital?: number; risk_pct?: number; slippage?: number }): Promise<BacktestResult> => {
  const res = await fetch('/api/paper-trading/backtest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error(`Backtest failed: ${res.status}`);
  return res.json();
};

export const fetchMegaBullStatus = async (): Promise<any> => {
  const res = await fetch('/api/paper-trading/megabull-status');
  if (!res.ok) throw new Error(`MegaBull status failed: ${res.status}`);
  return res.json();
};

export interface AllIndicesResponse {
  success: boolean;
  timestamp: string;
  active_display_index: string;
  indices: Record<string, EngineStatus>;
}

export interface EmaCandle {
  time: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_completed: boolean;
  ema_9: number | null;
}

export interface EmaCandlesResponse {
  success: boolean;
  index: string;
  timeframe: string;
  candles: EmaCandle[];
  candles_5m?: EmaCandle[];
  candles_1m?: EmaCandle[];
  diagnostics?: any;
  ema_status: {
    ema_5m: number | null;
    ema_5m_ready: boolean;
    ema_5m_valid: boolean;
    status_5m: string;
    direction_5m: string;
    ema_5m_slope?: number;
    ema_1m: number | null;
    ema_1m_ready: boolean;
    status_1m: string;
    direction_1m: string;
    ema_1m_slope?: number;
  };
}

export interface EmaDiagnosticsResponse {
  success: boolean;
  index: string;
  diagnostics: {
    aggregator_time: string;
    timeframe_5m: any;
    timeframe_1m: any;
  };
}

export interface SignalAuditRecord {
  timestamp: string;
  index: string;
  signal_type?: string;
  candidate_signal?: string;
  all_gates_passed?: boolean;
  decision?: string;
  total_score: number;
  score_threshold?: number;
  component_scores?: Record<string, number>;
  gates: Record<string, boolean>;
  failed_gates?: string[];
  current_underlying?: number;
  underlying?: number;
  spread: number;
  selected_strike?: number;
  selected_side?: string;
  bid?: number | null;
  ask?: number | null;
  bid_qty?: number | null;
  ask_qty?: number | null;
  spread_pct?: number | null;
  lot_size?: number | null;
  liquidity_gate_status?: string;
  pre_exec_rejection?: string;
}

export interface SignalAuditResponse {
  success: boolean;
  index: string;
  total: number;
  audits: SignalAuditRecord[];
}

export const fetchAllIndicesStatus = async (): Promise<AllIndicesResponse> => {
  const res = await fetch('/api/paper-trading/all-indices');
  if (!res.ok) throw new Error(`All indices status failed: ${res.status}`);
  return res.json();
};

export const fetchEmaCandles = async (index: string = 'NIFTY', timeframe: string = '5m'): Promise<EmaCandlesResponse> => {
  const res = await fetch(`/api/paper-trading/ema-candles?index=${encodeURIComponent(index)}&timeframe=${encodeURIComponent(timeframe)}`);
  if (!res.ok) throw new Error(`EMA candles failed: ${res.status}`);
  return res.json();
};

export const fetchEmaDiagnostics = async (index: string = 'NIFTY'): Promise<EmaDiagnosticsResponse> => {
  const res = await fetch(`/api/paper-trading/ema-diagnostics?index=${encodeURIComponent(index)}`);
  if (!res.ok) throw new Error(`EMA diagnostics failed: ${res.status}`);
  return res.json();
};

export const fetchSignalAudit = async (index: string = 'NIFTY', limit: number = 20): Promise<SignalAuditResponse> => {
  const res = await fetch(`/api/paper-trading/signal-audit?index=${encodeURIComponent(index)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Signal audit failed: ${res.status}`);
  return res.json();
};

