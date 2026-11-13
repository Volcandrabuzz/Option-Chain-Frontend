/**
 * NiftyExpectedRangeCard.tsx
 *
 * Displays live NIFTY Expected Range based on Spot Price and Live India VIX.
 * Positioned in the space between the CE Strikes Section and PE Strikes Section.
 *
 * Formulas:
 *   - Daily Move:   Spot * (VIX / 100) / sqrt(252)
 *   - Weekly Move:  Spot * (VIX / 100) * sqrt(5 / 252)
 *   - Monthly Move: Spot * (VIX / 100) * sqrt(21 / 252)
 *   - Boundaries:   Spot ± Expected Move
 */

import React, { useMemo } from 'react';
import { Target, Activity, TrendingUp, TrendingDown, Clock, ShieldAlert } from 'lucide-react';

export interface ExpectedRangeMove {
  move: number;
  lower: number;
  upper: number;
  move_pct?: number;
}

export interface ExpectedRangeData {
  spot: number;
  vix: number;
  daily: ExpectedRangeMove;
  weekly: ExpectedRangeMove;
  monthly: ExpectedRangeMove;
  timestamp?: string;
  index_name?: string;
}

export interface NiftyExpectedRangeCardProps {
  data: ExpectedRangeData | null;
  selectedIndex?: string;
  spotPrice?: number;
  vix?: number | null;
}

function fmt(n: number | undefined | null, decimals = 2): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

interface RangeSectionProps {
  label: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  sublabel: string;
  badgeBg: string;
  badgeText: string;
  moveData?: ExpectedRangeMove;
  spot: number;
}

const RangeSection: React.FC<RangeSectionProps> = ({
  label,
  sublabel,
  badgeBg,
  badgeText,
  moveData,
  spot,
}) => {
  const move = moveData?.move ?? 0;
  const lower = moveData?.lower ?? (spot > 0 && move > 0 ? spot - move : 0);
  const upper = moveData?.upper ?? (spot > 0 && move > 0 ? spot + move : 0);
  const movePct = moveData?.move_pct ?? (spot > 0 && move > 0 ? (move / spot) * 100 : 0);

  return (
    <div className="bg-gray-900/90 rounded-lg p-3.5 border border-gray-700/80 shadow-md hover:border-gray-600 transition-colors">
      {/* Top Header of Section */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[11px] font-black tracking-wider ${badgeBg} ${badgeText}`}>
            {label}
          </span>
          <span className="text-[10px] text-gray-400 font-mono">({sublabel})</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-yellow-300">
            ± {fmt(move)}
          </span>
          <span className="text-[10px] text-gray-400 font-mono ml-1.5">
            (±{movePct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Boundaries Grid */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-800">
        {/* Lower Boundary */}
        <div className="bg-rose-950/30 rounded p-2 border border-rose-900/40">
          <div className="flex items-center justify-between text-[10px] text-rose-300 mb-0.5">
            <span className="font-semibold uppercase tracking-wider">Lower Boundary</span>
            <TrendingDown className="h-3 w-3 text-rose-400" />
          </div>
          <div className="text-sm font-mono font-extrabold text-rose-400">
            {fmt(lower)}
          </div>
        </div>

        {/* Upper Boundary */}
        <div className="bg-emerald-950/30 rounded p-2 border border-emerald-900/40">
          <div className="flex items-center justify-between text-[10px] text-emerald-300 mb-0.5">
            <span className="font-semibold uppercase tracking-wider">Upper Boundary</span>
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          </div>
          <div className="text-sm font-mono font-extrabold text-emerald-400">
            {fmt(upper)}
          </div>
        </div>
      </div>

      {/* Visual Spread Bar */}
      <div className="mt-2.5">
        <div className="flex justify-between text-[9px] font-mono text-gray-400 mb-1">
          <span className="text-rose-400">-{movePct.toFixed(1)}%</span>
          <span className="text-gray-400">Spot: {fmt(spot)}</span>
          <span className="text-emerald-400">+{movePct.toFixed(1)}%</span>
        </div>
        <div className="relative h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
          <div className="h-full w-1/2 bg-gradient-to-r from-rose-600/70 to-rose-500/40" />
          <div className="h-full w-1/2 bg-gradient-to-r from-emerald-500/40 to-emerald-600/70" />
        </div>
      </div>
    </div>
  );
};

export const NiftyExpectedRangeCard: React.FC<NiftyExpectedRangeCardProps> = ({
  data,
  selectedIndex = 'NIFTY',
  spotPrice = 0,
  vix = null,
}) => {
  // If backend data is provided, use it; otherwise compute client-side fallback if spot & VIX exist
  const effectiveData = useMemo<ExpectedRangeData | null>(() => {
    if (data && data.spot > 0 && data.vix > 0) {
      return data;
    }

    const effectiveSpot = spotPrice > 0 ? spotPrice : data?.spot ?? 0;
    const effectiveVix = vix !== null && vix !== undefined && vix > 0 ? vix : data?.vix ?? null;

    if (effectiveSpot > 0 && effectiveVix !== null && effectiveVix > 0) {
      const vixFactor = effectiveVix / 100.0;
      const dailyMove = effectiveSpot * vixFactor / Math.sqrt(252.0);
      const weeklyMove = effectiveSpot * vixFactor * Math.sqrt(5.0 / 252.0);
      const monthlyMove = effectiveSpot * vixFactor * Math.sqrt(21.0 / 252.0);

      return {
        spot: effectiveSpot,
        vix: effectiveVix,
        daily: {
          move: Math.round(dailyMove * 100) / 100,
          lower: Math.round((effectiveSpot - dailyMove) * 100) / 100,
          upper: Math.round((effectiveSpot + dailyMove) * 100) / 100,
          move_pct: Math.round((dailyMove / effectiveSpot) * 10000) / 100,
        },
        weekly: {
          move: Math.round(weeklyMove * 100) / 100,
          lower: Math.round((effectiveSpot - weeklyMove) * 100) / 100,
          upper: Math.round((effectiveSpot + weeklyMove) * 100) / 100,
          move_pct: Math.round((weeklyMove / effectiveSpot) * 10000) / 100,
        },
        monthly: {
          move: Math.round(monthlyMove * 100) / 100,
          lower: Math.round((effectiveSpot - monthlyMove) * 100) / 100,
          upper: Math.round((effectiveSpot + monthlyMove) * 100) / 100,
          move_pct: Math.round((monthlyMove / effectiveSpot) * 10000) / 100,
        },
        index_name: selectedIndex,
      };
    }

    return null;
  }, [data, spotPrice, vix, selectedIndex]);

  const spot = effectiveData?.spot ?? (spotPrice > 0 ? spotPrice : 0);
  const currentVix = effectiveData?.vix ?? (vix && vix > 0 ? vix : null);

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-purple-500/40 shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* ── Top Header ── */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-gray-700/80 mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-400 shadow-sm">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                <span>{selectedIndex} EXPECTED RANGE</span>
              </h3>
              <p className="text-[10px] text-gray-400">
                Live Volatility Forecast (via India VIX)
              </p>
            </div>
          </div>

          {/* Badges: Spot Price & Live India VIX */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Spot Badge */}
            <div className="px-2.5 py-1 rounded bg-gray-900 border border-gray-700 text-xs font-mono">
              <span className="text-gray-400 text-[10px] mr-1 font-semibold">{selectedIndex} SPOT:</span>
              <span className="font-extrabold text-emerald-400">
                {spot > 0 ? fmt(spot) : '—'}
              </span>
            </div>

            {/* India VIX Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              <span className="text-amber-400 text-[10px] font-bold">INDIA VIX:</span>
              <span className="font-black text-amber-300">
                {currentVix !== null ? currentVix.toFixed(2) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Content: 3 Timeframe Sections (Horizontal Layout: Daily Left, Weekly Middle, Monthly Right) ── */}
        {!effectiveData ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Activity className="h-7 w-7 text-purple-400 animate-spin mb-2" />
            <p className="text-xs font-semibold text-gray-300">Calculating Expected Range…</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Connecting live India VIX and {selectedIndex} spot price.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. DAILY (Left) */}
            <RangeSection
              label="DAILY"
              sublabel="1 Trading Day"
              badgeBg="bg-blue-500/20 border border-blue-500/40"
              badgeText="text-blue-300"
              moveData={effectiveData.daily}
              spot={spot}
            />

            {/* 2. WEEKLY (Middle) */}
            <RangeSection
              label="WEEKLY"
              sublabel="5 Trading Days"
              badgeBg="bg-purple-500/20 border border-purple-500/40"
              badgeText="text-purple-300"
              moveData={effectiveData.weekly}
              spot={spot}
            />

            {/* 3. MONTHLY (Right) */}
            <RangeSection
              label="MONTHLY"
              sublabel="21 Trading Days"
              badgeBg="bg-amber-500/20 border border-amber-500/40"
              badgeText="text-amber-300"
              moveData={effectiveData.monthly}
              spot={spot}
            />
          </div>
        )}
      </div>

      {/* ── Footer Formula Explanation ── */}
      <div className="mt-3 pt-2.5 border-t border-gray-700/60 flex items-center justify-between text-[10px] text-gray-400 font-mono">
        <span className="flex items-center gap-1 text-gray-400">
          <Clock className="h-3 w-3 text-purple-400" />
          <span>Formula: Spot × (VIX/100) × √(Days/252)</span>
        </span>
        <span className="text-gray-400">1-Sigma (68.2% Probability)</span>
      </div>
    </div>
  );
};

export default NiftyExpectedRangeCard;

