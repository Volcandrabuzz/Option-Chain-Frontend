/**
 * PeCeMonitor.tsx
 *
 * Real-time 3-Header Dual-Bar Monitor with Dynamic Baseline:
 *   1. OI (Open Interest) — PE (green) vs CE (red) as two horizontal bars
 *   2. CHG_IN_OI (Change in Open Interest) — PE (green) vs CE (red) as two horizontal bars
 *   3. LTP (Last Traded Price) — PE (green) vs CE (red) as two horizontal bars
 *
 * Layout & Behavior:
 *   - A strong WHITE vertical border marks the initial fetch baseline.
 *   - Values ABOVE initial → bar grows RIGHT of the white border.
 *   - Values BELOW initial → bar grows LEFT of the white border.
 *   - The white border dynamically shifts right to make room for negative bars,
 *     but NEVER disturbs (compresses) already-growing positive bars on the right.
 *   - Scale: 1000% on each side = 50% of container width.
 *     Total container can show ±1000% simultaneously.
 *   - High-water mark: peak border remains at the high even when fill decreases.
 *   - Baseline is "sticky" — once shifted right, it doesn't shift back (until reset).
 *   - CE and PE bars within one metric block share the same baseline position.
 */

import React, { useState, useRef } from 'react';
import { Layers, Activity, IndianRupee } from 'lucide-react';

// ─── Data Types ──────────────────────────────────────────────────────────────

export interface MetricSideData {
  current: number;
  initial: number;
  diff: number;
  pct: number;
  high_pos_pct?: number;
  high_neg_pct?: number;
}

export interface MetricTotalsData {
  pe: MetricSideData;
  ce: MetricSideData;
}

export interface TotalsMonitorData {
  oi: MetricTotalsData;
  chg_in_oi: MetricTotalsData;
  ltp: MetricTotalsData;
  timestamp?: string;
}

// Aliases for compatibility
export type PeCeMonitorData = TotalsMonitorData;

export interface PeCeMonitorProps {
  totalsData?: TotalsMonitorData | null;
  monitorData?: TotalsMonitorData | null;
  selectedIndex: string;
}

export type TotalsBipolarMonitorProps = PeCeMonitorProps;

// ─── Value Formatter ─────────────────────────────────────────────────────────

function formatVal(value: number | undefined | null, isCurrency = false): string {
  if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) return '—';
  if (isCurrency) {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString('en-IN');
}

// ─── Single Bar Track (visual bar fill & peak border only) ───────────────────

interface BarTrackProps {
  label: 'PE' | 'CE';
  data?: MetricSideData;
  isCurrency?: boolean;
  selectedIndex: string;
  baselineLeft: number;
  scaleMax: number;
  metricKey?: 'oi' | 'chg_in_oi' | 'ltp';
}

const BarTrack: React.FC<BarTrackProps> = ({
  label, data, selectedIndex, baselineLeft, scaleMax, metricKey,
}) => {
  const current = typeof data?.current === 'number' && !isNaN(data.current) ? data.current : 0;
  const initial = typeof data?.initial === 'number' && !isNaN(data.initial) ? data.initial : 0;
  const diff = typeof data?.diff === 'number' && !isNaN(data.diff) ? data.diff : 0;
  const pct = typeof data?.pct === 'number' && !isNaN(data.pct) ? data.pct : 0;

  const absPct = Math.abs(pct);
  const isPositive = pct > 0 || (pct === 0 && diff > 0);
  const isNegative = pct < 0 || (pct === 0 && diff < 0);

  // Fill width: scaleMax maps to 50% of container width.
  // Min 1.5% when there's any change, so tiny movements are visible.
  const rawFill = absPct > 0
    ? (Math.min(scaleMax, absPct) / scaleMax) * 50
    : 0;
  const fillWidth = rawFill > 0 ? Math.max(1.5, rawFill) : (Math.abs(diff) > 0 ? 1.5 : 0);

  // ─── High-Water Mark Tracking (positive & negative peak percentages) ─
  const highRef = useRef({
    posPct: 0,
    negPct: 0,
    lastIndex: selectedIndex,
    lastInitial: initial,
  });

  if (
    highRef.current.lastIndex !== selectedIndex ||
    (initial !== 0 && highRef.current.lastInitial !== 0 && highRef.current.lastInitial !== initial)
  ) {
    highRef.current = {
      posPct: 0, negPct: 0,
      lastIndex: selectedIndex, lastInitial: initial,
    };
  }

  // Pre-seed from backend session highs
  const bkPosHigh = data?.high_pos_pct ?? 0;
  const bkNegHigh = data?.high_neg_pct ?? 0;
  if (bkPosHigh > highRef.current.posPct) {
    highRef.current.posPct = bkPosHigh;
  }
  if (bkNegHigh > highRef.current.negPct) {
    highRef.current.negPct = bkNegHigh;
  }

  // Real-time peak percentage expansion
  if (isPositive && absPct > highRef.current.posPct) {
    highRef.current.posPct = absPct;
  }
  if (isNegative && absPct > highRef.current.negPct) {
    highRef.current.negPct = absPct;
  }

  const peakPosPct = highRef.current.posPct;
  const peakNegPct = highRef.current.negPct;

  const peakPosWidth = peakPosPct > 0
    ? Math.max(1.5, (Math.min(scaleMax, peakPosPct) / scaleMax) * 50)
    : 0;
  const peakNegWidth = peakNegPct > 0
    ? Math.max(1.5, (Math.min(scaleMax, peakNegPct) / scaleMax) * 50)
    : 0;

  const isPE = label === 'PE';
  const isLtp = metricKey === 'ltp';

  // Color classes: For LTP, both PE and CE are blue (PE is cyan/sky blue, CE is royal blue)
  // For other metrics: PE is green, CE is red
  const gradRight = isLtp
    ? (isPE
        ? 'bg-gradient-to-r from-sky-600 to-cyan-400 shadow-md shadow-cyan-500/30'
        : 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-md shadow-blue-500/30')
    : (isPE
        ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-md shadow-green-500/30'
        : 'bg-gradient-to-r from-red-600 to-red-500 shadow-md shadow-red-500/30');

  const gradLeft = isLtp
    ? (isPE
        ? 'bg-gradient-to-l from-sky-600 to-cyan-400 shadow-md shadow-cyan-500/30'
        : 'bg-gradient-to-l from-blue-600 to-blue-400 shadow-md shadow-blue-500/30')
    : (isPE
        ? 'bg-gradient-to-l from-green-600 to-green-500 shadow-md shadow-green-500/30'
        : 'bg-gradient-to-l from-red-600 to-red-500 shadow-md shadow-red-500/30');

  const borderColor = isLtp
    ? (isPE ? 'border-cyan-500/60' : 'border-blue-500/60')
    : (isPE ? 'border-green-500/60' : 'border-red-500/60');

  const bgTint = isLtp
    ? (isPE ? 'bg-cyan-500/5' : 'bg-blue-500/5')
    : (isPE ? 'bg-green-500/5' : 'bg-red-500/5');

  const edgeGlow = isLtp
    ? (isPE
        ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]'
        : 'bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]')
    : (isPE
        ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]'
        : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]');

  return (
    <div className="relative h-5 w-full bg-gray-900/80 rounded border border-gray-700/60 overflow-hidden">
      {/* ─── NEGATIVE SIDE (left of baseline) ─── */}
      {peakNegWidth > 0 && !(isNegative && fillWidth >= peakNegWidth - 0.3) && (
        <div
          className={`absolute top-0 bottom-0 rounded-l transition-all duration-500 ease-out pointer-events-none z-[5] border ${borderColor} ${bgTint}`}
          style={{
            left: `${Math.max(0, baselineLeft - peakNegWidth)}%`,
            width: `${Math.min(peakNegWidth, baselineLeft)}%`,
          }}
        >
          <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${edgeGlow}`} />
        </div>
      )}

      {isNegative && fillWidth > 0 && (
        <div
          className={`absolute top-0 bottom-0 rounded-l transition-all duration-500 ease-out z-10 ${gradLeft}`}
          style={{
            left: `${Math.max(0, baselineLeft - fillWidth)}%`,
            width: `${Math.min(fillWidth, baselineLeft)}%`,
          }}
        />
      )}

      {/* ─── POSITIVE SIDE (right of baseline) ─── */}
      {peakPosWidth > 0 && !(isPositive && fillWidth >= peakPosWidth - 0.3) && (
        <div
          className={`absolute top-0 bottom-0 rounded-r transition-all duration-500 ease-out pointer-events-none z-[5] border ${borderColor} ${bgTint}`}
          style={{
            left: `${baselineLeft}%`,
            width: `${Math.min(peakPosWidth, 100 - baselineLeft)}%`,
          }}
        >
          <div className={`absolute right-0 top-0 bottom-0 w-[2px] ${edgeGlow}`} />
        </div>
      )}

      {isPositive && fillWidth > 0 && (
        <div
          className={`absolute top-0 bottom-0 rounded-r transition-all duration-500 ease-out z-10 ${gradRight}`}
          style={{
            left: `${baselineLeft}%`,
            width: `${Math.min(fillWidth, 100 - baselineLeft)}%`,
          }}
        />
      )}
    </div>
  );
};

// ─── Single Bar Value Display ────────────────────────────────────────────────

interface BarValueProps {
  data?: MetricSideData;
  isCurrency?: boolean;
}

const BarValue: React.FC<BarValueProps> = ({ data, isCurrency = false }) => {
  const diff = typeof data?.diff === 'number' && !isNaN(data.diff) ? data.diff : 0;
  const pct = typeof data?.pct === 'number' && !isNaN(data.pct) ? data.pct : 0;
  const absPct = Math.abs(pct);
  const isPositive = pct > 0 || (pct === 0 && diff > 0);
  const isNegative = pct < 0 || (pct === 0 && diff < 0);

  let arrow = '—';
  if (isPositive) arrow = '▲';
  else if (isNegative) arrow = '▼';

  return (
    <div className="flex items-center space-x-1.5 justify-end h-5">
      <span className="text-xs sm:text-[13px] font-mono font-bold text-gray-200 tracking-tight truncate">
        {absPct > 0 ? `${absPct.toFixed(1)}%` : formatVal(Math.abs(diff), isCurrency)}
      </span>
      <span className={`text-xs sm:text-[13px] font-black ${
        isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-500'
      }`}>
        {arrow}
      </span>
    </div>
  );
};

// ─── Dual-Bar Chart Block (one per metric, shows PE & CE) ────────────────────

interface DualBarChartProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColorClass: string;
  metricKey: 'oi' | 'chg_in_oi' | 'ltp';
  peData?: MetricSideData;
  ceData?: MetricSideData;
  isCurrency?: boolean;
  selectedIndex: string;
}

const DualBarChart: React.FC<DualBarChartProps> = ({
  title, subtitle, icon, iconColorClass,
  metricKey, peData, ceData, isCurrency = false,
  selectedIndex,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // ─── Dynamic Scale Tier: Starts at 200%, crosses 200% → 500%, crosses 500% → 1000% ───
  const pePct = peData?.pct ?? 0;
  const cePct = ceData?.pct ?? 0;
  const peHighPos = peData?.high_pos_pct ?? 0;
  const peHighNeg = peData?.high_neg_pct ?? 0;
  const ceHighPos = ceData?.high_pos_pct ?? 0;
  const ceHighNeg = ceData?.high_neg_pct ?? 0;

  const currentMaxPct = Math.max(
    Math.abs(pePct),
    Math.abs(cePct),
    peHighPos,
    peHighNeg,
    ceHighPos,
    ceHighNeg,
  );

  const scaleTierRef = useRef({
    peakPct: 0,
    lastIndex: selectedIndex,
  });

  if (scaleTierRef.current.lastIndex !== selectedIndex) {
    scaleTierRef.current.peakPct = 0;
    scaleTierRef.current.lastIndex = selectedIndex;
  }

  if (currentMaxPct > scaleTierRef.current.peakPct) {
    scaleTierRef.current.peakPct = currentMaxPct;
  }

  const effectivePeakPct = Math.max(currentMaxPct, scaleTierRef.current.peakPct);

  let scaleMax = 200;
  if (effectivePeakPct > 500) {
    scaleMax = 1000;
  } else if (effectivePeakPct > 200) {
    scaleMax = 500;
  }

  // ─── Calculate shared baseline position for both bars ─────────────────
  // The baseline shifts right to accommodate the largest negative extent
  // from either PE or CE (current values OR backend-tracked peaks).
  const maxNegPct = Math.min(scaleMax, Math.max(
    pePct < 0 ? Math.abs(pePct) : 0,
    cePct < 0 ? Math.abs(cePct) : 0,
    peHighNeg,
    ceHighNeg,
    0,
  ));

  // Minimum 3% shift when any negative exists so it is clearly visible.
  const currentBaseline = maxNegPct > 0
    ? Math.max(3, (maxNegPct / scaleMax) * 50)
    : 0;

  // Sticky baseline: only moves RIGHT, never back left (until index change).
  // This ensures positive bars on the right are never disturbed by baseline retreat.
  const baselineRef = useRef({
    maxBaseline: 0,
    lastIndex: selectedIndex,
  });

  if (baselineRef.current.lastIndex !== selectedIndex) {
    baselineRef.current.maxBaseline = 0;
    baselineRef.current.lastIndex = selectedIndex;
  }

  if (currentBaseline > baselineRef.current.maxBaseline) {
    baselineRef.current.maxBaseline = currentBaseline;
  }

  const baselineLeft = baselineRef.current.maxBaseline;

  // Tooltip data helpers
  const peInitial = peData?.initial ?? 0;
  const peCurrent = peData?.current ?? 0;
  const peDiff = peData?.diff ?? 0;
  const pePctVal = peData?.pct ?? 0;
  const ceInitial = ceData?.initial ?? 0;
  const ceCurrent = ceData?.current ?? 0;
  const ceDiff = ceData?.diff ?? 0;
  const cePctVal = ceData?.pct ?? 0;

  const isLtp = metricKey === 'ltp';

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-xl flex flex-col relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-700 mb-3">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg border ${iconColorClass}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
            <p className="text-[10px] text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1.5">
          <span
            className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-blue-900/40 text-blue-300 border border-blue-500/30"
            title={`Dynamic scale: starts at ±200%, expands to ±500% then ±1000%`}
          >
            ±{scaleMax}%
          </span>
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-700 text-gray-300">
            {selectedIndex}
          </span>
        </div>
      </div>

      {/* Dual Bars Section with Single Continuous Heavy White Line crossing both bars */}
      <div className="flex w-full items-center space-x-2 my-1">
        {/* Left Column: Labels */}
        <div className="flex flex-col justify-between w-6 flex-shrink-0 h-[48px]">
          <span className={`text-xs font-black text-center h-5 flex items-center justify-center ${
            isLtp ? 'text-blue-400' : 'text-red-400'
          }`}>CE</span>
          <span className={`text-xs font-black text-center h-5 flex items-center justify-center ${
            isLtp ? 'text-cyan-400' : 'text-green-400'
          }`}>PE</span>
        </div>

        {/* Middle Column: Both Bar Tracks + Single Heavy White Line crossing both */}
        <div className="relative flex-1 space-y-2">
          {/* Continuous heavy white baseline crossing both CE and PE bars */}
          <div
            className="absolute -top-2 -bottom-2 w-[4px] bg-white z-30 transition-all duration-500 ease-out pointer-events-none rounded-full"
            style={{
              left: `${baselineLeft}%`,
              transform: 'translateX(-50%)',
              boxShadow: '0 0 10px rgba(255,255,255,0.95), 0 0 3px #ffffff, 0 0 1px rgba(0,0,0,0.8)',
            }}
          />

          {/* CE Bar Track */}
          <BarTrack
            key={`${selectedIndex}-${metricKey}-ce`}
            label="CE"
            data={ceData}
            isCurrency={isCurrency}
            selectedIndex={selectedIndex}
            baselineLeft={baselineLeft}
            scaleMax={scaleMax}
            metricKey={metricKey}
          />

          {/* PE Bar Track */}
          <BarTrack
            key={`${selectedIndex}-${metricKey}-pe`}
            label="PE"
            data={peData}
            isCurrency={isCurrency}
            selectedIndex={selectedIndex}
            baselineLeft={baselineLeft}
            scaleMax={scaleMax}
            metricKey={metricKey}
          />
        </div>

        {/* Right Column: Values */}
        <div className="flex flex-col justify-between flex-shrink-0 min-w-[85px] h-[48px]">
          <BarValue data={ceData} isCurrency={isCurrency} />
          <BarValue data={peData} isCurrency={isCurrency} />
        </div>
      </div>

      {/* Summary row: initial fetch values */}
      <div className="flex items-center justify-between text-xs text-gray-300 mt-2 pt-1.5 border-t border-gray-700/50">
        <span className="flex items-center space-x-1.5">
          <span className={`${isLtp ? 'text-cyan-400' : 'text-green-400'} font-extrabold`}>PE</span>
          <span className="text-gray-400 font-medium">Init:</span>
          <span className="text-yellow-300 font-mono font-bold">{formatVal(peInitial, isCurrency)}</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className={`${isLtp ? 'text-blue-400' : 'text-red-400'} font-extrabold`}>CE</span>
          <span className="text-gray-400 font-medium">Init:</span>
          <span className="text-yellow-300 font-mono font-bold">{formatVal(ceInitial, isCurrency)}</span>
        </span>
      </div>

      {/* Hover Tooltip - Opens downward so it never covers or gets hidden by the headers */}
      {isHovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-gray-950/95 border border-gray-600 rounded-lg p-3 shadow-2xl z-50 text-xs pointer-events-none backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-gray-700 pb-1.5 mb-2 font-bold">
            <span className="text-white">{title}</span>
            <div className="flex items-center space-x-1.5">
              <span className="text-blue-300 text-[10px] font-mono">Scale: ±{scaleMax}%</span>
              <span className="text-gray-400 text-[10px]">{selectedIndex}</span>
            </div>
          </div>

          {/* CE Section */}
          <div className="mb-2">
            <div className="flex items-center space-x-1 mb-1">
              <span className={`w-2 h-2 rounded-full ${isLtp ? 'bg-blue-500' : 'bg-red-500'} inline-block flex-shrink-0`} />
              <span className={`${isLtp ? 'text-blue-400' : 'text-red-400'} font-bold text-[11px]`}>CE (Call Options)</span>
            </div>
            <div className="space-y-0.5 pl-3 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Initial:</span>
                <span className="text-yellow-300 font-bold">{formatVal(ceInitial, isCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current:</span>
                <span className="text-white font-bold">{formatVal(ceCurrent, isCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Diff:</span>
                <span className={ceDiff > 0 ? 'text-green-400 font-bold' : ceDiff < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {ceDiff > 0 ? '+' : ''}{formatVal(ceDiff, isCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Change:</span>
                <span className={cePctVal > 0 ? 'text-green-400 font-bold' : cePctVal < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {cePctVal > 0 ? '+' : ''}{cePctVal.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* PE Section */}
          <div className="border-t border-gray-700/50 pt-2">
            <div className="flex items-center space-x-1 mb-1">
              <span className={`w-2 h-2 rounded-full ${isLtp ? 'bg-cyan-400' : 'bg-green-500'} inline-block flex-shrink-0`} />
              <span className={`${isLtp ? 'text-cyan-400' : 'text-green-400'} font-bold text-[11px]`}>PE (Put Options)</span>
            </div>
            <div className="space-y-0.5 pl-3 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Initial:</span>
                <span className="text-yellow-300 font-bold">{formatVal(peInitial, isCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current:</span>
                <span className="text-white font-bold">{formatVal(peCurrent, isCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Diff:</span>
                <span className={peDiff > 0 ? 'text-green-400 font-bold' : peDiff < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {peDiff > 0 ? '+' : ''}{formatVal(peDiff, isCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Change:</span>
                <span className={pePctVal > 0 ? 'text-green-400 font-bold' : pePctVal < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {pePctVal > 0 ? '+' : ''}{pePctVal.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PeCeMonitor: React.FC<PeCeMonitorProps> = ({ totalsData, monitorData, selectedIndex }) => {
  const data = totalsData || monitorData || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 w-full">
      {/* OI (Open Interest) */}
      <DualBarChart
        title="OI (Open Interest)"
        subtitle="Sum of all strikes — PE vs CE"
        icon={<Layers className="h-4 w-4" />}
        iconColorClass="bg-blue-600/30 text-blue-400 border-blue-500/30"
        metricKey="oi"
        peData={data?.oi?.pe}
        ceData={data?.oi?.ce}
        isCurrency={false}
        selectedIndex={selectedIndex}
      />

      {/* CHG_IN_OI (Change in Open Interest) */}
      <DualBarChart
        title="CHG_IN_OI (Change in OI)"
        subtitle="Sum of all strikes — PE vs CE"
        icon={<Activity className="h-4 w-4" />}
        iconColorClass="bg-purple-600/30 text-purple-400 border-purple-500/30"
        metricKey="chg_in_oi"
        peData={data?.chg_in_oi?.pe}
        ceData={data?.chg_in_oi?.ce}
        isCurrency={false}
        selectedIndex={selectedIndex}
      />

      {/* LTP (Last Traded Price) */}
      <DualBarChart
        title="LTP (Last Traded Price)"
        subtitle="Sum of all strikes — PE vs CE"
        icon={<IndianRupee className="h-4 w-4" />}
        iconColorClass="bg-emerald-600/30 text-emerald-400 border-emerald-500/30"
        metricKey="ltp"
        peData={data?.ltp?.pe}
        ceData={data?.ltp?.ce}
        isCurrency={true}
        selectedIndex={selectedIndex}
      />
    </div>
  );
};

// Aliases for seamless backward compatibility
export const TotalsBipolarMonitor = PeCeMonitor;
export default PeCeMonitor;
