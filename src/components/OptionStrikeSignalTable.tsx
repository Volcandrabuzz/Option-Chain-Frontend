import React, { useMemo } from 'react';

export interface StrikeRowSignal {
  strike: number;
  label?: string; // 'ITM', 'ATM', 'OTM'
  is_atm?: boolean;
  pe?: {
    chg_oi?: number;
    change_oi?: number;
    ltp?: number;
    volume?: number;
    theta?: number;
    gamma?: number;
    delta?: number;
    signals?: {
      chg_oi?: 'UP' | 'DOWN' | 'FLAT';
      ltp?: 'UP' | 'DOWN' | 'FLAT';
      volume?: 'UP' | 'DOWN' | 'FLAT';
      theta?: 'UP' | 'DOWN' | 'FLAT';
      gamma?: 'UP' | 'DOWN' | 'FLAT';
      delta?: 'UP' | 'DOWN' | 'FLAT';
    };
  };
  ce?: {
    chg_oi?: number;
    change_oi?: number;
    ltp?: number;
    volume?: number;
    theta?: number;
    gamma?: number;
    delta?: number;
    signals?: {
      chg_oi?: 'UP' | 'DOWN' | 'FLAT';
      ltp?: 'UP' | 'DOWN' | 'FLAT';
      volume?: 'UP' | 'DOWN' | 'FLAT';
      theta?: 'UP' | 'DOWN' | 'FLAT';
      gamma?: 'UP' | 'DOWN' | 'FLAT';
      delta?: 'UP' | 'DOWN' | 'FLAT';
    };
  };
}

export interface OptionStrikeSignalTableProps {
  strikeChain?: StrikeRowSignal[];
  selectedIndex?: string;
  underlying?: number;
  r1?: number | null;
  r2?: number | null;
  s1?: number | null;
  s2?: number | null;
  onRowClick?: (strike: number, side: 'CE' | 'PE') => void;
}

// ─── Formatters (Defensively guarded against null/undefined/NaN) ───────────────

function fmtChgOi(v: number | undefined | null): { text: string; color: string } {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) {
    return { text: '—', color: 'text-gray-400' };
  }
  const sign = v > 0 ? '+' : '';
  const text = `${sign}${v.toLocaleString('en-IN')}`;
  if (v > 0) return { text, color: 'text-emerald-400 font-semibold' };
  if (v < 0) return { text, color: 'text-rose-400 font-semibold' };
  return { text: '0', color: 'text-gray-400' };
}

function fmtLtp(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVolume(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '—';
  // Volume represented as Volume / 10^5 (in Lakhs)
  const volInLakhs = v / 100000;
  return volInLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDelta(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(3)}`;
}

function fmtGamma(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '—';
  if (v !== 0 && Math.abs(v) < 0.0001) {
    return v.toFixed(5);
  }
  return v.toFixed(4);
}

function fmtTheta(v: number | undefined | null): string {
  if (v === undefined || v === null || typeof v !== 'number' || isNaN(v)) return '—';
  return v.toFixed(2);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const OptionStrikeSignalTable: React.FC<OptionStrikeSignalTableProps> = ({
  strikeChain = [],
  selectedIndex = 'NIFTY',
  underlying,
  r1: r1Raw,
  r2: r2Raw,
  s1: s1Raw,
  s2: s2Raw,
  onRowClick,
}) => {
  if (!strikeChain || !Array.isArray(strikeChain) || strikeChain.length === 0) {
    return null;
  }

  // ─── Enforce Correct R1/S1 Orientation ───────────────────────────────────
  // R1 = Resistance → HIGHER strike (above ATM, appears at top of chain)
  // S1 = Support    → LOWER  strike (below ATM, appears at bottom of chain)
  // If both values exist and are inverted (r1 < s1), swap them.
  let r1 = r1Raw;
  let r2 = r2Raw;
  let s1 = s1Raw;
  let s2 = s2Raw;
  if (
    r1 != null && s1 != null &&
    typeof r1 === 'number' && typeof s1 === 'number' &&
    !isNaN(r1) && !isNaN(s1) &&
    r1 < s1
  ) {
    // Swap: the higher value should be resistance (R1), lower = support (S1)
    r1 = s1Raw;
    s1 = r1Raw;
  }

  // Determine ATM strike dynamically from is_atm flag or closest to underlying

  // ─── Sort strike chain HIGH → LOW (Resistance top, Support bottom) ────────
  // Backend sends strikes low→high; we reverse so higher strikes (resistance/CE)
  // appear at top and lower strikes (support/PE) appear at bottom — standard option chain view.
  const sortedChain = useMemo(() => {
    return [...strikeChain].sort((a, b) => b.strike - a.strike);
  }, [strikeChain]);

  const atmStrike = useMemo(() => {
    if (sortedChain.length === 0) return null;
    const atmRow = sortedChain.find(r => r.is_atm);
    if (atmRow) return atmRow.strike;
    if (typeof underlying === 'number' && underlying > 0) {
      return sortedChain.reduce((prev, curr) =>
        Math.abs(curr.strike - underlying) < Math.abs(prev.strike - underlying) ? curr : prev
      ).strike;
    }
    // Fallback: middle element
    return sortedChain[Math.floor(sortedChain.length / 2)]?.strike ?? null;
  }, [sortedChain, underlying]);

  // Target R1 Strike in chain (exact or closest)
  const targetR1Strike = useMemo(() => {
    if (r1 === null || r1 === undefined || isNaN(r1)) return null;
    const exact = sortedChain.find(r => r.strike === r1);
    if (exact) return exact.strike;
    let nearest = sortedChain[0]?.strike ?? null;
    let minDiff = nearest !== null ? Math.abs(nearest - r1) : Infinity;
    for (const r of sortedChain) {
      const diff = Math.abs(r.strike - r1);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = r.strike;
      }
    }
    return nearest;
  }, [sortedChain, r1]);

  // Target S1 Strike in chain (exact or closest)
  const targetS1Strike = useMemo(() => {
    if (s1 === null || s1 === undefined || isNaN(s1)) return null;
    const exact = sortedChain.find(r => r.strike === s1);
    if (exact) return exact.strike;
    let nearest = sortedChain[0]?.strike ?? null;
    let minDiff = nearest !== null ? Math.abs(nearest - s1) : Infinity;
    for (const r of sortedChain) {
      const diff = Math.abs(r.strike - s1);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = r.strike;
      }
    }
    return nearest;
  }, [sortedChain, s1]);

  // Target R2 Strike in chain (exact or closest)
  const targetR2Strike = useMemo(() => {
    if (r2 === null || r2 === undefined || isNaN(r2)) return null;
    const exact = sortedChain.find(r => r.strike === r2);
    if (exact) return exact.strike;
    let nearest = sortedChain[0]?.strike ?? null;
    let minDiff = nearest !== null ? Math.abs(nearest - r2) : Infinity;
    for (const r of sortedChain) {
      const diff = Math.abs(r.strike - r2);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = r.strike;
      }
    }
    return nearest;
  }, [sortedChain, r2]);

  // Target S2 Strike in chain (exact or closest)
  const targetS2Strike = useMemo(() => {
    if (s2 === null || s2 === undefined || isNaN(s2)) return null;
    const exact = sortedChain.find(r => r.strike === s2);
    if (exact) return exact.strike;
    let nearest = sortedChain[0]?.strike ?? null;
    let minDiff = nearest !== null ? Math.abs(nearest - s2) : Infinity;
    for (const r of sortedChain) {
      const diff = Math.abs(r.strike - s2);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = r.strike;
      }
    }
    return nearest;
  }, [sortedChain, s2]);

  // Market crossing conditions:
  // - Resistance blinks till the market crosses that resistance (underlying rises to or above R1)
  // - Support blinks while market stays above support (underlying > S1)
  const effectiveR1 = targetR1Strike ?? r1;
  const effectiveS1 = targetS1Strike ?? s1;

  const hasCrossedResistance = typeof underlying === 'number' && typeof effectiveR1 === 'number' && underlying >= effectiveR1;
  const isResistanceBlinking = !hasCrossedResistance;

  const hasCrossedSupport = typeof underlying === 'number' && typeof effectiveS1 === 'number' && underlying <= effectiveS1;
  const isSupportBlinking = !hasCrossedSupport;

  // ─── Column Min and Max Calculations (Evaluated on every fetch) ─────────────
  const columnStats = useMemo(() => {
    const peChgOi: number[] = [];
    const peLtp: number[] = [];
    const peVol: number[] = [];
    const peTheta: number[] = [];
    const peGamma: number[] = [];
    const peDelta: number[] = [];

    const ceDelta: number[] = [];
    const ceGamma: number[] = [];
    const ceTheta: number[] = [];
    const ceVol: number[] = [];
    const ceLtp: number[] = [];
    const ceChgOi: number[] = [];

    for (const row of sortedChain) {
      if (!row) continue;
      // PE side
      const peChg = row.pe?.change_oi ?? row.pe?.chg_oi;
      if (typeof peChg === 'number' && !isNaN(peChg)) peChgOi.push(peChg);
      if (typeof row.pe?.ltp === 'number' && !isNaN(row.pe.ltp)) peLtp.push(row.pe.ltp);
      if (typeof row.pe?.volume === 'number' && !isNaN(row.pe.volume)) peVol.push(row.pe.volume);
      if (typeof row.pe?.theta === 'number' && !isNaN(row.pe.theta)) peTheta.push(row.pe.theta);
      if (typeof row.pe?.gamma === 'number' && !isNaN(row.pe.gamma)) peGamma.push(row.pe.gamma);
      // For Put Delta, calculate using magnitude (|delta|) so highest magnitude (deep ITM) is marked max
      if (typeof row.pe?.delta === 'number' && !isNaN(row.pe.delta)) peDelta.push(Math.abs(row.pe.delta));

      // CE side
      const ceChg = row.ce?.change_oi ?? row.ce?.chg_oi;
      if (typeof ceChg === 'number' && !isNaN(ceChg)) ceChgOi.push(ceChg);
      if (typeof row.ce?.ltp === 'number' && !isNaN(row.ce.ltp)) ceLtp.push(row.ce.ltp);
      if (typeof row.ce?.volume === 'number' && !isNaN(row.ce.volume)) ceVol.push(row.ce.volume);
      if (typeof row.ce?.theta === 'number' && !isNaN(row.ce.theta)) ceTheta.push(row.ce.theta);
      if (typeof row.ce?.gamma === 'number' && !isNaN(row.ce.gamma)) ceGamma.push(row.ce.gamma);
      if (typeof row.ce?.delta === 'number' && !isNaN(row.ce.delta)) ceDelta.push(row.ce.delta);
    }

    const calcMinMax = (arr: number[]) => {
      if (arr.length === 0) return { min: null, max: null };
      return {
        min: Math.min(...arr),
        max: Math.max(...arr),
      };
    };

    return {
      pe: {
        chg_oi: calcMinMax(peChgOi),
        ltp: calcMinMax(peLtp),
        volume: calcMinMax(peVol),
        theta: { min: null, max: null },
        gamma: { min: null, max: null },
        delta: { min: null, max: null },
      },
      ce: {
        delta: { min: null, max: null },
        gamma: { min: null, max: null },
        theta: { min: null, max: null },
        volume: calcMinMax(ceVol),
        ltp: calcMinMax(ceLtp),
        chg_oi: calcMinMax(ceChgOi),
      },
    };
  }, [sortedChain]);

  // ─── Max CE Delta Strike (from 3 strikes BELOW ATM) ─────────────────────────
  // sortedChain is HIGH→LOW, so strikes below ATM are at indices AFTER the ATM row.
  const maxCeDeltaStrike = useMemo(() => {
    if (atmStrike === null || sortedChain.length === 0) return null;
    const atmIdx = sortedChain.findIndex(r => r.strike === atmStrike);
    if (atmIdx === -1 || atmIdx >= sortedChain.length - 1) return null;

    let maxVal = -Infinity;
    let maxStrike: number | null = null;
    // 3 strikes below ATM = indices (atmIdx + 1)..(atmIdx + 3) in high→low sort
    const endIdx = Math.min(sortedChain.length - 1, atmIdx + 3);
    for (let i = atmIdx + 1; i <= endIdx; i++) {
      const row = sortedChain[i];
      const delta = row?.ce?.delta;
      if (typeof delta === 'number' && !isNaN(delta) && delta > maxVal) {
        maxVal = delta;
        maxStrike = row.strike;
      }
    }
    return maxStrike;
  }, [sortedChain, atmStrike]);

  // ─── Max |PE Delta| Strike (from 3 strikes ABOVE ATM) ──────────────────────
  // sortedChain is HIGH→LOW, so strikes above ATM are at indices BEFORE the ATM row.
  const maxPeDeltaStrike = useMemo(() => {
    if (atmStrike === null || sortedChain.length === 0) return null;
    const atmIdx = sortedChain.findIndex(r => r.strike === atmStrike);
    if (atmIdx <= 0) return null;

    let maxMag = -Infinity;
    let maxStrike: number | null = null;
    // 3 strikes above ATM = indices (atmIdx - 1)..(atmIdx - 3) in high→low sort
    const startIdx = Math.max(0, atmIdx - 3);
    for (let i = atmIdx - 1; i >= startIdx; i--) {
      const row = sortedChain[i];
      const delta = row?.pe?.delta;
      if (typeof delta === 'number' && !isNaN(delta) && Math.abs(delta) > maxMag) {
        maxMag = Math.abs(delta);
        maxStrike = row.strike;
      }
    }
    return maxStrike;
  }, [sortedChain, atmStrike]);

  // ─── Max PE Gamma Strike (Unique strike nearest to ATM if ties exist) ────────
  const maxPeGammaStrike = useMemo(() => {
    if (sortedChain.length === 0) return null;
    let maxVal = -Infinity;
    for (const row of sortedChain) {
      const g = row.pe?.gamma;
      if (typeof g === 'number' && !isNaN(g) && g > maxVal) {
        maxVal = g;
      }
    }
    if (maxVal <= 0 || maxVal === -Infinity) return null;

    // Collect all strikes that share the highest gamma value
    const candidateStrikes: number[] = [];
    for (const row of sortedChain) {
      const g = row.pe?.gamma;
      if (typeof g === 'number' && !isNaN(g) && Math.abs(g - maxVal) < 0.000005) {
        candidateStrikes.push(row.strike);
      }
    }

    if (candidateStrikes.length === 0) return null;
    if (candidateStrikes.length === 1) return candidateStrikes[0];

    // If highest value found in many cells, choose the one closest to ATM
    const targetAtm = atmStrike ?? underlying ?? candidateStrikes[0];
    return candidateStrikes.reduce((closest, curr) => {
      const currDist = Math.abs(curr - targetAtm);
      const closestDist = Math.abs(closest - targetAtm);
      return currDist < closestDist ? curr : closest;
    }, candidateStrikes[0]);
  }, [sortedChain, atmStrike, underlying]);

  // ─── Max CE Gamma Strike (Unique strike nearest to ATM if ties exist) ────────
  const maxCeGammaStrike = useMemo(() => {
    if (sortedChain.length === 0) return null;
    let maxVal = -Infinity;
    for (const row of sortedChain) {
      const g = row.ce?.gamma;
      if (typeof g === 'number' && !isNaN(g) && g > maxVal) {
        maxVal = g;
      }
    }
    if (maxVal <= 0 || maxVal === -Infinity) return null;

    // Collect all strikes that share the highest gamma value
    const candidateStrikes: number[] = [];
    for (const row of sortedChain) {
      const g = row.ce?.gamma;
      if (typeof g === 'number' && !isNaN(g) && Math.abs(g - maxVal) < 0.000005) {
        candidateStrikes.push(row.strike);
      }
    }

    if (candidateStrikes.length === 0) return null;
    if (candidateStrikes.length === 1) return candidateStrikes[0];

    // If highest value found in many cells, choose the one closest to ATM
    const targetAtm = atmStrike ?? underlying ?? candidateStrikes[0];
    return candidateStrikes.reduce((closest, curr) => {
      const currDist = Math.abs(curr - targetAtm);
      const closestDist = Math.abs(closest - targetAtm);
      return currDist < closestDist ? curr : closest;
    }, candidateStrikes[0]);
  }, [sortedChain, atmStrike, underlying]);

  // Helper to determine cell background based on column min/max, row highlight, or default
  const getCellBg = (
    val: number | undefined | null,
    minMax: { min: number | null; max: number | null },
    defaultBg: string,
    isRowHighlighted: boolean,
    rowHighlightBg: string,
    useMagnitude: boolean = false
  ): { bgClass: string; title?: string } => {
    if (val !== undefined && val !== null && typeof val === 'number' && !isNaN(val)) {
      if (minMax.max !== null && minMax.min !== null && minMax.max !== minMax.min) {
        const compareVal = useMagnitude ? Math.abs(val) : val;
        if (Math.abs(compareVal - minMax.max) < 0.00001 || compareVal === minMax.max) {
          // Highest in column -> Parrot green fill
          return {
            bgClass: 'bg-lime-500/35 text-lime-100 font-bold shadow-inner border border-lime-400/40',
            title: `Highest in column: ${val >= 100000 ? `${(val / 100000).toFixed(2)} (10⁵)` : val}`,
          };
        }
        // Removed lowest/min marking as requested
      }
    }
    return {
      bgClass: isRowHighlighted ? rowHighlightBg : defaultBg,
    };
  };

  const spotDisplay = typeof underlying === 'number' && underlying > 0
    ? underlying.toFixed(2)
    : null;

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700/80 shadow-2xl mb-6 overflow-hidden">
      {/* Component-level Animation Styles (Fallback to ensure blinking runs in all setups) */}
      <style>{`
        @keyframes tb-resistance-blink {
          0%, 100% {
            border-color: rgba(249, 115, 22, 1);
            box-shadow: inset 0 0 10px rgba(249, 115, 22, 0.45), 0 0 12px rgba(249, 115, 22, 0.6);
          }
          50% {
            border-color: rgba(249, 115, 22, 0.25);
            box-shadow: inset 0 0 2px rgba(249, 115, 22, 0.05), 0 0 2px rgba(249, 115, 22, 0.05);
          }
        }
        @keyframes tb-support-blink {
          0%, 100% {
            border-color: rgba(59, 130, 246, 1);
            box-shadow: inset 0 0 10px rgba(59, 130, 246, 0.45), 0 0 12px rgba(59, 130, 246, 0.6);
          }
          50% {
            border-color: rgba(59, 130, 246, 0.25);
            box-shadow: inset 0 0 2px rgba(59, 130, 246, 0.05), 0 0 2px rgba(59, 130, 246, 0.05);
          }
        }
        .blink-resistance {
          animation: tb-resistance-blink 1.2s ease-in-out infinite !important;
        }
        .blink-support {
          animation: tb-support-blink 1.2s ease-in-out infinite !important;
        }
      `}</style>

      {/* Header bar with Index, Spot Price, Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-700/80">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="text-base font-bold text-white tracking-wide">
                Options Strike Signal Chain (21 Strikes)
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              PE (Left) — Strike Price (Center) — CE (Right) | Live Current Values
            </p>
          </div>
        </div>

        {/* Legend & Spot / Pivot Badges */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {spotDisplay && (
            <span className="text-gray-300 font-mono text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700">
              Spot: <span className="text-emerald-400 font-bold">{spotDisplay}</span>
            </span>
          )}
          {atmStrike !== null && (
            <span className="text-gray-300 font-mono text-xs px-2.5 py-1 rounded bg-gray-800 border border-gray-700">
              ATM: <span className="text-yellow-300 font-bold">{atmStrike.toLocaleString('en-IN')}</span>
            </span>
          )}
          {targetR1Strike !== null && (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${
              isResistanceBlinking 
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-sm' 
                : 'bg-gray-800 text-gray-400 border-gray-600'
            }`}>
              <span className={`h-2 w-2 rounded-full bg-orange-500 ${isResistanceBlinking ? 'animate-ping' : ''}`} />
              R1 CE: {targetR1Strike} {hasCrossedResistance ? '(Crossed)' : ''}
            </span>
          )}
          {targetR2Strike !== null && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border bg-amber-500/15 text-amber-300 border-amber-500/40">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              R2 CE: {targetR2Strike}
            </span>
          )}
          {targetS1Strike !== null && (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${
              isSupportBlinking 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-sm' 
                : 'bg-gray-800 text-gray-400 border-gray-600'
            }`}>
              <span className={`h-2 w-2 rounded-full bg-blue-500 ${isSupportBlinking ? 'animate-ping' : ''}`} />
              S1 PE: {targetS1Strike} {hasCrossedSupport ? '(Crossed)' : ''}
            </span>
          )}
          {targetS2Strike !== null && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border bg-cyan-500/15 text-cyan-300 border-cyan-500/40">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              S2 PE: {targetS2Strike}
            </span>
          )}

          {/* Color Indicator Legend */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-700 text-xs font-mono">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-lime-500/35 text-lime-200 border border-lime-400/40 font-bold">
              High (Parrot Green)
            </span>
          </div>

          <span className="px-2.5 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
            {selectedIndex}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/70">
        <table className="w-full text-center text-xs sm:text-[13px] border-collapse">
          <thead>
            {/* Top Header Group: PE vs STRIKE vs CE */}
            <tr className="bg-gray-950 text-gray-200 font-bold uppercase text-xs tracking-wider">
              <th colSpan={6} className="py-2.5 px-2 text-orange-400 border-b-2 border-orange-500/50 border-r-2 border-gray-700 bg-orange-950/25">
                PUT OPTIONS (PE)
              </th>
              <th className="py-2.5 px-4 text-yellow-300 border-b-2 border-yellow-500/50 bg-yellow-950/25 min-w-[130px]">
                STRIKE PRICE
              </th>
              <th colSpan={6} className="py-2.5 px-2 text-blue-400 border-b-2 border-blue-500/50 border-l-2 border-gray-700 bg-blue-950/25">
                CALL OPTIONS (CE)
              </th>
            </tr>
            {/* Column Metrics Header */}
            <tr className="bg-gray-950/95 text-[11px] sm:text-xs font-bold text-gray-300 border-b border-gray-700 tracking-wider">
              <th className="py-2.5 px-2.5 text-right">CHG OI</th>
              <th className="py-2.5 px-2.5 text-right">LTP</th>
              <th className="py-2.5 px-2.5 text-right" title="Volume / 10⁵ (in Lakhs)">VOLUME (10⁵)</th>
              <th className="py-2.5 px-2.5 text-right">THETA</th>
              <th className="py-2.5 px-2.5 text-right">GAMMA</th>
              <th className="py-2.5 px-2.5 text-right border-r-2 border-gray-700">DELTA</th>

              <th className="py-2.5 px-3 text-yellow-400 text-center font-extrabold bg-gray-900">
                STRIKE (TYPE)
              </th>

              <th className="py-2.5 px-2.5 text-left border-l-2 border-gray-700">DELTA</th>
              <th className="py-2.5 px-2.5 text-left">GAMMA</th>
              <th className="py-2.5 px-2.5 text-left">THETA</th>
              <th className="py-2.5 px-2.5 text-left" title="Volume / 10⁵ (in Lakhs)">VOLUME (10⁵)</th>
              <th className="py-2.5 px-2.5 text-left">LTP</th>
              <th className="py-2.5 px-2.5 text-left">CHG OI</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800/80 font-mono text-xs sm:text-[13px]">
            {sortedChain.map((row) => {
              if (!row || typeof row.strike !== 'number') return null;

              const isAtm = (atmStrike !== null && row.strike === atmStrike) || !!row.is_atm;

              // Row identification for Resistance (R1, R2) and Support (S1, S2)
              const isR1Row = targetR1Strike !== null && row.strike === targetR1Strike;
              const isR2Row = targetR2Strike !== null && row.strike === targetR2Strike && !isR1Row;
              const isS1Row = targetS1Strike !== null && row.strike === targetS1Strike;
              const isS2Row = targetS2Strike !== null && row.strike === targetS2Strike && !isS1Row;

              const isPeHighlighted = isS1Row || isS2Row;
              const isCeHighlighted = isR1Row || isR2Row;

              // ITM vs OTM determinations
              // PUT (PE): In The Money when Strike > ATM (market is below strike)
              const isPeItm = atmStrike !== null && row.strike > atmStrike;

              // CALL (CE): In The Money when Strike < ATM (market is above strike)
              const isCeItm = atmStrike !== null && row.strike < atmStrike;

              // Base default backgrounds
              const peDefaultBg = isAtm
                ? 'bg-yellow-500/15'
                : isPeItm
                ? 'bg-gray-950 text-gray-200'
                : 'bg-slate-700/40 text-slate-100';

              const ceDefaultBg = isAtm
                ? 'bg-yellow-500/15'
                : isCeItm
                ? 'bg-gray-950 text-gray-200'
                : 'bg-slate-700/40 text-slate-100';

              const peRowHighlightBg = isS1Row ? 'bg-blue-950/40 text-blue-200' : 'bg-cyan-950/30 text-cyan-200';
              const ceRowHighlightBg = isR1Row ? 'bg-orange-950/40 text-orange-200' : 'bg-amber-950/30 text-amber-200';

              // Extract values for PE and CE columns
              const peChgOiVal = row.pe?.change_oi ?? row.pe?.chg_oi;
              const peLtpVal = row.pe?.ltp;
              const peVolVal = row.pe?.volume;
              const peThetaVal = row.pe?.theta;
              const peGammaVal = row.pe?.gamma;
              const peDeltaVal = row.pe?.delta;

              const ceDeltaVal = row.ce?.delta;
              const ceGammaVal = row.ce?.gamma;
              const ceThetaVal = row.ce?.theta;
              const ceVolVal = row.ce?.volume;
              const ceLtpVal = row.ce?.ltp;
              const ceChgOiVal = row.ce?.change_oi ?? row.ce?.chg_oi;

              // Formatted text
              const peChgOi = fmtChgOi(peChgOiVal);
              const ceChgOi = fmtChgOi(ceChgOiVal);
              const peLtp = fmtLtp(peLtpVal);
              const ceLtp = fmtLtp(ceLtpVal);
              const peVolume = fmtVolume(peVolVal);
              const ceVolume = fmtVolume(ceVolVal);
              const peTheta = fmtTheta(peThetaVal);
              const ceTheta = fmtTheta(ceThetaVal);
              const peGamma = fmtGamma(peGammaVal);
              const ceGamma = fmtGamma(ceGammaVal);
              const peDelta = fmtDelta(peDeltaVal);
              const ceDelta = fmtDelta(ceDeltaVal);

              // ─── Column Min / Max Evaluation for Cells ───
              const peChgCell = getCellBg(peChgOiVal, columnStats.pe.chg_oi, peDefaultBg, isPeHighlighted, peRowHighlightBg);
              const peLtpCell = getCellBg(peLtpVal, columnStats.pe.ltp, peDefaultBg, isPeHighlighted, peRowHighlightBg);
              const peVolCell = getCellBg(peVolVal, columnStats.pe.volume, peDefaultBg, isPeHighlighted, peRowHighlightBg);
              const peThetaCell = { bgClass: isPeHighlighted ? peRowHighlightBg : peDefaultBg };

              // PE Gamma: highlight green only if this strike is max PE Gamma (closest to ATM if ties)
              const peGammaIsMax = maxPeGammaStrike !== null && row.strike === maxPeGammaStrike;
              const peGammaCell = peGammaIsMax
                ? { bgClass: 'bg-lime-500/35 text-lime-100 font-bold shadow-inner border border-lime-400/40', title: `Max PE Gamma (nearest to ATM)` }
                : { bgClass: isPeHighlighted ? peRowHighlightBg : peDefaultBg };

              // PE Delta: highlight green only if this strike has max |delta| among 3 strikes above ATM
              const peDeltaIsMax = maxPeDeltaStrike !== null && row.strike === maxPeDeltaStrike;
              const peDeltaCell = peDeltaIsMax
                ? { bgClass: 'bg-lime-500/35 text-lime-100 font-bold shadow-inner border border-lime-400/40', title: `Max |PE Delta| in 3 strikes above ATM` }
                : { bgClass: isPeHighlighted ? peRowHighlightBg : peDefaultBg };

              // CE Delta: highlight green only if this strike has max CE delta among 3 strikes below ATM
              const ceDeltaIsMax = maxCeDeltaStrike !== null && row.strike === maxCeDeltaStrike;
              const ceDeltaCell = ceDeltaIsMax
                ? { bgClass: 'bg-lime-500/35 text-lime-100 font-bold shadow-inner border border-lime-400/40', title: `Max CE Delta in 3 strikes below ATM` }
                : { bgClass: isCeHighlighted ? ceRowHighlightBg : ceDefaultBg };

              // CE Gamma: highlight green only if this strike is max CE Gamma (closest to ATM if ties)
              const ceGammaIsMax = maxCeGammaStrike !== null && row.strike === maxCeGammaStrike;
              const ceGammaCell = ceGammaIsMax
                ? { bgClass: 'bg-lime-500/35 text-lime-100 font-bold shadow-inner border border-lime-400/40', title: `Max CE Gamma (nearest to ATM)` }
                : { bgClass: isCeHighlighted ? ceRowHighlightBg : ceDefaultBg };
              const ceThetaCell = { bgClass: isCeHighlighted ? ceRowHighlightBg : ceDefaultBg };
              const ceVolCell = getCellBg(ceVolVal, columnStats.ce.volume, ceDefaultBg, isCeHighlighted, ceRowHighlightBg);
              const ceLtpCell = getCellBg(ceLtpVal, columnStats.ce.ltp, ceDefaultBg, isCeHighlighted, ceRowHighlightBg);
              const ceChgCell = getCellBg(ceChgOiVal, columnStats.ce.chg_oi, ceDefaultBg, isCeHighlighted, ceRowHighlightBg);

              // ─── Border Classes for S1/S2 (Support - Blue/Cyan) and R1/R2 (Resistance - Orange/Amber) ─────────
              const s1BlinkClass = isSupportBlinking ? 'blink-support' : '';
              const r1BlinkClass = isResistanceBlinking ? 'blink-resistance' : '';

              // PE side border classes
              const peBorderTopBottom = isS1Row
                ? `border-t-[3px] border-b-[3px] border-blue-500 ${s1BlinkClass}`
                : isS2Row
                ? 'border-t-2 border-b-2 border-cyan-500/60'
                : '';
              const peLeftmostBorder = isS1Row
                ? `border-t-[3px] border-b-[3px] border-l-[3px] border-blue-500 ${s1BlinkClass}`
                : isS2Row
                ? 'border-t-2 border-b-2 border-l-2 border-cyan-500/60'
                : '';

              // CE side border classes
              const ceBorderTopBottom = isR1Row
                ? `border-t-[3px] border-b-[3px] border-orange-500 ${r1BlinkClass}`
                : isR2Row
                ? 'border-t-2 border-b-2 border-amber-500/60'
                : '';
              const ceRightmostBorder = isR1Row
                ? `border-t-[3px] border-b-[3px] border-r-[3px] border-orange-500 ${r1BlinkClass}`
                : isR2Row
                ? 'border-t-2 border-b-2 border-r-2 border-amber-500/60'
                : '';

              // Strike cell border classes
              let strikeBorderClass = '';
              if (isS1Row && isR1Row) {
                strikeBorderClass = `border-t-[3px] border-b-[3px] border-l-[3px] border-blue-500 border-r-[3px] border-orange-500 ${s1BlinkClass} ${r1BlinkClass}`;
              } else if (isS1Row) {
                strikeBorderClass = `border-t-[3px] border-b-[3px] border-r-[3px] border-blue-500 ${s1BlinkClass}`;
              } else if (isR1Row) {
                strikeBorderClass = `border-t-[3px] border-b-[3px] border-l-[3px] border-orange-500 ${r1BlinkClass}`;
              } else if (isS2Row && isR2Row) {
                strikeBorderClass = 'border-t-2 border-b-2 border-l-2 border-cyan-500/60 border-r-2 border-amber-500/60';
              } else if (isS2Row) {
                strikeBorderClass = 'border-t-2 border-b-2 border-r-2 border-cyan-500/60';
              } else if (isR2Row) {
                strikeBorderClass = 'border-t-2 border-b-2 border-l-2 border-amber-500/60';
              }

              // Strike cell background
              const strikeBgClass = isAtm
                ? 'bg-yellow-500/25 text-yellow-300 font-extrabold border-y-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.25)]'
                : isR1Row
                ? 'bg-orange-950/60 text-yellow-300 font-bold'
                : isR2Row
                ? 'bg-amber-950/50 text-yellow-300 font-bold'
                : isS1Row
                ? 'bg-blue-950/60 text-yellow-300 font-bold'
                : isS2Row
                ? 'bg-cyan-950/50 text-yellow-300 font-bold'
                : 'bg-gray-900 text-yellow-300/90 font-bold';

              // Click handler helpers
              const peClick = onRowClick ? () => onRowClick(row.strike, 'PE') : undefined;
              const ceClick = onRowClick ? () => onRowClick(row.strike, 'CE') : undefined;
              const peClickClass = onRowClick ? 'cursor-pointer hover:brightness-125' : '';
              const ceClickClass = onRowClick ? 'cursor-pointer hover:brightness-125' : '';

              return (
                <tr
                  key={row.strike}
                  className={`transition-colors ${isAtm ? 'font-semibold' : ''}`}
                >
                  {/* ── PE Side (5 Columns) — click to open PE VWAP chart ── */}
                  {/* 1. PE CHG OI (Leftmost column) */}
                  <td
                    className={`py-2 px-2.5 text-right font-semibold transition-colors ${peClickClass} ${peChgCell.bgClass} ${peLeftmostBorder}`}
                    title={peChgCell.title ?? (onRowClick ? 'Click to view PE VWAP chart' : undefined)}
                    onClick={peClick}
                  >
                    <span className={peChgOi.color}>{peChgOi.text}</span>
                  </td>

                  {/* 2. PE LTP */}
                  <td
                    className={`py-2 px-2.5 text-right font-semibold text-white transition-colors ${peClickClass} ${peLtpCell.bgClass} ${peBorderTopBottom}`}
                    title={peLtpCell.title ?? (onRowClick ? 'Click to view PE VWAP chart' : undefined)}
                    onClick={peClick}
                  >
                    {peLtp}
                  </td>

                  {/* 3. PE VOLUME */}
                  <td
                    className={`py-2 px-2.5 text-right font-medium text-gray-200 transition-colors ${peClickClass} ${peVolCell.bgClass} ${peBorderTopBottom}`}
                    title={peVolCell.title ?? (onRowClick ? 'Click to view PE VWAP chart' : undefined)}
                    onClick={peClick}
                  >
                    {peVolume}
                  </td>

                  {/* 4. PE THETA */}
                  <td
                    className={`py-2 px-2.5 text-right font-medium text-gray-300 transition-colors ${peClickClass} ${peThetaCell.bgClass} ${peBorderTopBottom}`}
                    onClick={peClick}
                  >
                    {peTheta}
                  </td>

                  {/* 5. PE GAMMA */}
                  <td
                    className={`py-2 px-2.5 text-right font-medium text-gray-300 transition-colors ${peClickClass} ${peGammaCell.bgClass} ${peBorderTopBottom}`}
                    title={peGammaCell.title ?? (onRowClick ? 'Click to view PE VWAP chart' : undefined)}
                    onClick={peClick}
                  >
                    {peGamma}
                  </td>

                  {/* 6. PE DELTA (Adjacent to Strike) */}
                  <td
                    className={`py-2 px-2.5 text-right font-medium text-gray-200 border-r-2 border-gray-700 transition-colors ${peClickClass} ${peDeltaCell.bgClass} ${peBorderTopBottom}`}
                    title={peDeltaCell.title ?? (onRowClick ? 'Click to view PE VWAP chart' : undefined)}
                    onClick={peClick}
                  >
                    {peDelta}
                  </td>

                  {/* ── Center Strike Price ── */}
                  <td
                    className={`py-2 px-3 text-center transition-colors ${strikeBgClass} ${strikeBorderClass} ${onRowClick ? 'cursor-pointer hover:brightness-125' : ''}`}
                    title={onRowClick ? `Click to view VWAP & Candlestick chart for strike ${row.strike}` : undefined}
                    onClick={() => onRowClick?.(row.strike, isCeItm ? 'CE' : isPeItm ? 'PE' : 'CE')}
                  >
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="text-sm sm:text-base font-extrabold">{row.strike.toLocaleString('en-IN')}</span>

                      {/* R1 Badge (Orange) */}
                      {isR1Row && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase flex items-center gap-1 ${
                            isResistanceBlinking
                              ? 'bg-orange-600 text-white shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                              : 'bg-orange-950 text-orange-300 border border-orange-700'
                          }`}
                          title={hasCrossedResistance ? 'Resistance Crossed by Market' : 'Active R1 Resistance'}
                        >
                          <span>R1</span>
                          {isResistanceBlinking && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          )}
                        </span>
                      )}

                      {/* R2 Badge (Amber) */}
                      {isR2Row && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-extrabold uppercase flex items-center gap-1 bg-amber-950 text-amber-300 border border-amber-600"
                          title="R2 Resistance"
                        >
                          <span>R2</span>
                        </span>
                      )}

                      {/* S1 Badge (Blue) */}
                      {isS1Row && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase flex items-center gap-1 ${
                            isSupportBlinking
                              ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                              : 'bg-blue-950 text-blue-300 border border-blue-700'
                          }`}
                          title={hasCrossedSupport ? 'Support Crossed by Market' : 'Active S1 Support'}
                        >
                          <span>S1</span>
                          {isSupportBlinking && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          )}
                        </span>
                      )}

                      {/* S2 Badge (Cyan) */}
                      {isS2Row && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-extrabold uppercase flex items-center gap-1 bg-cyan-950 text-cyan-300 border border-cyan-600"
                          title="S2 Support"
                        >
                          <span>S2</span>
                        </span>
                      )}

                      {/* ATM Badge */}
                      {isAtm && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase bg-yellow-400 text-gray-950 shadow-sm">
                          ATM
                        </span>
                      )}

                      {/* ITM Badges if not R1/R2/S1/S2/ATM */}
                      {!isAtm && !isR1Row && !isR2Row && !isS1Row && !isS2Row && (
                        isPeItm ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold text-orange-400/90 bg-orange-950/40 border border-orange-800/40">
                            PE-ITM
                          </span>
                        ) : isCeItm ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold text-blue-400/90 bg-blue-950/40 border border-blue-800/40">
                            CE-ITM
                          </span>
                        ) : null
                      )}
                    </div>
                  </td>

                  {/* ── CE Side (6 Columns) — click to open CE VWAP chart ── */}
                  {/* 1. CE DELTA (Adjacent to Strike) */}
                  <td
                    className={`py-2 px-2.5 text-left font-medium text-gray-200 border-l-2 border-gray-700 transition-colors ${ceClickClass} ${ceDeltaCell.bgClass} ${ceBorderTopBottom}`}
                    title={ceDeltaCell.title ?? (onRowClick ? 'Click to view CE VWAP chart' : undefined)}
                    onClick={ceClick}
                  >
                    {ceDelta}
                  </td>

                  {/* 2. CE GAMMA */}
                  <td
                    className={`py-2 px-2.5 text-left font-medium text-gray-300 transition-colors ${ceClickClass} ${ceGammaCell.bgClass} ${ceBorderTopBottom}`}
                    title={ceGammaCell.title ?? (onRowClick ? 'Click to view CE VWAP chart' : undefined)}
                    onClick={ceClick}
                  >
                    {ceGamma}
                  </td>

                  {/* 3. CE THETA */}
                  <td
                    className={`py-2 px-2.5 text-left font-medium text-gray-300 transition-colors ${ceClickClass} ${ceThetaCell.bgClass} ${ceBorderTopBottom}`}
                    onClick={ceClick}
                  >
                    {ceTheta}
                  </td>

                  {/* 4. CE VOLUME */}
                  <td
                    className={`py-2 px-2.5 text-left font-medium text-gray-200 transition-colors ${ceClickClass} ${ceVolCell.bgClass} ${ceBorderTopBottom}`}
                    title={ceVolCell.title ?? (onRowClick ? 'Click to view CE VWAP chart' : undefined)}
                    onClick={ceClick}
                  >
                    {ceVolume}
                  </td>

                  {/* 5. CE LTP */}
                  <td
                    className={`py-2 px-2.5 text-left font-semibold text-white transition-colors ${ceClickClass} ${ceLtpCell.bgClass} ${ceBorderTopBottom}`}
                    title={ceLtpCell.title ?? (onRowClick ? 'Click to view CE VWAP chart' : undefined)}
                    onClick={ceClick}
                  >
                    {ceLtp}
                  </td>

                  {/* 6. CE CHG OI (Rightmost column) */}
                  <td
                    className={`py-2 px-2.5 text-left font-semibold transition-colors ${ceClickClass} ${ceChgCell.bgClass} ${ceRightmostBorder}`}
                    title={ceChgCell.title ?? (onRowClick ? 'Click to view CE VWAP chart' : undefined)}
                    onClick={ceClick}
                  >
                    <span className={ceChgOi.color}>{ceChgOi.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OptionStrikeSignalTable;
