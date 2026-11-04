/**
 * Analytics API Client for F&O Multi-Strike Dashboard.
 * Interacts with /api/analytics endpoints.
 */

export interface OptionMetrics {
  ltp: number;
  change: number;
  p_change: number;
  open_interest: number;
  change_oi: number;
  pchange_oi: number;
  volume: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  bid: number;
  ask: number;
  bid_qty: number;
  ask_qty: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
}

export interface StrikeRow {
  strike: number;
  is_atm: boolean;
  ce: OptionMetrics;
  pe: OptionMetrics;
}

export interface AllStrikesResponse {
  success: boolean;
  index_name: string;
  spot_price: number;
  futures_price: number | null;
  atm_strike: number;
  selected_expiry: string;
  available_expiries: string[];
  timestamp: string;
  total_ce_oi: number;
  total_pe_oi: number;
  total_ce_volume: number;
  total_pe_volume: number;
  pcr_oi: number;
  pcr_volume: number;
  max_pain: number | null;
  highest_ce_oi_strike: number | null;
  highest_pe_oi_strike: number | null;
  highest_ce_chg_oi_strike: number | null;
  highest_pe_chg_oi_strike: number | null;
  highest_volume_strike: number | null;
  strikes: StrikeRow[];
  error?: string;
}

export interface StrikeTimePoint {
  t: string;
  ltp: number;
  oi: number;
  coi: number;
  icoi: number;
  vol: number;
  ivol: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  spot: number;
  fut: number | null;
  avg_volume?: number;
  rvol?: number;
}

export interface StrikeAnalysisResponse {
  success: boolean;
  index_name: string;
  strike: number;
  side: 'CE' | 'PE';
  expiry: string;
  timeframe: string;
  total_points: number;
  series: StrikeTimePoint[];
  error?: string;
}

export interface MultiStrikeResponse {
  success: boolean;
  index_name: string;
  side: 'CE' | 'PE';
  expiry: string;
  timeframe: string;
  timestamps: string[];
  strikes: number[];
  series: Record<string, {
    ltp: (number | null)[];
    coi: (number | null)[];
    icoi: (number | null)[];
    vol: (number | null)[];
    ivol: (number | null)[];
    delta: (number | null)[];
    gamma: (number | null)[];
    iv: (number | null)[];
  }>;
  error?: string;
}

export interface FiltersResponse {
  success: boolean;
  indices: string[];
  timeframes: string[];
  is_market_hours: boolean;
  error?: string;
}

export const fetchFilters = async (): Promise<FiltersResponse> => {
  const res = await fetch('/api/analytics/filters');
  if (!res.ok) throw new Error(`Filters fetch failed with status ${res.status}`);
  return res.json();
};

export const fetchAllStrikes = async (index: string, expiry?: string): Promise<AllStrikesResponse> => {
  const url = new URL('/api/analytics/all-strikes', window.location.origin);
  url.searchParams.set('index', index);
  if (expiry) url.searchParams.set('expiry', expiry);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `All strikes fetch failed with status ${res.status}`);
  }
  return res.json();
};

export const fetchStrikeAnalysis = async (
  index: string,
  strike: number,
  side: 'CE' | 'PE',
  expiry?: string,
  timeframe: string = '5m'
): Promise<StrikeAnalysisResponse> => {
  const url = new URL('/api/analytics/strike-analysis', window.location.origin);
  url.searchParams.set('index', index);
  url.searchParams.set('strike', String(strike));
  url.searchParams.set('side', side);
  if (expiry) url.searchParams.set('expiry', expiry);
  url.searchParams.set('timeframe', timeframe);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Strike analysis fetch failed with status ${res.status}`);
  }
  return res.json();
};

export const fetchMultiStrike = async (
  index: string,
  strikes: number[],
  side: 'CE' | 'PE',
  expiry?: string,
  timeframe: string = '5m'
): Promise<MultiStrikeResponse> => {
  const url = new URL('/api/analytics/multi-strike', window.location.origin);
  url.searchParams.set('index', index);
  url.searchParams.set('strikes', strikes.join(','));
  url.searchParams.set('side', side);
  if (expiry) url.searchParams.set('expiry', expiry);
  url.searchParams.set('timeframe', timeframe);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Multi-strike fetch failed with status ${res.status}`);
  }
  return res.json();
};
