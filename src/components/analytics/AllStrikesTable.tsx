import React, { useState, useMemo } from 'react';
import {
  AllStrikesResponse,
  StrikeRow
} from '../../services/analyticsApi';
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Layers,
  Flame,
  Award,
  Zap,
  CheckSquare,
  Square
} from 'lucide-react';

interface AllStrikesTableProps {
  data: AllStrikesResponse | null;
  isLoading: boolean;
  onSelectStrikeForAnalysis: (strike: number, side: 'CE' | 'PE') => void;
  selectedComparisonStrikes: number[];
  onToggleComparisonStrike: (strike: number) => void;
}

export const AllStrikesTable: React.FC<AllStrikesTableProps> = ({
  data,
  isLoading,
  onSelectStrikeForAnalysis,
  selectedComparisonStrikes,
  onToggleComparisonStrike,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rangeFilter, setRangeFilter] = useState<'ALL' | 'ATM10' | 'ATM20'>('ALL');
  const [moneynessFilter, setMoneynessFilter] = useState<'ALL' | 'ITM' | 'OTM'>('ALL');
  const [sortField, setSortField] = useState<'strike' | 'ce_oi' | 'pe_oi' | 'ce_vol' | 'pe_vol' | 'ce_coi' | 'pe_coi'>('strike');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Formatter utilities
  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0';
    return val.toLocaleString('en-IN');
  };

  const formatPrice = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0.00';
    return val.toFixed(2);
  };

  // Filter & sort logic
  const filteredStrikes = useMemo(() => {
    if (!data?.strikes) return [];

    let list = [...data.strikes];

    // Range filter around ATM
    if (rangeFilter !== 'ALL' && data.atm_strike) {
      const atmIdx = list.findIndex((s) => s.strike === data.atm_strike);
      if (atmIdx !== -1) {
        const offset = rangeFilter === 'ATM10' ? 10 : 20;
        const start = Math.max(0, atmIdx - offset);
        const end = Math.min(list.length, atmIdx + offset + 1);
        list = list.slice(start, end);
      }
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((s) => String(s.strike).includes(q));
    }

    // Moneyness filter
    if (moneynessFilter !== 'ALL') {
      list = list.filter((s) => {
        if (moneynessFilter === 'ITM') return s.ce.moneyness === 'ITM' || s.pe.moneyness === 'ITM';
        if (moneynessFilter === 'OTM') return s.ce.moneyness === 'OTM' || s.pe.moneyness === 'OTM';
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      let vA = 0;
      let vB = 0;
      switch (sortField) {
        case 'strike':
          vA = a.strike;
          vB = b.strike;
          break;
        case 'ce_oi':
          vA = a.ce.open_interest;
          vB = b.ce.open_interest;
          break;
        case 'pe_oi':
          vA = a.pe.open_interest;
          vB = b.pe.open_interest;
          break;
        case 'ce_vol':
          vA = a.ce.volume;
          vB = b.ce.volume;
          break;
        case 'pe_vol':
          vA = a.pe.volume;
          vB = b.pe.volume;
          break;
        case 'ce_coi':
          vA = a.ce.change_oi;
          vB = b.ce.change_oi;
          break;
        case 'pe_coi':
          vA = a.pe.change_oi;
          vB = b.pe.change_oi;
          break;
        default:
          vA = a.strike;
          vB = b.strike;
      }
      return sortAsc ? vA - vB : vB - vA;
    });

    return list;
  }, [data, searchTerm, rangeFilter, moneynessFilter, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'strike');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-900 border border-slate-800 rounded-xl p-8">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-semibold text-sm">Ingesting All Strike Option Chain from NSE...</p>
        <p className="text-slate-500 text-xs mt-1">Processing Black-Scholes Greeks, OI distribution & Max Pain</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        No option chain data available. Select an index or click Refresh.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-200">
      {/* ================= Institutional Summary Dashboard ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Spot & ATM */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Spot / ATM</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-white">{formatPrice(data.spot_price)}</span>
            <span className="text-xs font-bold text-blue-400 bg-blue-950/70 border border-blue-800 px-1.5 py-0.5 rounded">
              ATM {data.atm_strike}
            </span>
          </div>
          {data.futures_price && (
            <div className="text-[11px] text-slate-400 mt-1">
              Fut: <span className="font-semibold text-slate-300">{formatPrice(data.futures_price)}</span>
            </div>
          )}
        </div>

        {/* Total OI & PCR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total OI & PCR</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-slate-200">PCR: {data.pcr_oi.toFixed(2)}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                data.pcr_oi > 1.0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {data.pcr_oi > 1.2 ? 'BULLISH' : data.pcr_oi < 0.8 ? 'BEARISH' : 'NEUTRAL'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
            <span className="text-emerald-400">CE: {formatNumber(data.total_ce_oi)}</span>
            <span className="text-rose-400">PE: {formatNumber(data.total_pe_oi)}</span>
          </div>
        </div>

        {/* Total Traded Volume */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Volume</div>
          <div className="text-base font-bold text-slate-200 mt-1">
            {formatNumber(data.total_ce_volume + data.total_pe_volume)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
            <span className="text-emerald-400">CE: {formatNumber(data.total_ce_volume)}</span>
            <span className="text-rose-400">PE: {formatNumber(data.total_pe_volume)}</span>
          </div>
        </div>

        {/* Max Pain Strike */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Max Pain</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-amber-400">{data.max_pain || 'N/A'}</span>
            <span className="text-[10px] text-slate-400">Expiry Target</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Diff to Spot: <span className="font-semibold text-slate-300">
              {data.max_pain ? `${(data.spot_price - data.max_pain).toFixed(1)} pts` : '—'}
            </span>
          </div>
        </div>

        {/* Max Open Interest Strikes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Highest OI Strikes</div>
          <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
            <span className="text-emerald-400 flex items-center gap-1">
              <Award className="w-3 h-3" /> CE {data.highest_ce_oi_strike || '—'}
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <Award className="w-3 h-3" /> PE {data.highest_pe_oi_strike || '—'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Key Resistance & Support</div>
        </div>

        {/* Max Change in OI Strikes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Max OI Change</div>
          <div className="text-xs font-bold text-slate-200 mt-1 flex items-center justify-between">
            <span className="text-emerald-400 flex items-center gap-1">
              <Flame className="w-3 h-3" /> CE {data.highest_ce_chg_oi_strike || '—'}
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <Flame className="w-3 h-3" /> PE {data.highest_pe_chg_oi_strike || '—'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Active Writing / Build-up</div>
        </div>
      </div>

      {/* ================= Quick Graphs Banner ================= */}
      <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs text-slate-200">
            <strong className="text-cyan-400">Want to see the quantitative graphs?</strong> Click any strike row in the table below or switch to{' '}
            <button
              onClick={() => onSelectStrikeForAnalysis(data.atm_strike || 24500, 'CE')}
              className="text-cyan-400 underline font-bold hover:text-cyan-300"
            >
              ATM Strike ({data.atm_strike || 24500}) 7-Chart Deep-Dive
            </button>
          </span>
        </div>
        <button
          onClick={() => onSelectStrikeForAnalysis(data.atm_strike || 24500, 'CE')}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-500/25 flex items-center gap-1.5 shrink-0"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>Open Strike Deep-Dive Graphs</span>
        </button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Strike (e.g. 24000)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 px-1">Strikes:</span>
          {(['ALL', 'ATM10', 'ATM20'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRangeFilter(r)}
              className={`px-2 py-0.5 text-xs font-bold rounded transition-all ${
                rangeFilter === r ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r === 'ALL' ? 'All Strikes' : r === 'ATM10' ? 'ATM ± 10' : 'ATM ± 20'}
            </button>
          ))}
        </div>

        {/* Moneyness Filter */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 px-1">Moneyness:</span>
          {(['ALL', 'ITM', 'OTM'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMoneynessFilter(m)}
              className={`px-2 py-0.5 text-xs font-bold rounded transition-all ${
                moneynessFilter === m ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Strikes count indicator */}
        <div className="text-xs text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-200">{filteredStrikes.length}</span> of {data.strikes.length} strikes
        </div>
      </div>

      {/* ================= All Strikes Option Chain Table ================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            {/* Top Super-Header */}
            <thead className="bg-slate-950 sticky top-0 z-20 border-b border-slate-800">
              <tr>
                <th colSpan={8} className="py-2 px-3 text-center text-xs font-black text-emerald-400 uppercase tracking-widest bg-emerald-950/30 border-r border-slate-800">
                  CALL OPTIONS (CE)
                </th>
                <th className="py-2 px-4 text-center text-xs font-black text-blue-400 uppercase tracking-widest bg-blue-950/40">
                  STRIKE
                </th>
                <th colSpan={8} className="py-2 px-3 text-center text-xs font-black text-rose-400 uppercase tracking-widest bg-rose-950/30 border-l border-slate-800">
                  PUT OPTIONS (PE)
                </th>
              </tr>
              {/* Column Sub-Header */}
              <tr className="bg-slate-950/90 text-slate-400 text-[11px] border-b border-slate-800">
                {/* CE Columns */}
                <th className="py-2 px-2 text-center w-8">Cmp</th>
                <th className="py-2 px-2 text-right">Delta</th>
                <th className="py-2 px-2 text-right">IV (%)</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ce_vol')}>
                  Vol <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ce_coi')}>
                  Chg OI <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('ce_oi')}>
                  OI <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>
                <th className="py-2 px-2 text-right">LTP Chg</th>
                <th className="py-2 px-2 text-right font-bold text-slate-200 border-r border-slate-800">LTP (₹)</th>

                {/* Strike Price Column */}
                <th className="py-2 px-3 text-center font-black text-blue-400 cursor-pointer hover:text-white" onClick={() => handleSort('strike')}>
                  STRIKE <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>

                {/* PE Columns */}
                <th className="py-2 px-2 text-left font-bold text-slate-200 border-l border-slate-800">LTP (₹)</th>
                <th className="py-2 px-2 text-left">LTP Chg</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('pe_oi')}>
                  OI <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('pe_coi')}>
                  Chg OI <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-white" onClick={() => handleSort('pe_vol')}>
                  Vol <ArrowUpDown className="w-2.5 h-2.5 inline" />
                </th>
                <th className="py-2 px-2 text-right">IV (%)</th>
                <th className="py-2 px-2 text-right">Delta</th>
                <th className="py-2 px-2 text-center w-8">Cmp</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredStrikes.map((row) => {
                const isSelected = selectedComparisonStrikes.includes(row.strike);
                const isATM = row.is_atm;

                // Color tint for ITM rows
                const ceBg = row.ce.moneyness === 'ITM' ? 'bg-amber-950/15' : '';
                const peBg = row.pe.moneyness === 'ITM' ? 'bg-amber-950/15' : '';
                const atmRowBg = isATM ? 'bg-blue-900/25 border-y-2 border-blue-500' : '';

                return (
                  <tr
                    key={row.strike}
                    className={`hover:bg-slate-800/70 transition-colors ${atmRowBg}`}
                  >
                    {/* Compare Checkbox */}
                    <td className={`py-1.5 px-2 text-center ${ceBg}`}>
                      <button
                        onClick={() => onToggleComparisonStrike(row.strike)}
                        title={isSelected ? 'Remove from comparison' : 'Add to multi-strike comparison'}
                        className="text-slate-400 hover:text-blue-400"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>
                    </td>

                    {/* CE Delta */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right text-slate-300 cursor-pointer ${ceBg}`}
                    >
                      {row.ce.delta.toFixed(2)}
                    </td>

                    {/* CE IV */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right text-slate-400 cursor-pointer ${ceBg}`}
                    >
                      {row.ce.iv > 0 ? `${row.ce.iv.toFixed(1)}%` : '—'}
                    </td>

                    {/* CE Volume */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right text-slate-300 cursor-pointer ${ceBg}`}
                    >
                      {row.strike === data.highest_volume_strike && (
                        <Zap className="w-2.5 h-2.5 text-amber-400 inline mr-1" />
                      )}
                      {formatNumber(row.ce.volume)}
                    </td>

                    {/* CE Change in OI */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right font-bold cursor-pointer ${ceBg} ${
                        row.ce.change_oi > 0 ? 'text-emerald-400' : row.ce.change_oi < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {row.strike === data.highest_ce_chg_oi_strike && (
                        <Flame className="w-2.5 h-2.5 text-amber-400 inline mr-1" />
                      )}
                      {row.ce.change_oi > 0 ? `+${formatNumber(row.ce.change_oi)}` : formatNumber(row.ce.change_oi)}
                    </td>

                    {/* CE Open Interest */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right text-slate-200 cursor-pointer ${ceBg}`}
                    >
                      {row.strike === data.highest_ce_oi_strike && (
                        <Award className="w-2.5 h-2.5 text-amber-400 inline mr-1" />
                      )}
                      {formatNumber(row.ce.open_interest)}
                    </td>

                    {/* CE LTP Change */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right font-medium cursor-pointer ${ceBg} ${
                        row.ce.change > 0 ? 'text-emerald-400' : row.ce.change < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {row.ce.change > 0 ? `+${formatPrice(row.ce.change)}` : formatPrice(row.ce.change)}
                    </td>

                    {/* CE LTP */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-2 text-right font-black text-emerald-400 border-r border-slate-800 cursor-pointer ${ceBg}`}
                    >
                      {formatPrice(row.ce.ltp)}
                    </td>

                    {/* STRIKE PRICE */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'CE')}
                      className={`py-1.5 px-3 text-center font-black cursor-pointer ${
                        isATM
                          ? 'text-white bg-blue-600/30 font-black text-sm'
                          : 'text-blue-300 hover:text-white bg-slate-950/60'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{row.strike}</span>
                        {isATM && (
                          <span className="text-[9px] font-bold bg-blue-500 text-white px-1 py-0.2 rounded uppercase">
                            ATM
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PE LTP */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-left font-black text-rose-400 border-l border-slate-800 cursor-pointer ${peBg}`}
                    >
                      {formatPrice(row.pe.ltp)}
                    </td>

                    {/* PE LTP Change */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-left font-medium cursor-pointer ${peBg} ${
                        row.pe.change > 0 ? 'text-emerald-400' : row.pe.change < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {row.pe.change > 0 ? `+${formatPrice(row.pe.change)}` : formatPrice(row.pe.change)}
                    </td>

                    {/* PE Open Interest */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-right text-slate-200 cursor-pointer ${peBg}`}
                    >
                      {row.strike === data.highest_pe_oi_strike && (
                        <Award className="w-2.5 h-2.5 text-amber-400 inline mr-1" />
                      )}
                      {formatNumber(row.pe.open_interest)}
                    </td>

                    {/* PE Change in OI */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-right font-bold cursor-pointer ${peBg} ${
                        row.pe.change_oi > 0 ? 'text-emerald-400' : row.pe.change_oi < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {row.strike === data.highest_pe_chg_oi_strike && (
                        <Flame className="w-2.5 h-2.5 text-amber-400 inline mr-1" />
                      )}
                      {row.pe.change_oi > 0 ? `+${formatNumber(row.pe.change_oi)}` : formatNumber(row.pe.change_oi)}
                    </td>

                    {/* PE Volume */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-right text-slate-300 cursor-pointer ${peBg}`}
                    >
                      {row.strike === data.highest_volume_strike && (
                        <Zap className="w-2.5 h-2.5 text-amber-400 inline mr-1" />
                      )}
                      {formatNumber(row.pe.volume)}
                    </td>

                    {/* PE IV */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-right text-slate-400 cursor-pointer ${peBg}`}
                    >
                      {row.pe.iv > 0 ? `${row.pe.iv.toFixed(1)}%` : '—'}
                    </td>

                    {/* PE Delta */}
                    <td
                      onClick={() => onSelectStrikeForAnalysis(row.strike, 'PE')}
                      className={`py-1.5 px-2 text-right text-slate-300 cursor-pointer ${peBg}`}
                    >
                      {row.pe.delta.toFixed(2)}
                    </td>

                    {/* PE Compare Checkbox */}
                    <td className={`py-1.5 px-2 text-center ${peBg}`}>
                      <button
                        onClick={() => onToggleComparisonStrike(row.strike)}
                        title={isSelected ? 'Remove from comparison' : 'Add to multi-strike comparison'}
                        className="text-slate-400 hover:text-blue-400"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

