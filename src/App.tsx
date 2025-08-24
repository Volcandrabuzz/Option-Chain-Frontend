import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { Activity, Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  timestamp: string;
  pe_change: number;
  ce_change: number;
}

interface ConnectionStatus {
  connected: boolean;
  firstFetchComplete: boolean;
  totalPoints: number;
}

function App() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    firstFetchComplete: false,
    totalPoints: 0,
  });
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const SERVER_URL = 'http://localhost:5000';

  useEffect(() => {
    initializeConnection();
    fetchInitialData(); // Fetch complete data on component mount

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeConnection = () => {
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnectionStatus(prev => ({ ...prev, connected: true }));
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    });

    socketRef.current.on('connected', (response) => {
      console.log('Server welcome:', response.message);
      setConnectionStatus(prev => ({
        ...prev,
        totalPoints: response.total_points,
      }));
    });

    socketRef.current.on('first_fetch_complete', (response) => {
    console.log('First fetch complete:', response.message);
    fetchInitialData(); // reload full array after initial fetch
    setConnectionStatus(prev => ({ ...prev, firstFetchComplete: true }));
    });

    socketRef.current.on('new_data', (response) => {
      console.log('New data received:', response.latest);
      const newDataPoint = response.latest;
      
      // Only add new data point when backend list size changes
      setData(prevData => {
        // Check if this data point already exists to avoid duplicates
        const exists = prevData.some(item => item.timestamp === newDataPoint.timestamp);
        if (exists) {
          return prevData;
        }
        return [...prevData, newDataPoint];
      });
      setConnectionStatus(prev => ({ ...prev, totalPoints: response.total_points }));
      setLastUpdate(new Date().toLocaleTimeString());
    });

    socketRef.current.on('full_data', (response) => {
      console.log('Full data received (manual refresh):', response.data.length, 'points');
      // Replace all data with complete array from backend
      setData(response.data);
      setConnectionStatus(prev => ({ ...prev, totalPoints: response.total_points }));
    });
  };

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${SERVER_URL}/api/data`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setConnectionStatus(prev => ({ ...prev, totalPoints: result.total_points }));
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestFullData = () => {
    console.log('Manual refresh requested');
    if (socketRef.current) {
      socketRef.current.emit('request_full_data');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      // Handle the timestamp format from NSE API
      const date = new Date(timestamp);
      return format(date, 'HH:mm:ss');
    } catch {
      // Fallback for any parsing issues
      return timestamp.slice(-8) || timestamp;
    }
  };

  const chartData = {
    labels: data.map(item => formatTimestamp(item.timestamp)),
    datasets: [
      {
        label: 'PE Change',
        data: data.map(item => item.pe_change),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      },
      {
        label: 'CE Change',
        data: data.map(item => item.ce_change),
        borderColor: '#F97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#E5E7EB',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
      },
      title: {
        display: true,
        text: 'NIFTY Option Chain - PE & CE Changes',
        color: '#F9FAFB',
        font: {
          size: 18,
          weight: 'bold',
        },
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
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart',
    },
  };

  const getLatestValues = () => {
    if (data.length === 0) return { pe: 0, ce: 0 };
    const latest = data[data.length - 1];
    return { pe: latest.pe_change, ce: latest.ce_change };
  };

  const { pe: latestPE, ce: latestCE } = getLatestValues();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Activity className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">NIFTY Option Chain Monitor</h1>
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

      <div className="p-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Data Points</p>
                <p className="text-2xl font-bold text-white">{connectionStatus.totalPoints}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Latest PE Change</p>
                <p className={`text-2xl font-bold ${latestPE >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {latestPE.toFixed(0)}
                </p>
              </div>
              {latestPE >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Latest CE Change</p>
                <p className={`text-2xl font-bold ${latestCE >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {latestCE.toFixed(0)}
                </p>
              </div>
              {latestCE >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Last Update</p>
                <p className="text-lg font-semibold text-white">{lastUpdate || 'No updates yet'}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="h-96 w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="text-gray-300">Loading chart data...</span>
                </div>
              </div>
            ) : data.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">No data available yet. Waiting for data...</p>
              </div>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Data History</h3>
            <p className="text-gray-400 text-sm">Latest data points ({data.length} total)</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-300 font-medium">Timestamp</th>
                  <th className="px-6 py-3 text-left text-gray-300 font-medium">PE Change</th>
                  <th className="px-6 py-3 text-left text-gray-300 font-medium">CE Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.slice(-20).reverse().map((item, index) => (
                  <tr key={index} className={`${index === 0 ? 'bg-gray-750' : 'bg-gray-800'} hover:bg-gray-700 transition-colors`}>
                    <td className="px-6 py-3 text-gray-300">
                      {formatTimestamp(item.timestamp)}
                    </td>
                    <td className={`px-6 py-3 font-semibold ${item.pe_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.pe_change >= 0 ? '+' : ''}{item.pe_change.toFixed(0)}
                    </td>
                    <td className={`px-6 py-3 font-semibold ${item.ce_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {item.ce_change >= 0 ? '+' : ''}{item.ce_change.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {data.length === 0 && !isLoading && (
              <div className="px-6 py-8 text-center">
                <p className="text-gray-400">No data available yet</p>
                <p className="text-gray-500 text-sm">Waiting for server to start collecting data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;