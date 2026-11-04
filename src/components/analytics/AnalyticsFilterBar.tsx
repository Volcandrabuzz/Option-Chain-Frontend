import React from 'react';
import { RefreshCw, Clock, Activity, Calendar, SlidersHorizontal } from 'lucide-react';

interface AnalyticsFilterBarProps {
  indices: string[];
  selectedIndex: string;
  onSelectIndex: (index: string) => void;
  expiries: string[];
  selectedExpiry: string;
  onSelectExpiry: (expiry: string) => void;
  timeframes: string[];
  selectedTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  selectedSide: 'CE' | 'PE';
  onSelectSide: (side: 'CE' | 'PE') => void;
  timestamp: string;
  isMarketHours: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  indices,
  selectedIndex,
  onSelectIndex,
  expiries,
  selectedExpiry,
  onSelectExpiry,
  timeframes,
  selectedTimeframe,
  onSelectTimeframe,
  selectedSide,
  onSelectSide,
  timestamp,
  isMarketHours,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg mb-4 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Section: Underlying & Expiry */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Index Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Index:</span>
            <div className="flex items-center gap-1">
              {indices.map((idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectIndex(idx)}
                  className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                    selectedIndex === idx
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {idx}
                </button>
              ))}
            </div>
          </div>

          {/* Expiry Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-slate-400">Expiry:</span>
            <select
              value={selectedExpiry}
              onChange={(e) => onSelectExpiry(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer py-0.5"
            >
              {expiries.map((exp) => (
                <option key={exp} value={exp} className="bg-slate-900 text-slate-200">
                  {exp}
                </option>
              ))}
            </select>
          </div>

          {/* Side Selector (CE / PE) */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onSelectSide('CE')}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                selectedSide === 'CE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400/80 hover:bg-slate-800'
              }`}
            >
              CALLS (CE)
            </button>
            <button
              onClick={() => onSelectSide('PE')}
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${
                selectedSide === 'PE'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-400/80 hover:bg-slate-800'
              }`}
            >
              PUTS (PE)
            </button>
          </div>
        </div>

        {/* Right Section: Timeframe, Refresh & Market Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5" />
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-0.5 text-xs font-semibold rounded transition-all ${
                  selectedTimeframe === tf
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Market Status & Timestamp */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isMarketHours ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold text-slate-300">
                {isMarketHours ? 'LIVE MARKET' : 'CLOSED (NSE SNAPSHOT)'}
              </span>
            </div>
            {timestamp && timestamp !== 'N/A' && (
              <span className="text-[11px] text-slate-500 border-l border-slate-800 pl-2 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {timestamp}
              </span>
            )}
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-500/20`}
            title="Refresh Option Chain and Analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
};
