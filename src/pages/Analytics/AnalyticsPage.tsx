import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL, useAuth } from '../../context/AuthContext';
import {
  AllStrikesResponse,
  fetchAllStrikes,
  fetchFilters
} from '../../services/analyticsApi';
import { AnalyticsFilterBar } from '../../components/analytics/AnalyticsFilterBar';
import { AllStrikesTable } from '../../components/analytics/AllStrikesTable';
import { IndividualStrikeAnalysis } from '../../components/analytics/IndividualStrikeAnalysis';
import { MultiStrikeComparison } from '../../components/analytics/MultiStrikeComparison';
import {
  Table,
  Activity,
  Layers,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { getAccessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  // Global filter states
  const [indices, setIndices] = useState<string[]>(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']);
  const [selectedIndex, setSelectedIndex] = useState<string>('NIFTY');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [timeframes, setTimeframes] = useState<string[]>(['1m', '3m', '5m', '15m', '30m']);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('5m');
  const [selectedSide, setSelectedSide] = useState<'CE' | 'PE'>('CE');
  const [isMarketHours, setIsMarketHours] = useState<boolean>(false);

  // Level & Analysis states
  const [activeLevel, setActiveLevel] = useState<'L1' | 'L2' | 'L3'>('L1');
  const [selectedStrikeForAnalysis, setSelectedStrikeForAnalysis] = useState<number | null>(null);
  const [comparisonStrikes, setComparisonStrikes] = useState<number[]>([]);

  // Chain data state
  const [chainData, setChainData] = useState<AllStrikesResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial filter loading
  useEffect(() => {
    const initFilters = async () => {
      try {
        const res = await fetchFilters();
        if (res.indices?.length) setIndices(res.indices);
        if (res.timeframes?.length) setTimeframes(res.timeframes);
        setIsMarketHours(res.is_market_hours ?? false);
      } catch (err) {
        console.warn('Using default filter metadata:', err);
      }
    };
    initFilters();
  }, []);

  // 2. Load chain data when index or expiry changes (supports silent background reload without UI flash)
  const loadChain = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAllStrikes(selectedIndex, selectedExpiry || undefined);
      setChainData(res);
      if (res.available_expiries?.length) {
        setExpiries(res.available_expiries);
        if (!selectedExpiry || !res.available_expiries.includes(selectedExpiry)) {
          setSelectedExpiry(res.selected_expiry || res.available_expiries[0]);
        }
      }

      // If comparison strikes empty, pre-populate with ATM and adjacent strikes
      if (comparisonStrikes.length === 0 && res.atm_strike) {
        const sorted = res.strikes.map((s) => s.strike).sort((a, b) => a - b);
        const atmIdx = sorted.indexOf(res.atm_strike);
        if (atmIdx !== -1) {
          const defaults = [
            sorted[Math.max(0, atmIdx - 1)],
            sorted[atmIdx],
            sorted[Math.min(sorted.length - 1, atmIdx + 1)],
          ].filter(Boolean);
          setComparisonStrikes(defaults);
        }
      }

      // Default selected strike for analysis if null
      if (selectedStrikeForAnalysis === null && res.atm_strike) {
        setSelectedStrikeForAnalysis(res.atm_strike);
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to fetch option chain data');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedIndex, selectedExpiry, comparisonStrikes.length, selectedStrikeForAnalysis]);

  useEffect(() => {
    loadChain(false);
  }, [loadChain]);

  // 3. Live Socket.IO Stream integration for real-time spot and chain updates
  useEffect(() => {
    const token = getAccessToken();
    const isLocal = typeof window !== 'undefined' && window.location.origin.includes('localhost');
    const socket = io(SERVER_URL, {
      transports: isLocal ? ['polling', 'websocket'] : ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Analytics connected to live market stream');
      socket.emit('change_index', { index: selectedIndex });
    });

    const handleIncomingLiveUpdate = (data: any) => {
      const targetIndex = data?.index_name || data?.index;
      if (!targetIndex || targetIndex === selectedIndex) {
        const liveSpot = data?.spot_price || data?.index_value;
        if (liveSpot) {
          setChainData((prev) =>
            prev
              ? {
                  ...prev,
                  spot_price: Number(liveSpot),
                  futures_price: data.futures_price ?? prev.futures_price,
                  timestamp: data.timestamp || data.latest?.timestamp || prev.timestamp,
                }
              : null
          );
        }
        // Quietly refresh full chain without showing spinner
        loadChain(true);
      }
    };

    socket.on('analytics_update', handleIncomingLiveUpdate);
    socket.on('new_data', handleIncomingLiveUpdate);

    return () => {
      socket.disconnect();
    };
  }, [selectedIndex, loadChain, getAccessToken]);

  // 4. Resilient background auto-poll timer (every 4 seconds) to guarantee real-time updates
  useEffect(() => {
    const timer = setInterval(() => {
      loadChain(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [loadChain]);

  // Handle changing index: clear old strikes to avoid invalid selections and notify socket
  const handleIndexChange = (newIndex: string) => {
    if (newIndex !== selectedIndex) {
      setSelectedIndex(newIndex);
      setSelectedExpiry('');
      setSelectedStrikeForAnalysis(null);
      setComparisonStrikes([]);
      if (socketRef.current?.connected) {
        socketRef.current.emit('change_index', { index: newIndex });
      }
    }
  };

  // Keep the multi-strike chart readable: 10 ITM + ATM + 10 OTM at most.
  const MAX_COMPARISON_STRIKES = 21;
  const toggleComparisonStrike = (strike: number) => {
    if (comparisonStrikes.includes(strike)) {
      setComparisonStrikes(comparisonStrikes.filter((s) => s !== strike));
    } else {
      if (comparisonStrikes.length >= MAX_COMPARISON_STRIKES) {
        alert('You can compare up to 21 strikes (10 ITM + ATM + 10 OTM).');
        return;
      }
      setComparisonStrikes([...comparisonStrikes, strike]);
    }
  };

  // Click strike in Level 1 to drill down into Level 2
  const handleSelectStrikeForAnalysis = (strike: number, side: 'CE' | 'PE') => {
    setSelectedStrikeForAnalysis(strike);
    setSelectedSide(side);
    setActiveLevel('L2');
  };

  const availableStrikeNumbers = (chainData?.strikes || []).map((s) => s.strike);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                NSE F&O Institutional Analytics
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 tracking-normal">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-Strike Option Chain, 7-Graph Quantitative Sensitivity & Real-Time Matrix Comparison
            </p>
          </div>

          {/* Level Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => setActiveLevel('L1')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                activeLevel === 'L1'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Level 1: All Strikes</span>
            </button>

            <button
              onClick={() => {
                if (!selectedStrikeForAnalysis && chainData?.atm_strike) {
                  setSelectedStrikeForAnalysis(chainData.atm_strike);
                }
                setActiveLevel('L2');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                activeLevel === 'L2'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Level 2: Strike Deep-Dive (7 Graphs)</span>
              {selectedStrikeForAnalysis && (
                <span className="text-[10px] bg-slate-950/80 px-1.5 py-0.2 rounded font-mono">
                  {selectedStrikeForAnalysis}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveLevel('L3')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                activeLevel === 'L3'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Level 3: Multi-Strike (Compare Curves)</span>
              {comparisonStrikes.length > 0 && (
                <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full font-bold">
                  {comparisonStrikes.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Common Filter Bar */}
        <AnalyticsFilterBar
          indices={indices}
          selectedIndex={selectedIndex}
          onSelectIndex={handleIndexChange}
          expiries={expiries}
          selectedExpiry={selectedExpiry}
          onSelectExpiry={setSelectedExpiry}
          timeframes={timeframes}
          selectedTimeframe={selectedTimeframe}
          onSelectTimeframe={setSelectedTimeframe}
          selectedSide={selectedSide}
          onSelectSide={setSelectedSide}
          timestamp={chainData?.timestamp || 'N/A'}
          spotPrice={chainData?.spot_price}
          futuresPrice={chainData?.futures_price}
          atmStrike={chainData?.atm_strike}
          isMarketHours={isMarketHours}
          isLoading={isLoading}
          onRefresh={() => loadChain(false)}
        />

        {/* Error Alert if any */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ================= Level Views ================= */}
        {activeLevel === 'L1' && (
          <AllStrikesTable
            data={chainData}
            isLoading={isLoading}
            onSelectStrikeForAnalysis={handleSelectStrikeForAnalysis}
            selectedComparisonStrikes={comparisonStrikes}
            onToggleComparisonStrike={toggleComparisonStrike}
          />
        )}

        {activeLevel === 'L2' && (
          <IndividualStrikeAnalysis
            indexName={selectedIndex}
            strike={selectedStrikeForAnalysis || chainData?.atm_strike || 24500}
            side={selectedSide}
            expiry={selectedExpiry || chainData?.selected_expiry || '09-Nov-2026'}
            availableStrikes={availableStrikeNumbers}
            onSelectStrike={setSelectedStrikeForAnalysis}
            onSelectSide={setSelectedSide}
            onClose={() => setActiveLevel('L1')}
          />
        )}

        {activeLevel === 'L3' && (
          <MultiStrikeComparison
            indexName={selectedIndex}
            selectedStrikes={comparisonStrikes}
            onRemoveStrike={(s) => setComparisonStrikes(comparisonStrikes.filter((x) => x !== s))}
            onAddStrike={(s) => {
              setComparisonStrikes((prev) =>
                prev.includes(s) || prev.length >= MAX_COMPARISON_STRIKES ? prev : [...prev, s]
              );
            }}
            onReplaceStrikes={(strikes) => setComparisonStrikes(strikes.slice(0, MAX_COMPARISON_STRIKES))}
            availableStrikes={availableStrikeNumbers}
            expiry={selectedExpiry}
            side={selectedSide}
            onSelectSide={setSelectedSide}
            atmStrike={chainData?.atm_strike}
          />
        )}
      </div>
    </div>
  );
};

