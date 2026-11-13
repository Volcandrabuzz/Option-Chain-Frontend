import {
  savePivotLevels,
  loadPivotLevels,
  clearOldPivotLevels,
  clearTodayPivotLevels
} from "./utils/storage";

import PivotDialog from './components/PivotDialog';
import TotalsBipolarMonitor, { TotalsMonitorData } from './components/TotalsBipolarMonitor';
import OptionStrikeSignalTable, { StrikeRowSignal } from './components/OptionStrikeSignalTable';
import OIStrikeMonitor, { OIStrikeMonitorPayload } from './components/OIStrikeMonitor';
import StrikeVwapModal, { StrikeVwapPayload, SelectedStrike } from './components/StrikeVwapModal';
import NiftyExpectedRangeCard, { ExpectedRangeData } from './components/NiftyExpectedRangeCard';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import TradeJournal from './pages/TradeJournal';
import { AnalyticsPage } from './pages/Analytics/AnalyticsPage';
import { PaperTradingPage } from './pages/PaperTrading/PaperTradingPage';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { AuthProvider, useAuth, SERVER_URL } from './context/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from 'react-chartjs-2';
import { Activity, Wifi, WifiOff, RefreshCw, ChevronDown, LogOut, BookOpen, Volume2, VolumeX, Bell, BarChart2, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
import { playCrossoverBeep, testBeepSound } from './utils/audioAlert';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin,
  zoomPlugin
);

interface DataPoint {
  timestamp: string;
  pe_change: number;
  ce_change: number;
}

interface StrikeData {
  [strike: string]: number[];
}

interface StrikeGreeks {
  iv: number;
  gamma: number;
  delta: number;
  theta: number;
  vega: number
}

interface ConnectionStatus {
  connected: boolean;
  firstFetchComplete: boolean;
  totalPoints: number;
}

// CE Strike Colors – Bold, cool tones (NO red/green)
const CE_STRIKE_COLORS = [
  '#3B82F6', // Electric Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#0EA5E9', // Sky Blue
  '#06B6D4', // Cyan
];

// PE Strike Colors – Rich orange palette
const PE_STRIKE_COLORS = [
  '#FF6B35', // Vibrant Orange
  '#F97316', // Bright Orange
  '#FB923C', // Soft Orange
  '#EA580C', // Deep Orange
  '#FF8C42', // Tangerine
];


const INDEX_OPTIONS = ['NIFTY', 'FINNIFTY', 'BANKNIFTY', 'MIDCPNIFTY'];

// ==================== NAV BAR ====================
function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="bg-gray-800/90 backdrop-blur-xl border-b border-gray-700/50 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white hidden sm:block">OI Monitor</span>
          </Link>

          <nav className="flex items-center space-x-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/')
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              Dashboard
            </Link>
            <Link
              to="/analytics"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${isActive('/analytics')
                  ? 'bg-cyan-500/20 text-cyan-400 font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              <BarChart2 className="h-4 w-4" />
              <span>F&O Analytics</span>
            </Link>
            <Link
              to="/paper-trading"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${isActive('/paper-trading')
                  ? 'bg-emerald-500/20 text-emerald-400 font-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Paper Trading</span>
            </Link>
            <Link
              to="/trades"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1.5 ${isActive('/trades')
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Trade Journal</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {user && (
            <>
              <span className="text-sm text-gray-400 hidden sm:block">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="flex items-center space-x-1.5 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== DASHBOARD (existing chart logic) ====================
function Dashboard() {
  const { getAccessToken } = useAuth();

  const [data, setData] = useState<DataPoint[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    firstFetchComplete: false,
    totalPoints: 0,
  });
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // User pivot levels state
  const [userPivotLevels, setUserPivotLevels] = useState<{
    r2?: number;
    r1?: number;
    pivot?: number;
    s1?: number;
    s2?: number;
  }>({});

  const [showPivotDialog, setShowPivotDialog] = useState(false);

  const [pivotFormValues, setPivotFormValues] = useState<{
    r2: string;
    r1: string;
    pivot: string;
    s1: string;
    s2: string;
  }>({
    r2: '',
    r1: '',
    pivot: '',
    s1: '',
    s2: ''
  });


  const [selectedIndex, setSelectedIndex] = useState<string>('NIFTY');
  const [showIndexDropdown, setShowIndexDropdown] = useState(false);
  const [indexValue, setIndexValue] = useState<number>(0);

  const [top10CEStrikes, setTop10CEStrikes] = useState<number[]>([]);
  const [top10PEStrikes, setTop10PEStrikes] = useState<number[]>([]);

  const [currentMaxCE, setCurrentMaxCE] = useState<number | null>(null);
  const [currentMaxPE, setCurrentMaxPE] = useState<number | null>(null);
  const [currentSecondCE, setCurrentSecondCE] = useState<number | null>(null);
  const [currentSecondPE, setCurrentSecondPE] = useState<number | null>(null);

  const [ceArrays, setCeArrays] = useState<StrikeData>({});
  const [peArrays, setPeArrays] = useState<StrikeData>({});

  const [userSelectedCE, setUserSelectedCE] = useState<Set<number>>(new Set());
  const [userSelectedPE, setUserSelectedPE] = useState<Set<number>>(new Set());

  const [showCEDropdown, setShowCEDropdown] = useState(false);
  const [showPEDropdown, setShowPEDropdown] = useState(false);

  const [strikeGreeks, setStrikeGreeks] = useState<{ [key: string]: StrikeGreeks }>({});

  const [firstFetchIndexValue, setFirstFetchIndexValue] = useState<number>(0);
  const [underlyingArray, setUnderlyingArray] = useState<number[]>([]);

  const [timestamps, setTimestamps] = useState<string[]>([]);

  const [indexLoading, setIndexLoading] = useState<{ [key: string]: boolean }>({});

  const [futuresDiffArray, setFuturesDiffArray] = useState<number[]>([]);
  const [firstFetchFutures, setFirstFetchFutures] = useState<number>(0);
  const [totalsData, setTotalsData] = useState<TotalsMonitorData | null>(null);
  const [strikeChain, setStrikeChain] = useState<StrikeRowSignal[]>([]);
  const [oiStrikeMonitor, setOiStrikeMonitor] = useState<OIStrikeMonitorPayload | null>(null);

  // VWAP modal state
  const [strikeVwapData, setStrikeVwapData] = useState<StrikeVwapPayload>({});
  const [vwapModalSelected, setVwapModalSelected] = useState<SelectedStrike | null>(null);

  // Live India VIX and NIFTY Expected Range state
  const [expectedRange, setExpectedRange] = useState<ExpectedRangeData | null>(null);
  const [indiaVix, setIndiaVix] = useState<number | null>(null);

  // Bottom left strike line chart axis labels visibility (Always On by default, toggleable)
  const [showStrikeAxisLabels, setShowStrikeAxisLabels] = useState<boolean>(true);

  // Crossover Sound & Alert State
  const [isSoundAlertEnabled, setIsSoundAlertEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('crossover_sound_alert');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const isSoundAlertEnabledRef = useRef(isSoundAlertEnabled);
  useEffect(() => {
    isSoundAlertEnabledRef.current = isSoundAlertEnabled;
  }, [isSoundAlertEnabled]);

  const [crossoverAlert, setCrossoverAlert] = useState<{
    direction: 'PE_CROSSED_ABOVE' | 'CE_CROSSED_ABOVE';
    time: string;
    pe: number;
    ce: number;
  } | null>(null);

  const lastPointRef = useRef<{ pe: number; ce: number; timestamp: string } | null>(null);
  const lastAlertTimestampRef = useRef<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const chartRef = useRef<any>(null);
  const strikeChartRef = useRef<any>(null);

  useEffect(() => {
    initializeConnection();
    fetchInitialData();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    clearOldPivotLevels();
  }, []);

  useEffect(() => {
    const levels = loadPivotLevels(selectedIndex);

    if (levels) {
      setUserPivotLevels(levels);
      setPivotFormValues({
        r2: levels.r2?.toString() || '',
        r1: levels.r1?.toString() || '',
        pivot: levels.pivot?.toString() || '',
        s1: levels.s1?.toString() || '',
        s2: levels.s2?.toString() || ''
      });
    } else {
      setUserPivotLevels({});
      setPivotFormValues({
        r2: '',
        r1: '',
        pivot: '',
        s1: '',
        s2: ''
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const checkMarketClose = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // 3:30 PM IST
      if (hours === 15 && minutes >= 30) {
        clearTodayPivotLevels();
        setUserPivotLevels({});
        setPivotFormValues({
          r2: '',
          r1: '',
          pivot: '',
          s1: '',
          s2: ''
        });
      }
    };

    const interval = setInterval(checkMarketClose, 60000);
    checkMarketClose();

    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    // Reset crossover baseline on index change
    lastPointRef.current = null;
    setCrossoverAlert(null);

    if (socketRef.current && connectionStatus.connected) {
      // Clear user selections and chart data when changing index
      setUserSelectedCE(new Set());
      setUserSelectedPE(new Set());
      setData([]);
      setTimestamps([]);
      setUnderlyingArray([]);
      setFuturesDiffArray([]);
      setFirstFetchIndexValue(0);
      setFirstFetchFutures(0);
      setTotalsData(null);
      setStrikeChain([]);
      setOiStrikeMonitor(null);
      setStrikeVwapData({});
      setVwapModalSelected(null);
      setExpectedRange(null);

      socketRef.current.emit("change_index", {
        index: selectedIndex,
      });
    }
  }, [selectedIndex, connectionStatus.connected]);

  const initializeConnection = () => {
    const token = getAccessToken();

    const isLocal = typeof window !== 'undefined' && window.location.origin.includes('localhost');
    socketRef.current = io(SERVER_URL, {
      // Use websocket-only when going through a tunnel/proxy (Cloudflare, ngrok, etc.)
      // Polling transport does not work reliably through these proxies.
      // On localhost we allow polling fallback for dev convenience.
      transports: isLocal ? ["polling", "websocket"] : ["websocket"],
      auth: {
        token: token,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus(prev => ({ ...prev, connected: true }));

      // Send selected index to backend on connect — triggers full_data response
      socketRef.current?.emit("change_index", {
        index: selectedIndex,
      });

      // Belt-and-suspenders: also explicitly request full data 500ms later
      // in case change_index response races with connection setup
      setTimeout(() => {
        if (socketRef.current?.connected) {
          socketRef.current.emit('request_full_data', { index: selectedIndex });
        }
      }, 500);
    });

    // Handle auth errors from SocketIO
    socketRef.current.on('auth_error', (data) => {
      console.error('🔒 SocketIO auth error:', data.message);
      // Token might be expired — the AuthContext's refresh mechanism will handle it
    });

    socketRef.current.on('first_fetch_complete', (response) => {
      console.log('First fetch complete:', response);
      setConnectionStatus(prev => ({ ...prev, firstFetchComplete: true }));
      setIndexLoading(prev => ({ ...prev, [selectedIndex]: false }));

      // Request latest full data once first fetch finishes
      if (socketRef.current) {
        socketRef.current.emit('request_full_data', { index: selectedIndex });
      }

      setTop10CEStrikes(response.top_10_ce_strikes || []);
      setTop10PEStrikes(response.top_10_pe_strikes || []);
      setCurrentMaxCE(response.current_max_ce);
      setCurrentMaxPE(response.current_max_pe);
      setCurrentSecondCE(response.current_second_ce);
      setCurrentSecondPE(response.current_second_pe);

      setCeArrays(response.ce_oi_arrays || {});
      setPeArrays(response.pe_oi_arrays || {});
      setUnderlyingArray(response.underlying_diff_array || []);

      if (response.index_value) {
        setIndexValue(response.index_value);
        setFirstFetchIndexValue(response.index_value);
      }

      if (response.futures_diff_array) setFuturesDiffArray(response.futures_diff_array);
      if (response.first_fetch_futures) setFirstFetchFutures(response.first_fetch_futures);
      if (response.totals_monitor) setTotalsData(response.totals_monitor);
      if (response.strike_chain) setStrikeChain(response.strike_chain);
      if (response.oi_strike_monitor) setOiStrikeMonitor(response.oi_strike_monitor);
      if (response.strike_vwap) setStrikeVwapData(response.strike_vwap);
      if (response.expected_range) setExpectedRange(response.expected_range);
      if (response.india_vix) setIndiaVix(response.india_vix);
    });

    socketRef.current.on('new_data', (response) => {
      console.log('🆕 New data received:', response);
      setIndexLoading(prev => ({ ...prev, [selectedIndex]: false }));
      const newDataPoint = response.latest;

      // Real-time PE Change vs CE Change graph line crossover detection
      if (
        lastPointRef.current &&
        newDataPoint &&
        typeof newDataPoint.pe_change === 'number' &&
        typeof newDataPoint.ce_change === 'number'
      ) {
        const prevDiff = lastPointRef.current.pe - lastPointRef.current.ce;
        const currDiff = newDataPoint.pe_change - newDataPoint.ce_change;

        let crossedDirection: 'PE_CROSSED_ABOVE' | 'CE_CROSSED_ABOVE' | null = null;
        if (prevDiff < 0 && currDiff > 0) {
          // PE line crossed above CE line
          crossedDirection = 'PE_CROSSED_ABOVE';
        } else if (prevDiff > 0 && currDiff < 0) {
          // CE line crossed above PE line
          crossedDirection = 'CE_CROSSED_ABOVE';
        } else if (prevDiff < 0 && currDiff === 0) {
          crossedDirection = 'PE_CROSSED_ABOVE';
        } else if (prevDiff > 0 && currDiff === 0) {
          crossedDirection = 'CE_CROSSED_ABOVE';
        }

        if (crossedDirection && lastAlertTimestampRef.current !== newDataPoint.timestamp) {
          lastAlertTimestampRef.current = newDataPoint.timestamp;
          setCrossoverAlert({
            direction: crossedDirection,
            time: newDataPoint.timestamp,
            pe: newDataPoint.pe_change,
            ce: newDataPoint.ce_change,
          });

          if (isSoundAlertEnabledRef.current) {
            playCrossoverBeep(crossedDirection);
          }
        }
      }

      if (
        newDataPoint &&
        typeof newDataPoint.pe_change === 'number' &&
        typeof newDataPoint.ce_change === 'number'
      ) {
        lastPointRef.current = {
          pe: newDataPoint.pe_change,
          ce: newDataPoint.ce_change,
          timestamp: newDataPoint.timestamp,
        };
        setData(prevData => [...prevData, newDataPoint]);
      }

      if (response.underlying_diff_array) {
        setUnderlyingArray(response.underlying_diff_array);
        const targetLen = response.underlying_diff_array.length;
        setTimestamps(prev => {
          const timeStr = formatTimestamp(newDataPoint?.timestamp || '');
          if (prev.length === targetLen) {
            return prev;
          }
          if (prev.length < targetLen) {
            const newTimes = [...prev];
            while (newTimes.length < targetLen) {
              newTimes.push(timeStr);
            }
            return newTimes;
          }
          return prev.slice(0, targetLen);
        });
      } else if (newDataPoint?.timestamp) {
        setTimestamps(prev => [...prev, formatTimestamp(newDataPoint.timestamp)]);
      }

      if (newDataPoint?.timestamp) {
        setLastUpdate(formatTimestamp(newDataPoint.timestamp));
      }

      setCurrentMaxCE(response.current_max_ce);
      setCurrentMaxPE(response.current_max_pe);
      setCurrentSecondCE(response.current_second_ce);
      setCurrentSecondPE(response.current_second_pe);

      // Prioritize full maps for all strikes
      if (response.ce_oi_arrays) {
        setCeArrays(prev => ({
          ...prev,
          ...response.ce_oi_arrays
        }));
      } else if (response.current_max_ce && response.ce_oi_array) {
        setCeArrays(prev => ({
          ...prev,
          [response.current_max_ce]: response.ce_oi_array
        }));
      }

      if (response.pe_oi_arrays) {
        setPeArrays(prev => ({
          ...prev,
          ...response.pe_oi_arrays
        }));
      } else if (response.current_max_pe && response.pe_oi_array) {
        setPeArrays(prev => ({
          ...prev,
          [response.current_max_pe]: response.pe_oi_array
        }));
      }

      if (response.ce_user_selected_arrays) {
        setCeArrays(prev => ({
          ...prev,
          ...response.ce_user_selected_arrays
        }));
      }

      if (response.pe_user_selected_arrays) {
        setPeArrays(prev => ({
          ...prev,
          ...response.pe_user_selected_arrays
        }));
      }

      if (response.underlying_diff_array) {
        setUnderlyingArray(response.underlying_diff_array);
      }

      if (response.first_fetch_underlying) {
        setFirstFetchIndexValue(response.first_fetch_underlying);
      }

      if (response.first_fetch_futures) {
        setFirstFetchFutures(response.first_fetch_futures);
      }

      if (response.index_value) {
        setIndexValue(response.index_value);
      }

      if (response.futures_diff_array) {
        setFuturesDiffArray(response.futures_diff_array);
      }

      if (response.greeks) {
        setStrikeGreeks(response.greeks);
      }

      if (response.totals_monitor) {
        setTotalsData(response.totals_monitor);
      }

      if (response.strike_chain) {
        setStrikeChain(response.strike_chain);
      }

      if (response.oi_strike_monitor) {
        setOiStrikeMonitor(response.oi_strike_monitor);
      }

      if (response.strike_vwap) {
        setStrikeVwapData(response.strike_vwap);
      }

      if (response.expected_range) {
        setExpectedRange(response.expected_range);
      }

      if (response.india_vix) {
        setIndiaVix(response.india_vix);
      }

      setConnectionStatus(prev => ({
        ...prev,
        ...prev,
        totalPoints: response.total_points
      }));

      if (newDataPoint?.timestamp) {
        try {
          const parts = newDataPoint.timestamp.split(' ');
          const timePart = parts[1];
          setLastUpdate(timePart);
        } catch (e) {
          setLastUpdate(newDataPoint.timestamp);
        }
      }
    });

    socketRef.current.on('selected_strikes_updated', (response) => {
      console.log('📌 User selected strikes updated:', response);

      if (response.ce_arrays) {
        setCeArrays(prev => ({ ...prev, ...response.ce_arrays }));
      }
      if (response.pe_arrays) {
        setPeArrays(prev => ({ ...prev, ...response.pe_arrays }));
      }
      if (response.greeks) {
        setStrikeGreeks(response.greeks);
      }
    });

    socketRef.current.on('full_data', (response) => {
      console.log('📦 Full data received:', response.data?.length || 0, 'points');

      // Check if index has data yet — backend may still be doing its first fetch
      if (response.total_points === 0 || !response.data || response.data.length === 0) {
        setIndexLoading(prev => ({ ...prev, [selectedIndex]: true }));
        console.log(`⏳ Waiting for first fetch for ${selectedIndex}...`);
        // Retry in 3 seconds — backend first fetch may not be done yet
        setTimeout(() => {
          if (socketRef.current?.connected) {
            socketRef.current.emit('request_full_data', { index: selectedIndex });
          }
        }, 3000);
        return;
      }

      // Index has data — mark fully loaded & first fetch complete
      setIndexLoading(prev => ({ ...prev, [selectedIndex]: false }));
      setConnectionStatus(prev => ({ ...prev, firstFetchComplete: true }));

      if (response.data) {
        setData(response.data);
        setConnectionStatus(prev => ({
          ...prev,
          totalPoints: response.total_points || response.data.length
        }));

        const times = response.data.map((d: DataPoint) => formatTimestamp(d.timestamp));
        setTimestamps(times);

        if (response.data.length > 0) {
          const latest = response.data[response.data.length - 1];
          try {
            const parts = latest.timestamp.split(' ');
            const timePart = parts[1];
            setLastUpdate(timePart);
          } catch (e) {
            setLastUpdate(latest.timestamp);
          }
        }

        if (response.top_10_ce_strikes) setTop10CEStrikes(response.top_10_ce_strikes);
        if (response.top_10_pe_strikes) setTop10PEStrikes(response.top_10_pe_strikes);
        if (response.current_max_ce) setCurrentMaxCE(response.current_max_ce);
        if (response.current_max_pe) setCurrentMaxPE(response.current_max_pe);
        if (response.current_second_ce) setCurrentSecondCE(response.current_second_ce);
        if (response.current_second_pe) setCurrentSecondPE(response.current_second_pe);
        if (response.ce_oi_arrays) setCeArrays(response.ce_oi_arrays);
        if (response.pe_oi_arrays) setPeArrays(response.pe_oi_arrays);
        if (response.underlying_diff_array) setUnderlyingArray(response.underlying_diff_array);
        if (response.futures_diff_array) setFuturesDiffArray(response.futures_diff_array);
        if (response.first_fetch_futures) setFirstFetchFutures(response.first_fetch_futures);
        if (response.first_fetch_underlying) {
          setFirstFetchIndexValue(response.first_fetch_underlying);
        }
        if (response.index_value) {
          setIndexValue(response.index_value);
        }
        if (response.greeks) setStrikeGreeks(response.greeks);
        if (response.totals_monitor) setTotalsData(response.totals_monitor);
        if (response.strike_chain) setStrikeChain(response.strike_chain);
        if (response.oi_strike_monitor) setOiStrikeMonitor(response.oi_strike_monitor);
        if (response.strike_vwap) setStrikeVwapData(response.strike_vwap);
        if (response.expected_range) setExpectedRange(response.expected_range);
        if (response.india_vix) setIndiaVix(response.india_vix);

      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    });
  };

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const token = getAccessToken();
      const response = await fetch(`${SERVER_URL}/api/data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('API request failed:', response.status);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Non-JSON response received");
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        if (result.data.length > 0) {
          setIndexLoading(prev => ({ ...prev, [selectedIndex]: false }));
        }
        setData(result.data);
        setConnectionStatus(prev => ({
          ...prev,
          totalPoints: result.total_points || result.data.length
        }));

        const times = result.data.map((d: DataPoint) => formatTimestamp(d.timestamp));
        setTimestamps(times);

        if (result.data.length > 0) {
          const latest = result.data[result.data.length - 1];
          if (
            latest &&
            typeof latest.pe_change === 'number' &&
            typeof latest.ce_change === 'number'
          ) {
            lastPointRef.current = {
              pe: latest.pe_change,
              ce: latest.ce_change,
              timestamp: latest.timestamp,
            };
          }
          try {
            const parts = latest.timestamp.split(' ');
            const timePart = parts[1];
            setLastUpdate(timePart);
          } catch (e) {
            setLastUpdate(latest.timestamp);
          }
        }

        if (result.top_10_ce_strikes) setTop10CEStrikes(result.top_10_ce_strikes);
        if (result.top_10_pe_strikes) setTop10PEStrikes(result.top_10_pe_strikes);
        if (result.current_max_ce) setCurrentMaxCE(result.current_max_ce);
        if (result.current_max_pe) setCurrentMaxPE(result.current_max_pe);
        if (result.ce_oi_arrays) setCeArrays(result.ce_oi_arrays);
        if (result.pe_oi_arrays) setPeArrays(result.pe_oi_arrays);
        if (result.underlying_diff_array) setUnderlyingArray(result.underlying_diff_array);
        if (result.first_fetch_underlying) {
          setFirstFetchIndexValue(result.first_fetch_underlying);
          setIndexValue(result.first_fetch_underlying);
        }
        if (result.first_fetch_futures) {
          setFirstFetchFutures(result.first_fetch_futures);
        }

        if (result.futures_diff_array) {
          setFuturesDiffArray(result.futures_diff_array);
        }
        if (result.greeks) setStrikeGreeks(result.greeks);
        if (result.totals_monitor) setTotalsData(result.totals_monitor);
        if (result.strike_chain) setStrikeChain(result.strike_chain);
        if (result.oi_strike_monitor) setOiStrikeMonitor(result.oi_strike_monitor);
        if (result.strike_vwap) setStrikeVwapData(result.strike_vwap);
        if (result.expected_range) setExpectedRange(result.expected_range);
        if (result.india_vix) setIndiaVix(result.india_vix);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestFullData = () => {
    console.log(`🔄 Manual refresh requested for ${selectedIndex}`);

    if (socketRef.current && connectionStatus.connected) {
      socketRef.current.emit('request_full_data', {
        index: selectedIndex
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const parts = timestamp.split(' ');
      if (parts.length >= 2) {
        return parts[1];
      }
      return timestamp;
    } catch {
      return timestamp;
    }
  };

  const handleCEStrikeSelect = (strike: number) => {
    const newSelected = new Set(userSelectedCE);

    if (newSelected.has(strike)) {
      newSelected.delete(strike);
    } else {
      newSelected.add(strike);
    }

    setUserSelectedCE(newSelected);
    setShowCEDropdown(false);

    if (socketRef.current) {
      socketRef.current.emit('update_selected_strikes', {
        selected_ce_strikes: Array.from(newSelected),
        selected_pe_strikes: Array.from(userSelectedPE)
      });
    }
  };

  const handlePEStrikeSelect = (strike: number) => {
    const newSelected = new Set(userSelectedPE);

    if (newSelected.has(strike)) {
      newSelected.delete(strike);
    } else {
      newSelected.add(strike);
    }

    setUserSelectedPE(newSelected);
    setShowPEDropdown(false);

    if (socketRef.current) {
      socketRef.current.emit('update_selected_strikes', {
        selected_ce_strikes: Array.from(userSelectedCE),
        selected_pe_strikes: Array.from(newSelected)
      });
    }
  };

  const isCEChecked = (strike: number) => {
    return strike === currentMaxCE || userSelectedCE.has(strike);
  };

  const isPEChecked = (strike: number) => {
    return strike === currentMaxPE || userSelectedPE.has(strike);
  };

  const getSelectedCEStrikes = () => {
    const selected = [];
    if (currentMaxCE) selected.push(currentMaxCE);
    userSelectedCE.forEach(s => selected.push(s));
    return selected;
  };

  const getSelectedPEStrikes = () => {
    const selected = [];
    if (currentMaxPE) selected.push(currentMaxPE);
    userSelectedPE.forEach(s => selected.push(s));
    return selected;
  };

  // Pivot dialog handlers
  const handlePivotChange = (field: string, value: string) => {
    setPivotFormValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSavePivotLevels = () => {
    const levels: any = {};

    if (pivotFormValues.r2) levels.r2 = parseFloat(pivotFormValues.r2);
    if (pivotFormValues.r1) levels.r1 = parseFloat(pivotFormValues.r1);
    if (pivotFormValues.pivot) levels.pivot = parseFloat(pivotFormValues.pivot);
    if (pivotFormValues.s1) levels.s1 = parseFloat(pivotFormValues.s1);
    if (pivotFormValues.s2) levels.s2 = parseFloat(pivotFormValues.s2);

    savePivotLevels(selectedIndex, levels);
    setUserPivotLevels(levels);
    setShowPivotDialog(false);
  };


  const chartData = useMemo(() => {
    const validData = data.filter(item =>
      item &&
      typeof item.pe_change === 'number' && !isNaN(item.pe_change) &&
      typeof item.ce_change === 'number' && !isNaN(item.ce_change)
    );
    return {
      labels: validData.map(item => formatTimestamp(item.timestamp)),
      datasets: [
        {
          label: 'PE Change',
          data: validData.map(item => item.pe_change),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: validData.length === 1 ? 4 : 0,
          pointHoverRadius: 4,
          spanGaps: true,
        },
        {
          label: 'CE Change',
          data: validData.map(item => item.ce_change),
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: validData.length === 1 ? 4 : 0,
          pointHoverRadius: 4,
          spanGaps: true,
        },
      ],
    };
  }, [data]);

  const strikeChartData = useMemo(() => {
    const datasets: any[] = [];
    let ceColorIndex = 0;
    let peColorIndex = 0;

    const targetLen = timestamps.length;
    const alignArray = (arr: number[] | undefined) => {
      if (!arr || arr.length === 0) return [];
      if (arr.length === targetLen) return arr;
      if (arr.length > targetLen) return arr.slice(0, targetLen);
      const lastVal = arr[arr.length - 1];
      const padded = [...arr];
      while (padded.length < targetLen) {
        padded.push(lastVal);
      }
      return padded;
    };

    if (underlyingArray.length > 0) {
      const aligned = alignArray(underlyingArray);
      datasets.push({
        label: 'Underlying Diff',
        data: aligned.map(val => val / 5),
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: true,
        yAxisID: 'y',
        originalData: aligned,
      });
    }

    if (futuresDiffArray.length > 0) {
      const aligned = alignArray(futuresDiffArray);
      datasets.push({
        label: 'Futures Diff',
        data: aligned.map(val => val / 5),
        borderColor: '#FCD34D',
        backgroundColor: 'rgba(252, 211, 77, 0.1)',
        borderWidth: 3,
        borderDash: [5, 3],
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: true,
        yAxisID: 'y',
        originalData: aligned,
      });
    }

    // CE Strikes
    top10CEStrikes.forEach((strike) => {
      if (isCEChecked(strike) && ceArrays[strike]) {
        const isMax = strike === currentMaxCE;
        const isSecondMax = strike === currentSecondCE;
        datasets.push({
          label: `CE ${strike}${isMax ? ' ⭐' : ''}${isSecondMax ? ' ⭐⭐' : ''}`,
          data: alignArray(ceArrays[strike]),
          borderColor: CE_STRIKE_COLORS[ceColorIndex % CE_STRIKE_COLORS.length],
          backgroundColor: `${CE_STRIKE_COLORS[ceColorIndex % CE_STRIKE_COLORS.length]}20`,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          spanGaps: true,
          yAxisID: 'y',
        });
        ceColorIndex++;
      }
    });

    // PE Strikes
    top10PEStrikes.forEach((strike) => {
      if (isPEChecked(strike) && peArrays[strike]) {
        const isMax = strike === currentMaxPE;
        const isSecondMax = strike === currentSecondPE;
        datasets.push({
          label: `PE ${strike}${isMax ? ' ⭐' : ''}${isSecondMax ? ' ⭐⭐' : ''}`,
          data: alignArray(peArrays[strike]),
          borderColor: PE_STRIKE_COLORS[peColorIndex % PE_STRIKE_COLORS.length],
          backgroundColor: `${PE_STRIKE_COLORS[peColorIndex % PE_STRIKE_COLORS.length]}20`,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          spanGaps: true,
          yAxisID: 'y',
        });
        peColorIndex++;
      }
    });

    return {
      labels: timestamps,
      datasets,
    };
  }, [timestamps, underlyingArray, futuresDiffArray, ceArrays, peArrays, top10CEStrikes, top10PEStrikes, currentMaxCE, currentSecondCE, currentMaxPE, currentSecondPE, userSelectedCE, userSelectedPE]);


  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#E5E7EB',
          font: { size: 14, weight: 'bold' },
        },
      },
      title: {
        display: true,
        text: 'NIFTY Option Chain - PE & CE Changes',
        color: '#F9FAFB',
        font: { size: 18, weight: 'bold' },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#F9FAFB',
        bodyColor: '#E5E7EB',
        borderColor: '#374151',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: '#374151' },
        ticks: { color: '#9CA3AF', maxTicksLimit: 10 },
      },
      y: {
        grid: { color: '#374151' },
        ticks: { color: '#9CA3AF' },
      },
    },
  };



  const strikeChartOptions: ChartOptions<'line'> = useMemo(() => {
    const initialMin = -80;
    const initialMax = 80;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: '#E5E7EB',
            font: { size: 12, weight: 'bold' as const },
          },
        },
        title: {
          display: false, // Moved to card header to give maximum height to the line graph
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleColor: '#F9FAFB',
          bodyColor: '#E5E7EB',
          borderColor: '#374151',
          borderWidth: 1,
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || '';
              const value = context.parsed.y;

              if (label === 'Underlying Diff') {
                const originalValue = context.dataset.originalData[context.dataIndex];
                const actualIndex = firstFetchIndexValue + originalValue;
                return `${label}: ${originalValue.toFixed(2)} (Index: ${actualIndex.toFixed(2)})`;
              } else if (label === 'Futures Diff') {
                const originalValue = context.dataset.originalData[context.dataIndex];
                const actualFutures = firstFetchIndexValue + originalValue;
                return `${label}: ${originalValue.toFixed(2)} (Price: ${actualFutures.toFixed(2)})`;
              }
              return `${label}: ${value.toFixed(2)}`;
            }
          }
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'y' as const,
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'y' as const,
          },
          limits: {
            y: {
              min: -400,
              max: 400,
            },
          },
        },
        annotation: {
          annotations: {
            // R2 - Second CE Resistance
            ...(currentSecondCE && {
              r2Line: {
                type: 'line' as const,
                yMin: (currentSecondCE - firstFetchIndexValue) / 5,
                yMax: (currentSecondCE - firstFetchIndexValue) / 5,
                borderColor: '#991B1B',
                borderWidth: 3,
                borderDash: [10, 5],
                label: {
                  display: true,
                  content: `R2: ${currentSecondCE}`,
                  position: 'start' as const,
                  backgroundColor: '#991B1B',
                  color: '#FFFFFF',
                  padding: 4,
                  font: {
                    size: 9,
                    weight: 'bold' as const
                  }
                }
              }
            }),
            // R1 - Max CE Resistance
            ...(currentMaxCE && {
              r1Line: {
                type: 'line' as const,
                yMin: (currentMaxCE - firstFetchIndexValue) / 5,
                yMax: (currentMaxCE - firstFetchIndexValue) / 5,
                borderColor: '#EF4444',
                borderWidth: 3,
                borderDash: [10, 5],
                label: {
                  display: true,
                  content: `R1: ${currentMaxCE}`,
                  position: 'start' as const,
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  padding: 4,
                  font: {
                    size: 9,
                    weight: 'bold' as const
                  }
                }
              }
            }),
            // S1 - Max PE Support
            ...(currentMaxPE && {
              s1Line: {
                type: 'line' as const,
                yMin: (currentMaxPE - firstFetchIndexValue) / 5,
                yMax: (currentMaxPE - firstFetchIndexValue) / 5,
                borderColor: '#10B981',
                borderWidth: 3,
                borderDash: [10, 5],
                label: {
                  display: true,
                  content: `S1: ${currentMaxPE}`,
                  position: 'start' as const,
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  padding: 4,
                  font: {
                    size: 9,
                    weight: 'bold' as const
                  }
                }
              }
            }),
            // S2 - Second PE Support
            ...(currentSecondPE && {
              s2Line: {
                type: 'line' as const,
                yMin: (currentSecondPE - firstFetchIndexValue) / 5,
                yMax: (currentSecondPE - firstFetchIndexValue) / 5,
                borderColor: '#047857',
                borderWidth: 3,
                borderDash: [10, 5],
                label: {
                  display: true,
                  content: `S2: ${currentSecondPE}`,
                  position: 'start' as const,
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  padding: 4,
                  font: {
                    size: 9,
                    weight: 'bold' as const
                  }
                }
              }
            }),

            // User R2
            ...(userPivotLevels.r2 && {
              userR2Line: {
                type: 'line' as const,
                yMin: (userPivotLevels.r2 - firstFetchIndexValue) / 5,
                yMax: (userPivotLevels.r2 - firstFetchIndexValue) / 5,
                borderColor: '#DC2626',
                borderWidth: 2,
                label: {
                  display: true,
                  content: `User R2: ${userPivotLevels.r2}`,
                  position: 'start' as const,
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  padding: 3,
                  font: {
                    size: 8,
                    weight: 'bold' as const
                  }
                }
              }
            }),

            // User R1
            ...(userPivotLevels.r1 && {
              userR1Line: {
                type: 'line' as const,
                yMin: (userPivotLevels.r1 - firstFetchIndexValue) / 5,
                yMax: (userPivotLevels.r1 - firstFetchIndexValue) / 5,
                borderColor: '#EF4444',
                borderWidth: 2,
                label: {
                  display: true,
                  content: `User R1: ${userPivotLevels.r1}`,
                  position: 'start' as const,
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  padding: 3,
                  font: {
                    size: 8,
                    weight: 'bold' as const
                  }
                }
              }
            }),

            // User Pivot
            ...(userPivotLevels.pivot && {
              userPivotLine: {
                type: 'line' as const,
                yMin: (userPivotLevels.pivot - firstFetchIndexValue) / 5,
                yMax: (userPivotLevels.pivot - firstFetchIndexValue) / 5,
                borderColor: '#FBBF24',
                borderWidth: 2,
                label: {
                  display: true,
                  content: `Pivot: ${userPivotLevels.pivot}`,
                  position: 'center' as const,
                  backgroundColor: '#FBBF24',
                  color: '#000000',
                  padding: 3,
                  font: {
                    size: 8,
                    weight: 'bold' as const
                  }
                }
              }
            }),

            // User S1
            ...(userPivotLevels.s1 && {
              userS1Line: {
                type: 'line' as const,
                yMin: (userPivotLevels.s1 - firstFetchIndexValue) / 5,
                yMax: (userPivotLevels.s1 - firstFetchIndexValue) / 5,
                borderColor: '#10B981',
                borderWidth: 2,
                label: {
                  display: true,
                  content: `User S1: ${userPivotLevels.s1}`,
                  position: 'start' as const,
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  padding: 3,
                  font: {
                    size: 8,
                    weight: 'bold' as const
                  }
                }
              }
            }),

            // User S2
            ...(userPivotLevels.s2 && {
              userS2Line: {
                type: 'line' as const,
                yMin: (userPivotLevels.s2 - firstFetchIndexValue) / 5,
                yMax: (userPivotLevels.s2 - firstFetchIndexValue) / 5,
                borderColor: '#047857',
                borderWidth: 2,
                label: {
                  display: true,
                  content: `User S2: ${userPivotLevels.s2}`,
                  position: 'start' as const,
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  padding: 3,
                  font: {
                    size: 8,
                    weight: 'bold' as const
                  }
                }
              }
            })
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#374151' },
          ticks: {
            display: showStrikeAxisLabels,
            color: '#9CA3AF',
            maxTicksLimit: 10
          },
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          grid: { color: '#374151' },
          min: initialMin,
          max: initialMax,
          ticks: {
            display: showStrikeAxisLabels,
            color: '#10B981',
            stepSize: 20,
            callback: function (tickValue: string | number) {
              const value = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
              return value.toFixed(0);
            }
          },
          title: {
            display: showStrikeAxisLabels,
            text: 'Difference',
            color: '#10B981',
            font: { size: 12, weight: 'bold' as const }
          }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false,
          },
          min: initialMin,
          max: initialMax,
          ticks: {
            display: showStrikeAxisLabels,
            color: '#FBBF24',
            stepSize: 20,
            callback: function (tickValue: string | number) {
              const compressedDiff = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
              const actualDiff = compressedDiff * 5;
              return (firstFetchIndexValue + actualDiff).toFixed(0);
            }
          },
          title: {
            display: showStrikeAxisLabels,
            text: `${selectedIndex} Value`,
            color: '#FBBF24',
            font: { size: 12, weight: 'bold' as const }
          }
        }
      },
    };
  }, [selectedIndex, currentMaxCE, currentSecondCE, currentMaxPE, currentSecondPE, firstFetchIndexValue, userPivotLevels, showStrikeAxisLabels]);

  return (
    <div className="text-white">
      {/* Dashboard Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Option Chain Monitor</h1>
              <p className="text-gray-400">Real-time PE & CE Change Tracking</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {connectionStatus.connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm text-gray-300">
                {connectionStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {lastUpdate && (
              <div className="text-sm text-gray-400">
                Last Update: <span className="text-white font-mono">{lastUpdate}</span>
              </div>
            )}
            <button
              onClick={requestFullData}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* News Ticker */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-700 py-3 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap">
          <span className="text-lg font-semibold text-yellow-300 mx-8">📰 Breaking News Headlines</span>
          <span className="text-white mx-8">• Market Update: NIFTY shows strong momentum in options activity</span>
          <span className="text-white mx-8">• Options traders eye key resistance levels</span>
          <span className="text-white mx-8">• High volatility expected in upcoming trading session</span>
          <span className="text-white mx-8">• Technical indicators suggest bullish sentiment</span>
          <span className="text-lg font-semibold text-yellow-300 mx-8">📰 Breaking News Headlines</span>
          <span className="text-white mx-8">• Market Update: NIFTY shows strong momentum in options activity</span>
          <span className="text-white mx-8">• Options traders eye key resistance levels</span>
          <span className="text-white mx-8">• High volatility expected in upcoming trading session</span>
        </div>
      </div>

      {/* Index Value Display */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-md">
          <div className="relative">
            <button
              onClick={() => setShowIndexDropdown(!showIndexDropdown)}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors font-semibold"
            >
              <span>{selectedIndex}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showIndexDropdown && (
              <div className="absolute top-full mt-1 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 min-w-[160px]">
                {INDEX_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedIndex(option);
                      setShowIndexDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-600 first:rounded-t-lg last:rounded-b-lg text-orange-400 font-semibold"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-gray-400">Current Value:</span>
            <span className="text-3xl font-bold text-green-400">{indexValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* NIFTY Expected Range Calculator Card (Horizontal Layout: Daily Left, Weekly Middle, Monthly Right) */}
        <div className="mb-4">
          <NiftyExpectedRangeCard
            data={expectedRange}
            selectedIndex={selectedIndex}
            spotPrice={indexValue}
            vix={indiaVix}
          />
        </div>

        {/* CE Strikes (Left) & PE Strikes (Right) side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* CE Strikes Section (Left) */}
          <div className="bg-gray-800 rounded-lg p-3.5 border border-blue-500/30 shadow-md">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wide">CE Strikes (Above Underlying)</h3>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowCEDropdown(!showCEDropdown)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold flex items-center space-x-1"
                >
                  <span>Add Strike</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showCEDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 max-h-60 overflow-y-auto">
                    {top10CEStrikes.filter(s => s !== currentMaxCE && !userSelectedCE.has(s)).map((strike) => (
                      <button
                        key={strike}
                        onClick={() => handleCEStrikeSelect(strike)}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-white text-xs"
                      >
                        {strike}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {getSelectedCEStrikes().map((strike) => {
                const greeks = strikeGreeks[`CE_${strike}`] || { iv: 0, gamma: 0, delta: 0, theta: 0, vega: 0 };
                const isMax = strike === currentMaxCE;

                return (
                  <div
                    key={`ce-${strike}`}
                    className={`p-2.5 rounded-lg border-2 ${isMax
                        ? 'bg-blue-600 border-blue-400'
                        : 'bg-gray-700 border-gray-600'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-bold">{strike}</span>
                      {isMax && <span className="text-yellow-300 text-sm">⭐</span>}
                      {!isMax && (
                        <button
                          onClick={() => handleCEStrikeSelect(strike)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">IV:</span>
                        <span className="font-semibold text-blue-300">{greeks.iv.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Δ:</span>
                        <span className="font-semibold text-green-300">{greeks.delta > 0 ? '+' : ''}{greeks.delta.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Γ:</span>
                        <span className="font-semibold text-purple-300">{greeks.gamma.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Θ:</span>
                        <span className="font-semibold text-red-300">{greeks.theta < 0 ? '' : '+'}{greeks.theta.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">ν:</span>
                        <span className="font-semibold text-yellow-300">{greeks.vega.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PE Strikes Section (Right) */}
          <div className="bg-gray-800 rounded-lg p-3.5 border border-orange-500/30 shadow-md">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wide">PE Strikes (Below Underlying)</h3>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowPEDropdown(!showPEDropdown)}
                  className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs font-semibold flex items-center space-x-1"
                >
                  <span>Add Strike</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showPEDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-xl border border-gray-600 z-50 max-h-60 overflow-y-auto">
                    {top10PEStrikes.filter(s => s !== currentMaxPE && !userSelectedPE.has(s)).map((strike) => (
                      <button
                        key={strike}
                        onClick={() => handlePEStrikeSelect(strike)}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-600 text-white text-xs"
                      >
                        {strike}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {getSelectedPEStrikes().map((strike) => {
                const greeks = strikeGreeks[`PE_${strike}`] || { iv: 0, gamma: 0, delta: 0, theta: 0, vega: 0 };
                const isMax = strike === currentMaxPE;

                return (
                  <div
                    key={`pe-${strike}`}
                    className={`p-2.5 rounded-lg border-2 ${isMax
                        ? 'bg-orange-600 border-orange-400'
                        : 'bg-gray-700 border-gray-600'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-bold">{strike}</span>
                      {isMax && <span className="text-yellow-300 text-sm">⭐</span>}
                      {!isMax && (
                        <button
                          onClick={() => handlePEStrikeSelect(strike)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">IV:</span>
                        <span className="font-semibold text-blue-300">{greeks.iv.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Δ:</span>
                        <span className="font-semibold text-green-300">{greeks.delta > 0 ? '+' : ''}{greeks.delta.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Γ:</span>
                        <span className="font-semibold text-purple-300">{greeks.gamma.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Θ:</span>
                        <span className="font-semibold text-red-300">{greeks.theta < 0 ? '' : '+'}{greeks.theta.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">ν:</span>
                        <span className="font-semibold text-yellow-300">{greeks.vega.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PE vs CE OI, CHG_IN_OI, LTP Horizontal Bipolar Monitors */}
        <TotalsBipolarMonitor totalsData={totalsData} selectedIndex={selectedIndex} />

        {/* Live Change in OI Strike Price Visualization (ATM ± 5 strikes) */}
        <OIStrikeMonitor data={oiStrikeMonitor} selectedIndex={selectedIndex} />

        {/* Options Strike Signal Table */}
        {strikeChain.length > 0 && (() => {
          // Determine R1/S1: R1 must be ABOVE ATM (resistance), S1 must be BELOW ATM (support)
          // User pivot levels take priority; auto-detection enforces correct side
          let autoR1: number | null | undefined = currentMaxCE;
          let autoS1: number | null | undefined = currentMaxPE;
          // If both auto values exist and they're on the wrong side, swap them
          if (autoR1 != null && autoS1 != null && indexValue > 0) {
            if (autoR1 < autoS1) {
              // swap: the higher value is resistance, lower is support
              [autoR1, autoS1] = [autoS1, autoR1];
            }
          } else if (autoR1 != null && autoS1 == null && indexValue > 0 && autoR1 < indexValue) {
            // Only R1 available but it's below ATM → treat it as S1 instead
            autoS1 = autoR1;
            autoR1 = null;
          } else if (autoS1 != null && autoR1 == null && indexValue > 0 && autoS1 > indexValue) {
            // Only S1 available but it's above ATM → treat it as R1 instead
            autoR1 = autoS1;
            autoS1 = null;
          }
          const r1Val = userPivotLevels.r1 || autoR1 || undefined;
          const s1Val = userPivotLevels.s1 || autoS1 || undefined;
          return (
            <OptionStrikeSignalTable
              strikeChain={strikeChain}
              selectedIndex={selectedIndex}
              underlying={indexValue}
              r1={r1Val}
              s1={s1Val}
              onRowClick={(strike, side) => setVwapModalSelected({ strike, side })}
            />
          );
        })()}

        {/* VWAP Candlestick Popup Modal */}
        <StrikeVwapModal
          selected={vwapModalSelected}
          vwapData={strikeVwapData}
          selectedIndex={selectedIndex}
          onClose={() => setVwapModalSelected(null)}
        />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">

          {/* Strike OI Chart */}
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 shadow-lg">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Strike OI Changes &amp; Underlying Movement
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Set Pivots */}
                <button
                  onClick={() => setShowPivotDialog(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition-all"
                  title="Configure manual pivot and support/resistance levels"
                >
                  <span>⚙️ Set Pivots</span>
                </button>

                {/* Toggle Axis Labels (Off by default for maximum space) */}
                <button
                  onClick={() => setShowStrikeAxisLabels(prev => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                    showStrikeAxisLabels
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  title={showStrikeAxisLabels ? 'Axis labels (left/right/bottom) are VISIBLE. Click to hide for maximum chart space.' : 'Axis labels are HIDDEN for maximum chart space. Click to show.'}
                >
                  {showStrikeAxisLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  <span>{showStrikeAxisLabels ? 'Labels: ON' : 'Labels: OFF'}</span>
                </button>

                {/* Reset Zoom */}
                <button
                  onClick={() => {
                    if (strikeChartRef.current) {
                      strikeChartRef.current.resetZoom();
                    }
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 text-white shadow-sm"
                  title="Reset chart zoom"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset Zoom</span>
                </button>
              </div>
            </div>

            <div className="h-[560px] w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-gray-300">Loading strike data...</span>
                  </div>
                </div>
              ) : indexLoading[selectedIndex] ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center space-y-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-yellow-500" />
                    <span className="text-yellow-300 font-semibold">Waiting for first fetch for {selectedIndex}...</span>
                    <span className="text-gray-400 text-sm">Data will appear within 60 seconds</span>
                  </div>
                </div>
              ) : timestamps.length > 0 ? (
                <Line ref={strikeChartRef} data={strikeChartData} options={strikeChartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No strike data available yet. Waiting for data...</p>
                </div>
              )}
            </div>
          </div>

          {/* PE/CE Change Chart */}
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  PE vs CE Change (Live Trend)
                </h3>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Audio Beep Alert Toggle */}
                <button
                  onClick={() => {
                    setIsSoundAlertEnabled(prev => {
                      const next = !prev;
                      try {
                        localStorage.setItem('crossover_sound_alert', String(next));
                      } catch (e) {
                        console.warn(e);
                      }
                      return next;
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                    isSoundAlertEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-1 ring-emerald-400'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                  }`}
                  title={isSoundAlertEnabled ? 'Crossover Beep Alert is ACTIVE' : 'Crossover Beep Alert is MUTED'}
                >
                  {isSoundAlertEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <span>Beep Alert: {isSoundAlertEnabled ? 'ON' : 'OFF'}</span>
                </button>

                {/* Test Beep Button */}
                <button
                  onClick={() => testBeepSound()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Click to test crossover beep audio and unlock browser sound"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Test Beep</span>
                </button>

                {/* Reset Zoom */}
                <button
                  onClick={() => {
                    if (chartRef.current) {
                      chartRef.current.resetZoom();
                    }
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 text-white shadow-sm"
                  title="Reset chart zoom"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset Zoom</span>
                </button>
              </div>
            </div>

            {/* Live Crossover Alert Banner */}
            {crossoverAlert && (
              <div
                className={`mb-3 p-2.5 rounded-lg border text-xs sm:text-sm font-bold flex items-center justify-between gap-2 shadow-lg animate-pulse ${
                  crossoverAlert.direction === 'PE_CROSSED_ABOVE'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span>
                    {crossoverAlert.direction === 'PE_CROSSED_ABOVE'
                      ? 'CROSSOVER ALERT: PE Line Crossed ABOVE CE Line (Bullish Trend)'
                      : 'CROSSOVER ALERT: CE Line Crossed ABOVE PE Line (Bearish Trend)'}
                  </span>
                  <span className="font-mono text-xs opacity-75">
                    ({formatTimestamp(crossoverAlert.time)})
                  </span>
                </div>
                <button
                  onClick={() => setCrossoverAlert(null)}
                  className="px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 text-xs text-gray-300 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="h-[560px] w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-gray-300">Loading chart data...</span>
                  </div>
                </div>
              ) : indexLoading[selectedIndex] ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center space-y-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-yellow-500" />
                    <span className="text-yellow-300 font-semibold">Waiting for first fetch for {selectedIndex}...</span>
                    <span className="text-gray-400 text-sm">Data will appear within 60 seconds</span>
                  </div>
                </div>
              ) : data.length > 0 ? (
                <Line ref={chartRef} data={chartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No data available yet. Waiting for data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pivot Dialog */}
      <PivotDialog
        isOpen={showPivotDialog}
        onClose={() => setShowPivotDialog(false)}
        values={pivotFormValues}
        onChange={handlePivotChange}
        onSave={handleSavePivotLevels}
      />

      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        .animate-marquee {
          display: inline-block;
          animation: marquee 90s linear infinite;
        }
        
        /* Custom scrollbar for dropdowns */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 3px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #6B7280;
          border-radius: 3px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }
      `}</style>
    </div>
  );
}

// ==================== APP (Router + Auth) ====================
function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-gray-900">
            <NavBar />
            <Dashboard />
          </div>
        }
      />
      <Route
        path="/trades"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-900">
              <NavBar />
              <TradeJournal />
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-950">
              <NavBar />
              <AnalyticsPage />
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/paper-trading"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-slate-950">
              <NavBar />
              <PaperTradingPage />
            </div>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
