/**
 * OIStrikeMonitor.tsx
 *
 * Real-time Change-in-OI dashboard for 11 ATM-centred strikes (ATM-5 to ATM+5).
 *
 * Layout & Behavior:
 *   - Left: Strike Price column with ATM highlight
 *   - Right: Dual horizontal bar graph for each strike price:
 *       • CE (Call Options): Red bar on top
 *       • PE (Put Options): Green bar on bottom
 *       • Single continuous heavy white line marking starting baseline (opening Change in OI)
 *       • Increase above opening → grows to the RIGHT
 *       • Decrease below opening → grows to the LEFT, shifting white line right to make room
 *       • Peak border (high-water mark) remaining at max
 *       • Dynamic scale tier: starts at ±200%, expands to ±500% then ±1000%
 *       • Smart tooltip placement: opens downward for top rows so it never gets hidden
 *         inside the header, and upward for lower rows.
 */

import React, { useMemo, useState, useRef } from 'react';
import { Activity } from 'lucide-react';

// ─── Data types ──────────────────────────────────────────────────────────────

export interface OIStrikeEntry {
  strike: number;
  side: 'CE' | 'PE';
  is_atm: boolean;
  opening: number;   // exchange CHG_IN_OI at session start (baseline)
  current: number;   // latest exchange CHG_IN_OI
  max_seen: number;  // max |value| ever seen since baseline was captured
}

export interface OIStrikeMonitorPayload {
  strikes: OIStrikeEntry[];
  scale: number;       // shared scale (max abs across all entries)
  underlying: number;
  timestamp?: string;
}

export interface OIStrikeMonitorProps {
  data: OIStrikeMonitorPayload | null;
  selectedIndex: string;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtCompact(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs === 0) return '0';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs}`;
}

function fmtFull(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toLocaleString('en-IN')}`;
}

// ─── Single Bar Track (CE or PE fill + peak border) ──────────────────────────

interface StrikeBarTrackProps {
  label: 'PE' | 'CE';
  current: number;
  opening: number;
  diff: number;
  pct: number;
  maxSeen: number;
  baselineLeft: number;
  scaleMax: number;
}

const StrikeBarTrack: React.FC<StrikeBarTrackProps> = ({
  label, current, opening, diff, pct, maxSeen, baselineLeft, scaleMax,
}) => {
  const absPct = Math.abs(pct);
  const isPositive = diff > 0 || (diff === 0 && pct > 0);
  const isNegative = diff < 0 || (diff === 0 && pct < 0);

  // Fill width: scaleMax maps to 50% of container width
  const rawFill = absPct > 0
    ? (Math.min(scaleMax, absPct) / scaleMax) * 50
    : 0;
  const fillWidth = rawFill > 0 ? Math.max(1.5, rawFill) : (Math.abs(diff) > 0 ? 1.5 : 0);

  // High-water mark tracking in percentage
  const highRef = useRef({
    posPct: 0,
    negPct: 0,
  });

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

  const gradRight = isPE
    ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-md shadow-green-500/30'
    : 'bg-gradient-to-r from-red-600 to-red-500 shadow-md shadow-red-500/30';
  const gradLeft = isPE
    ? 'bg-gradient-to-l from-green-600 to-green-500 shadow-md shadow-green-500/30'
    : 'bg-gradient-to-l from-red-600 to-red-500 shadow-md shadow-red-500/30';
  const borderColor = isPE ? 'border-green-500/60' : 'border-red-500/60';
  const bgTint = isPE ? 'bg-green-500/5' : 'bg-red-500/5';
  const edgeGlow = isPE
    ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]'
    : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]';

  return (
    <div className="relative h-4 w-full bg-gray-900/80 rounded border border-gray-700/60 overflow-hidden">
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

// ─── Strike Row (Strike info on left, Dual Bars on right) ────────────────────

interface StrikeDualRowProps {
  strike: number;
  isAtm: boolean;
  ce: OIStrikeEntry;
  pe: OIStrikeEntry;
  globalScale: number;
  rowIndex: number;
}

const StrikeDualRow: React.FC<StrikeDualRowProps> = ({
  strike, isAtm, ce, pe, globalScale, rowIndex,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const ceCurrent = ce?.current ?? 0;
  const ceOpening = ce?.opening ?? 0;
  const ceDiff = ceCurrent - ceOpening;
  const cePct = ceOpening !== 0
    ? ((ceDiff) / Math.abs(ceOpening)) * 100
    : (globalScale > 0 ? (ceDiff / (globalScale * 0.1 || 1)) * 100 : 0);

  const peCurrent = pe?.current ?? 0;
  const peOpening = pe?.opening ?? 0;
  const peDiff = peCurrent - peOpening;
  const pePct = peOpening !== 0
    ? ((peDiff) / Math.abs(peOpening)) * 100
    : (globalScale > 0 ? (peDiff / (globalScale * 0.1 || 1)) * 100 : 0);

  // Dynamic Scale Tier: Starts at 200%, expands to 500% then 1000%
  const maxAbsPct = Math.max(Math.abs(cePct), Math.abs(pePct));
  const scaleTierRef = useRef(0);
  if (maxAbsPct > scaleTierRef.current) {
    scaleTierRef.current = maxAbsPct;
  }
  const peakSeenPct = Math.max(maxAbsPct, scaleTierRef.current);

  let scaleMax = 200;
  if (peakSeenPct > 500) scaleMax = 1000;
  else if (peakSeenPct > 200) scaleMax = 500;

  // Shared baseline position: shifts right to carve room for negative drops
  const maxNegPct = Math.min(scaleMax, Math.max(
    ceDiff < 0 ? Math.abs(cePct) : 0,
    peDiff < 0 ? Math.abs(pePct) : 0,
    0,
  ));

  const currentBaseline = maxNegPct > 0
    ? Math.max(3, (maxNegPct / scaleMax) * 50)
    : 0;

  const baselineRef = useRef(0);
  if (currentBaseline > baselineRef.current) {
    baselineRef.current = currentBaseline;
  }
  const baselineLeft = baselineRef.current;

  // Arrow indicators
  const ceArrow = ceDiff > 0 ? '▲' : ceDiff < 0 ? '▼' : '—';
  const peArrow = peDiff > 0 ? '▲' : peDiff < 0 ? '▼' : '—';

  // Smart tooltip placement: top 4 rows open downwards so they never hide header details
  const tooltipPositionClass = rowIndex < 4
    ? 'top-full mt-2'
    : 'bottom-full mb-2';

  return (
    <div
      className={`relative flex items-center gap-3 py-1.5 px-3 rounded-lg transition-colors select-none ${
        isAtm
          ? 'bg-yellow-500/10 ring-1 ring-yellow-400/40 my-1 shadow-[0_0_12px_rgba(234,179,8,0.12)]'
          : 'hover:bg-gray-700/30'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ─── Left Column: Strike Price & ATM Indicator ─── */}
      <div className="flex flex-col justify-center w-32 shrink-0">
        <div className="flex items-center gap-1.5">
          {isAtm && (
            <span className="text-[10px] font-black text-yellow-400 bg-yellow-500/25 px-1.5 py-0.5 rounded border border-yellow-500/40">
              ATM
            </span>
          )}
          <span
            className={`font-mono font-extrabold text-sm sm:text-base tabular-nums ${
              isAtm
                ? 'text-yellow-300 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]'
                : 'text-gray-100'
            }`}
          >
            {strike.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] text-gray-400 font-mono mt-0.5">
          <span title={`CE Opening: ${fmtFull(ceOpening)}`}>
            C: <span className="text-gray-200 font-semibold">{fmtCompact(ceOpening)}</span>
          </span>
          <span title={`PE Opening: ${fmtFull(peOpening)}`}>
            P: <span className="text-gray-200 font-semibold">{fmtCompact(peOpening)}</span>
          </span>
        </div>
      </div>

      {/* ─── Right Area: Dual Bars (CE Red top, PE Green bottom) ─── */}
      <div className="flex flex-1 items-center space-x-2.5">
        {/* Row Labels (CE & PE) */}
        <div className="flex flex-col justify-between w-6 shrink-0 h-10">
          <span className="text-xs font-black text-center text-red-400 h-4.5 flex items-center justify-center">
            CE
          </span>
          <span className="text-xs font-black text-center text-green-400 h-4.5 flex items-center justify-center">
            PE
          </span>
        </div>

        {/* Tracks + Single Heavy White Vertical Line */}
        <div className="relative flex-1 space-y-1.5">
          {/* Continuous heavy white baseline crossing both bars */}
          <div
            className="absolute -top-1.5 -bottom-1.5 w-[3.5px] bg-white z-30 transition-all duration-500 ease-out pointer-events-none rounded-full"
            style={{
              left: `${baselineLeft}%`,
              transform: 'translateX(-50%)',
              boxShadow: '0 0 8px rgba(255,255,255,0.95), 0 0 3px #ffffff',
            }}
          />

          {/* CE Bar Track (Red) */}
          <StrikeBarTrack
            label="CE"
            current={ceCurrent}
            opening={ceOpening}
            diff={ceDiff}
            pct={cePct}
            maxSeen={ce?.max_seen ?? 0}
            baselineLeft={baselineLeft}
            scaleMax={scaleMax}
          />

          {/* PE Bar Track (Green) */}
          <StrikeBarTrack
            label="PE"
            current={peCurrent}
            opening={peOpening}
            diff={peDiff}
            pct={pePct}
            maxSeen={pe?.max_seen ?? 0}
            baselineLeft={baselineLeft}
            scaleMax={scaleMax}
          />
        </div>

        {/* Values + Direction Arrows */}
        <div className="flex flex-col justify-between shrink-0 min-w-[85px] h-10">
          <div className="flex items-center space-x-1 justify-end h-4.5 font-mono">
            <span className={`text-xs sm:text-[13px] font-bold ${ceDiff > 0 ? 'text-red-400' : ceDiff < 0 ? 'text-red-300' : 'text-gray-300'}`}>
              {fmtCompact(ceCurrent)}
            </span>
            <span className={`text-xs sm:text-[13px] font-black ${ceDiff > 0 ? 'text-green-400' : ceDiff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {ceArrow}
            </span>
          </div>
          <div className="flex items-center space-x-1 justify-end h-4.5 font-mono">
            <span className={`text-xs sm:text-[13px] font-bold ${peDiff > 0 ? 'text-green-400' : peDiff < 0 ? 'text-green-300' : 'text-gray-300'}`}>
              {fmtCompact(peCurrent)}
            </span>
            <span className={`text-xs sm:text-[13px] font-black ${peDiff > 0 ? 'text-green-400' : peDiff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
              {peArrow}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Hover Tooltip: Smart placement avoids covering header details ─── */}
      {isHovered && (
        <div
          className={`absolute ${tooltipPositionClass} left-1/2 -translate-x-1/2 w-80 bg-gray-950/95 border border-gray-600 rounded-lg p-3 shadow-2xl z-50 text-xs pointer-events-none backdrop-blur-md`}
        >
          <div className="flex items-center justify-between border-b border-gray-700 pb-1.5 mb-2 font-bold">
            <span className="text-white">
              Strike {strike.toLocaleString('en-IN')} {isAtm && '(ATM)'}
            </span>
            <span className="text-blue-300 text-[10px] font-mono">Scale: ±{scaleMax}%</span>
          </div>

          {/* CE Details */}
          <div className="mb-2">
            <div className="flex items-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0" />
              <span className="text-red-400 font-bold text-[11px]">CE (Call Options)</span>
            </div>
            <div className="space-y-0.5 pl-3 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Opening Ref:</span>
                <span className="text-yellow-300 font-bold">{fmtFull(ceOpening)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Chg OI:</span>
                <span className="text-white font-bold">{fmtFull(ceCurrent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Δ vs Opening:</span>
                <span className={ceDiff > 0 ? 'text-green-400 font-bold' : ceDiff < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {ceDiff > 0 ? '+' : ''}{fmtFull(ceDiff)} ({cePct > 0 ? '+' : ''}{cePct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-0.5">
                <span className="text-gray-400">Max Seen:</span>
                <span className="text-purple-300 font-bold">{fmtFull(ce?.max_seen ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* PE Details */}
          <div className="border-t border-gray-700/50 pt-2">
            <div className="flex items-center space-x-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block shrink-0" />
              <span className="text-green-400 font-bold text-[11px]">PE (Put Options)</span>
            </div>
            <div className="space-y-0.5 pl-3 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Opening Ref:</span>
                <span className="text-yellow-300 font-bold">{fmtFull(peOpening)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Chg OI:</span>
                <span className="text-white font-bold">{fmtFull(peCurrent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Δ vs Opening:</span>
                <span className={peDiff > 0 ? 'text-green-400 font-bold' : peDiff < 0 ? 'text-red-400 font-bold' : 'text-gray-400'}>
                  {peDiff > 0 ? '+' : ''}{fmtFull(peDiff)} ({pePct > 0 ? '+' : ''}{pePct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-800 pt-0.5">
                <span className="text-gray-400">Max Seen:</span>
                <span className="text-purple-300 font-bold">{fmtFull(pe?.max_seen ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Visual Legend ───────────────────────────────────────────────────────────

const Legend: React.FC = () => (
  <div className="flex items-center justify-center gap-5 text-[11px] text-gray-400 mt-2 py-1 border-t border-gray-700/50 flex-wrap">
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-4 h-2 rounded-sm bg-gradient-to-r from-red-600 to-red-500 shadow-sm" />
      CE Call Bar
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-4 h-2 rounded-sm bg-gradient-to-r from-green-600 to-green-500 shadow-sm" />
      PE Put Bar
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-[3.5px] h-3 bg-white rounded-full shadow-[0_0_6px_#fff]" />
      Starting Baseline
    </span>
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3.5 h-2 border border-green-500/70 bg-green-500/10 rounded-sm" />
      Peak High Border
    </span>
    <span className="flex items-center gap-1.5 text-yellow-400">
      <span className="inline-block px-1 py-0.2 bg-yellow-500/20 rounded border border-yellow-500/30 text-[9px] font-bold">ATM</span>
      At-The-Money
    </span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const OIStrikeMonitor: React.FC<OIStrikeMonitorProps> = ({ data, selectedIndex }) => {
  const { ceMap, peMap, strikes, scale } = useMemo(() => {
    if (!data || !data.strikes || !Array.isArray(data.strikes) || !data.strikes.length) {
      return { ceMap: {}, peMap: {}, strikes: [], scale: 1 };
    }
    const ceMap: Record<number, OIStrikeEntry> = {};
    const peMap: Record<number, OIStrikeEntry> = {};
    const strikesSet = new Set<number>();

    for (const e of data.strikes) {
      if (typeof e?.strike === 'number') {
        strikesSet.add(e.strike);
        if (e.side === 'CE') ceMap[e.strike] = e;
        else peMap[e.strike] = e;
      }
    }

    const sortedStrikes = Array.from(strikesSet).sort((a, b) => a - b);
    return { ceMap, peMap, strikes: sortedStrikes, scale: data.scale || 1 };
  }, [data]);

  if (!data || strikes.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-orange-400 animate-spin" />
          <h3 className="text-sm font-semibold text-gray-300">Live Change in OI — ATM ± 5 Strikes</h3>
        </div>
        <p className="text-gray-500 text-xs">
          Waiting for initial market data to populate ATM strikes for{' '}
          <span className="text-orange-400 font-semibold">{selectedIndex}</span>…
        </p>
      </div>
    );
  }

  const atmStrike = strikes.find(s => ceMap[s]?.is_atm || peMap[s]?.is_atm);
  const spotDisplay = typeof data.underlying === 'number' && !isNaN(data.underlying)
    ? data.underlying.toFixed(2)
    : '—';

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl mb-6 relative">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800/90 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            Live Change in Open Interest (OI) — ATM ± 5 Strikes
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            ATM:{' '}
            <span className="text-yellow-300 font-bold font-mono">
              {atmStrike ? atmStrike.toLocaleString('en-IN') : '—'}
            </span>
          </span>
          <span className="text-xs text-gray-400">
            Spot:{' '}
            <span className="text-emerald-300 font-bold font-mono">
              {spotDisplay}
            </span>
          </span>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            {selectedIndex}
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2">
        {/* Column Headers */}
        <div className="flex items-center gap-3 mb-2 px-3 text-[11px] text-gray-400 font-semibold">
          <div className="w-28 shrink-0">Strike Price</div>
          <div className="flex flex-1 items-center justify-between">
            <span className="text-gray-400">Change in OI (CE red, PE green) — vs Starting Baseline</span>
            <span className="text-gray-500 font-mono text-[10px]">Current &amp; Trend</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700/60 mb-1" />

        {/* 11 Strike Rows */}
        <div className="space-y-1">
          {strikes.map((strike, idx) => {
            const ce = ceMap[strike];
            const pe = peMap[strike];
            if (!ce || !pe) return null;
            return (
              <StrikeDualRow
                key={strike}
                strike={strike}
                isAtm={ce.is_atm || pe.is_atm}
                ce={ce}
                pe={pe}
                globalScale={scale}
                rowIndex={idx}
              />
            );
          })}
        </div>

        {/* Visual Legend */}
        <Legend />
      </div>

      {/* Footer bar */}
      <div className="px-5 py-2 border-t border-gray-700 bg-gray-900/50 rounded-b-xl flex items-center justify-between text-[11px] text-gray-500">
        <span>
          Max Scale: <span className="text-gray-300 font-mono font-semibold">{fmtFull(scale)}</span> contracts
        </span>
        {data.timestamp && (
          <span>
            Last Updated: <span className="text-gray-300 font-mono">{data.timestamp}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default OIStrikeMonitor;
